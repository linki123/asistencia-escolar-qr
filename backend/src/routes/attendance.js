import { Router } from 'express';
import pool from '../config/database.js';
import { allowRoles, requireAuth, requireSchool } from '../middleware/auth.js';
import { getLimaDateTime, isValidDate } from '../lib/limaTime.js';
import { generateCompletedAbsences } from '../lib/attendance.js';

const router = Router();
router.use(requireAuth, requireSchool, allowRoles('ADMINISTRADOR', 'OPERADOR'));

router.get('/shifts', async (request, response, next) => {
  try {
    const weekday = getLimaDateTime().weekday;
    const [shifts] = await pool.execute(
      `SELECT t.id, t.nombre, t.hora_entrada, t.hora_salida,
              t.registrar_entrada, t.registrar_salida
       FROM turnos t
       JOIN dias_asistencia d ON d.colegio_id = t.colegio_id AND d.turno_id = t.id
       WHERE t.colegio_id = ? AND t.activo = TRUE AND d.dia_semana = ?
       ORDER BY t.hora_entrada`,
      [request.user.colegioId, weekday]
    );
    response.json(shifts);
  } catch (error) {
    next(error);
  }
});

router.get('/filters', async (request, response, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT g.id, g.nombre AS grado, s.id AS seccion_id, s.nombre AS seccion
       FROM grados g
       LEFT JOIN secciones s ON s.colegio_id = g.colegio_id AND s.grado_id = g.id
       WHERE g.colegio_id = ? ORDER BY g.nombre, s.nombre`,
      [request.user.colegioId]
    );
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

router.post('/scan', async (request, response, next) => {
  let connection;
  try {
    const token = String(request.body.token || '').trim();
    const shiftId = Number(request.body.turnoId);
    const type = request.body.tipo || 'ENTRADA';
    if (!token || !Number.isInteger(shiftId) || !['ENTRADA', 'SALIDA'].includes(type)) {
      throw Object.assign(new Error('QR, turno y tipo de registro son obligatorios.'), { status: 400 });
    }

    const now = getLimaDateTime();
    const [students] = await pool.execute(
      `SELECT e.id, e.codigo, e.nombres, e.apellidos, e.turno_id, g.nombre AS grado, s.nombre AS seccion
       FROM codigos_qr q
       JOIN estudiantes e ON e.colegio_id = q.colegio_id AND e.id = q.estudiante_id
       JOIN grados g ON g.colegio_id = e.colegio_id AND g.id = e.grado_id
       JOIN secciones s ON s.colegio_id = e.colegio_id AND s.id = e.seccion_id
       WHERE q.colegio_id = ? AND q.token = ? AND q.activo = TRUE AND e.activo = TRUE
       LIMIT 1`,
      [request.user.colegioId, token]
    );
    const student = students[0];
    if (!student) throw Object.assign(new Error('El QR no corresponde a un estudiante activo de este colegio.'), { status: 404 });
    if (Number(student.turno_id) !== shiftId) {
      throw Object.assign(new Error('El estudiante pertenece a otro turno. Selecciona su turno asignado.'), { status: 400 });
    }

    const [shifts] = await pool.execute(
      `SELECT t.id, t.nombre, t.hora_entrada, t.hora_salida, t.tolerancia_minutos,
              t.registrar_entrada, t.registrar_salida, d.dia_semana
       FROM turnos t
       JOIN dias_asistencia d ON d.colegio_id = t.colegio_id AND d.turno_id = t.id
       WHERE t.colegio_id = ? AND t.id = ? AND t.activo = TRUE AND d.dia_semana = ?`,
      [request.user.colegioId, shiftId, now.weekday]
    );
    const shift = shifts[0];
    if (!shift) throw Object.assign(new Error('El turno no está habilitado para hoy.'), { status: 400 });
    if (type === 'ENTRADA' && !shift.registrar_entrada) {
      throw Object.assign(new Error('El turno no tiene habilitado el registro de entrada.'), { status: 400 });
    }
    if (type === 'SALIDA' && !shift.registrar_salida) {
      throw Object.assign(new Error('El turno no tiene habilitado el registro de salida.'), { status: 400 });
    }

    const deadline = type === 'ENTRADA'
      ? new Date(`2000-01-01T${shift.hora_entrada}Z`).getTime() + Number(shift.tolerancia_minutos) * 60000
      : Number.POSITIVE_INFINITY;
    const scanTime = new Date(`2000-01-01T${now.time}Z`).getTime();
    const state = scanTime <= deadline ? 'PUNTUAL' : 'TARDANZA';

    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [existing] = await connection.execute(
      `SELECT id, estado FROM asistencias
       WHERE colegio_id = ? AND estudiante_id = ? AND fecha = ? AND turno_id = ? AND tipo_registro = ?
       FOR UPDATE`,
      [request.user.colegioId, student.id, now.date, shiftId, type]
    );
    if (existing[0] && existing[0].estado !== 'FALTA') {
      throw Object.assign(new Error('La asistencia de este estudiante ya fue registrada para este turno.'), { status: 409 });
    }
    if (existing[0]) {
      await connection.execute(
        `UPDATE asistencias SET estado = ?, registrado_en = ?, registrado_por = ?
         WHERE id = ?`,
        [state, now.dateTime, request.user.id, existing[0].id]
      );
    } else {
      await connection.execute(
        `INSERT INTO asistencias
         (colegio_id, estudiante_id, turno_id, fecha, tipo_registro, estado, registrado_en, registrado_por)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [request.user.colegioId, student.id, shiftId, now.date, type, state, now.dateTime, request.user.id]
      );
    }
    await connection.commit();
    response.status(201).json({ estudiante: student, estado: state, tipo, hora: now.time, turno: shift.nombre });
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally {
    connection?.release();
  }
});

router.get('/', async (request, response, next) => {
  try {
    const today = getLimaDateTime();
    const from = request.query.desde || today.date;
    const to = request.query.hasta || today.date;
    if (!isValidDate(from) || !isValidDate(to) || from > to) {
      throw Object.assign(new Error('Selecciona un rango de fechas válido.'), { status: 400 });
    }
    if ((new Date(`${to}T12:00:00Z`) - new Date(`${from}T12:00:00Z`)) / 86400000 > 366) {
      throw Object.assign(new Error('El rango de consulta no puede superar un año.'), { status: 400 });
    }
    if (from === to) {
      const weekday = (new Date(`${from}T12:00:00Z`).getUTCDay() || 7);
      await generateCompletedAbsences(pool, request.user.colegioId, from, weekday);
    } else {
      const start = new Date(`${from}T12:00:00Z`);
      const end = new Date(`${to}T12:00:00Z`);
      for (let date = start; date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
        const weekday = date.getUTCDay() || 7;
        await generateCompletedAbsences(pool, request.user.colegioId, date.toISOString().slice(0, 10), weekday);
      }
    }

    const search = `%${String(request.query.buscar || '').trim()}%`;
    const state = request.query.estado || null;
    if (state && !['PUNTUAL', 'TARDANZA', 'FALTA', 'JUSTIFICADO'].includes(state)) {
      throw Object.assign(new Error('El filtro de estado no es válido.'), { status: 400 });
    }
    const [rows] = await pool.execute(
      `SELECT a.id, a.fecha, DATE_FORMAT(a.registrado_en, '%H:%i:%s') AS hora,
              a.tipo_registro AS tipo, a.estado, a.observacion,
              e.codigo, e.nombres, e.apellidos, g.nombre AS grado, s.nombre AS seccion,
              t.nombre AS turno
       FROM asistencias a
       JOIN estudiantes e ON e.colegio_id = a.colegio_id AND e.id = a.estudiante_id
       JOIN grados g ON g.colegio_id = e.colegio_id AND g.id = e.grado_id
       JOIN secciones s ON s.colegio_id = e.colegio_id AND s.id = e.seccion_id
       JOIN turnos t ON t.colegio_id = a.colegio_id AND t.id = a.turno_id
       WHERE a.colegio_id = ? AND a.fecha BETWEEN ? AND ?
         AND (? IS NULL OR a.estado = ?)
         AND (? = '%%' OR e.codigo LIKE ? OR e.nombres LIKE ? OR e.apellidos LIKE ?)
         AND (? IS NULL OR e.grado_id = ?)
         AND (? IS NULL OR e.seccion_id = ?)
       ORDER BY a.fecha DESC, a.registrado_en DESC, e.apellidos, e.nombres
       LIMIT 5000`,
      [
        request.user.colegioId, from, to, state, state, search, search, search, search,
        request.query.grado || null, request.query.grado || null,
        request.query.seccion || null, request.query.seccion || null
      ]
    );
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', allowRoles('ADMINISTRADOR'), async (request, response, next) => {
  try {
    const { estado, observacion } = request.body;
    if (!['PUNTUAL', 'TARDANZA', 'FALTA', 'JUSTIFICADO'].includes(estado)) {
      throw Object.assign(new Error('Estado de asistencia no válido.'), { status: 400 });
    }
    const [existing] = await pool.execute(
      'SELECT id FROM asistencias WHERE id = ? AND colegio_id = ?',
      [request.params.id, request.user.colegioId]
    );
    if (!existing.length) throw Object.assign(new Error('Registro de asistencia no encontrado.'), { status: 404 });
    await pool.execute(
      `UPDATE asistencias SET estado = ?, observacion = ?
       WHERE id = ? AND colegio_id = ?`,
      [estado, observacion ? String(observacion).trim().slice(0, 500) : null, request.params.id, request.user.colegioId]
    );
    response.json({ id: Number(request.params.id), estado });
  } catch (error) {
    next(error);
  }
});

export default router;
