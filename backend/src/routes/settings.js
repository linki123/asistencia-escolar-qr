import { Router } from 'express';
import pool from '../config/database.js';
import { allowRoles, requireAuth, requireSchool } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireSchool, allowRoles('ADMINISTRADOR'));

router.get('/', async (request, response, next) => {
  try {
    const [shifts] = await pool.execute(
      `SELECT t.id, t.nombre, t.hora_entrada, t.hora_salida, t.tolerancia_minutos,
              t.registrar_entrada, t.registrar_salida, t.activo,
              COALESCE(JSON_ARRAYAGG(d.dia_semana), JSON_ARRAY()) AS dias
       FROM turnos t
       LEFT JOIN dias_asistencia d ON d.colegio_id = t.colegio_id AND d.turno_id = t.id
       WHERE t.colegio_id = ?
       GROUP BY t.id ORDER BY t.nombre`,
      [request.user.colegioId]
    );
    response.json({ zonaHoraria: 'America/Lima', turnos: shifts });
  } catch (error) {
    next(error);
  }
});

async function saveShift(request, response, next, shiftId = null) {
  let connection;
  try {
    const { nombre, horaEntrada, horaSalida, toleranciaMinutos, registrarEntrada, registrarSalida, dias } = request.body;
    const validTime = (value) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value);
    if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 80) {
      throw Object.assign(new Error('El nombre del turno es obligatorio (máximo 80 caracteres).'), { status: 400 });
    }
    if (!validTime(horaEntrada) || !validTime(horaSalida)) {
      throw Object.assign(new Error('Indica horarios válidos en formato HH:MM.'), { status: 400 });
    }
    if (!Number.isInteger(Number(toleranciaMinutos)) || Number(toleranciaMinutos) < 0 || Number(toleranciaMinutos) > 240) {
      throw Object.assign(new Error('La tolerancia debe estar entre 0 y 240 minutos.'), { status: 400 });
    }
    if (!Array.isArray(dias) || !dias.length || dias.some((day) => !Number.isInteger(day) || day < 1 || day > 7)) {
      throw Object.assign(new Error('Selecciona al menos un día válido (1=lunes, 7=domingo).'), { status: 400 });
    }
    if (typeof registrarEntrada !== 'boolean' || typeof registrarSalida !== 'boolean' || (!registrarEntrada && !registrarSalida)) {
      throw Object.assign(new Error('Activa al menos entrada o salida.'), { status: 400 });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    let id = shiftId;
    if (shiftId) {
      const [existing] = await connection.execute(
        'SELECT id FROM turnos WHERE id = ? AND colegio_id = ?',
        [shiftId, request.user.colegioId]
      );
      if (!existing.length) throw Object.assign(new Error('Turno no encontrado.'), { status: 404 });
      await connection.execute(
        `UPDATE turnos SET nombre = ?, hora_entrada = ?, hora_salida = ?, tolerancia_minutos = ?,
             registrar_entrada = ?, registrar_salida = ?
         WHERE id = ? AND colegio_id = ?`,
        [nombre.trim(), horaEntrada, horaSalida, Number(toleranciaMinutos), registrarEntrada, registrarSalida, shiftId, request.user.colegioId]
      );
    } else {
      const [result] = await connection.execute(
        `INSERT INTO turnos
         (colegio_id, nombre, hora_entrada, hora_salida, tolerancia_minutos, registrar_entrada, registrar_salida)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [request.user.colegioId, nombre.trim(), horaEntrada, horaSalida, Number(toleranciaMinutos), registrarEntrada, registrarSalida]
      );
      id = result.insertId;
    }
    await connection.execute('DELETE FROM dias_asistencia WHERE colegio_id = ? AND turno_id = ?', [request.user.colegioId, id]);
    for (const day of [...new Set(dias)]) {
      await connection.execute(
        'INSERT INTO dias_asistencia (colegio_id, turno_id, dia_semana) VALUES (?, ?, ?)',
        [request.user.colegioId, id, day]
      );
    }
    await connection.commit();
    response.status(shiftId ? 200 : 201).json({ id, nombre: nombre.trim() });
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally {
    connection?.release();
  }
}

router.post('/shifts', (request, response, next) => saveShift(request, response, next));
router.put('/shifts/:id', (request, response, next) => saveShift(request, response, next, Number(request.params.id)));

router.patch('/shifts/:id/active', async (request, response, next) => {
  try {
    if (typeof request.body.activo !== 'boolean') {
      throw Object.assign(new Error('El estado activo debe ser verdadero o falso.'), { status: 400 });
    }
    if (!request.body.activo) {
      const [assigned] = await pool.execute(
        'SELECT COUNT(*) AS total FROM estudiantes WHERE colegio_id = ? AND turno_id = ? AND activo = TRUE',
        [request.user.colegioId, request.params.id]
      );
      if (Number(assigned[0].total) > 0) {
        throw Object.assign(new Error('Reasigna los estudiantes de este turno antes de desactivarlo.'), { status: 409 });
      }
    }
    const [result] = await pool.execute(
      'UPDATE turnos SET activo = ? WHERE id = ? AND colegio_id = ?',
      [request.body.activo, request.params.id, request.user.colegioId]
    );
    if (!result.affectedRows) throw Object.assign(new Error('Turno no encontrado.'), { status: 404 });
    response.json({ id: Number(request.params.id), activo: request.body.activo });
  } catch (error) {
    next(error);
  }
});

export default router;
