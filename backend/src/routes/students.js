import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import pool from '../config/database.js';
import { allowRoles, requireAuth, requireSchool, validateText } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireSchool, allowRoles('ADMINISTRADOR'));

function studentFields(row) {
  return {
    codigo: validateText(row.codigo, 'El código', 60),
    nombres: validateText(row.nombres, 'Los nombres'),
    apellidos: validateText(row.apellidos, 'Los apellidos'),
    dni: row.dni ? String(row.dni).trim().slice(0, 20) : null,
    grado: validateText(row.grado, 'El grado', 80),
    seccion: validateText(row.seccion, 'La sección', 40),
    turnoId: row.turnoId === undefined || row.turnoId === null || row.turnoId === ''
      ? null
      : Number(row.turnoId)
  };
}

async function ensureGradeAndSection(connection, schoolId, gradeName, sectionName) {
  const [grades] = await connection.execute(
    'SELECT id FROM grados WHERE colegio_id = ? AND nombre = ?',
    [schoolId, gradeName]
  );
  let gradeId = grades[0]?.id;
  if (!gradeId) {
    const [result] = await connection.execute(
      'INSERT INTO grados (colegio_id, nombre) VALUES (?, ?)',
      [schoolId, gradeName]
    );
    gradeId = result.insertId;
  }

  const [sections] = await connection.execute(
    'SELECT id FROM secciones WHERE colegio_id = ? AND grado_id = ? AND nombre = ?',
    [schoolId, gradeId, sectionName]
  );
  let sectionId = sections[0]?.id;
  if (!sectionId) {
    const [result] = await connection.execute(
      'INSERT INTO secciones (colegio_id, grado_id, nombre) VALUES (?, ?, ?)',
      [schoolId, gradeId, sectionName]
    );
    sectionId = result.insertId;
  }
  return { gradeId, sectionId };
}

async function insertStudent(connection, schoolId, row) {
  const student = studentFields(row);
  const turnoId = await ensureShift(connection, schoolId, student.turnoId);
  const { gradeId, sectionId } = await ensureGradeAndSection(
    connection, schoolId, student.grado, student.seccion
  );
  const [result] = await connection.execute(
    `INSERT INTO estudiantes (colegio_id, grado_id, seccion_id, turno_id, codigo, nombres, apellidos, dni)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [schoolId, gradeId, sectionId, turnoId, student.codigo, student.nombres, student.apellidos, student.dni]
  );
  await connection.execute(
    'INSERT INTO codigos_qr (colegio_id, estudiante_id, token) VALUES (?, ?, ?)',
    [schoolId, result.insertId, randomUUID()]
  );
  return { id: result.insertId, ...student, turnoId };
}

async function ensureShift(connection, schoolId, requestedShiftId) {
  if (requestedShiftId !== null && !Number.isInteger(requestedShiftId)) {
    throw Object.assign(new Error('El turno seleccionado no es válido.'), { status: 400 });
  }
  const [shifts] = requestedShiftId
    ? await connection.execute(
      'SELECT id FROM turnos WHERE colegio_id = ? AND id = ? AND activo = TRUE',
      [schoolId, requestedShiftId]
    )
    : await connection.execute(
      'SELECT id FROM turnos WHERE colegio_id = ? AND activo = TRUE ORDER BY id LIMIT 1',
      [schoolId]
    );
  if (!shifts[0]) {
    throw Object.assign(new Error('Configura un turno activo antes de registrar estudiantes.'), { status: 400 });
  }
  return shifts[0].id;
}

router.get('/options', async (request, response, next) => {
  try {
    const [grades] = await pool.execute(
      `SELECT g.id, g.nombre,
              COALESCE(JSON_ARRAYAGG(JSON_OBJECT('id', s.id, 'nombre', s.nombre)), JSON_ARRAY()) AS secciones
       FROM grados g
       LEFT JOIN secciones s ON s.colegio_id = g.colegio_id AND s.grado_id = g.id
       WHERE g.colegio_id = ?
       GROUP BY g.id, g.nombre ORDER BY g.nombre`,
      [request.user.colegioId]
    );
    response.json(grades);
  } catch (error) {
    next(error);
  }
});

router.get('/', async (request, response, next) => {
  try {
    const search = `%${String(request.query.buscar || '').trim()}%`;
    const gradeId = request.query.grado || null;
    const sectionId = request.query.seccion || null;
    const [students] = await pool.execute(
      `SELECT e.id, e.codigo, e.nombres, e.apellidos, e.dni, e.activo,
              e.grado_id, g.nombre AS grado, e.seccion_id, s.nombre AS seccion,
              e.turno_id, t.nombre AS turno,
              q.token AS qr_token
       FROM estudiantes e
       JOIN grados g ON g.colegio_id = e.colegio_id AND g.id = e.grado_id
       JOIN secciones s ON s.colegio_id = e.colegio_id AND s.id = e.seccion_id
       JOIN turnos t ON t.colegio_id = e.colegio_id AND t.id = e.turno_id
       LEFT JOIN codigos_qr q ON q.colegio_id = e.colegio_id AND q.estudiante_id = e.id AND q.activo = TRUE
       WHERE e.colegio_id = ? AND e.activo = TRUE
         AND (? = '%%' OR e.codigo LIKE ? OR e.nombres LIKE ? OR e.apellidos LIKE ? OR e.dni LIKE ?)
         AND (? IS NULL OR e.grado_id = ?)
         AND (? IS NULL OR e.seccion_id = ?)
       ORDER BY g.nombre, s.nombre, e.apellidos, e.nombres
       LIMIT 2000`,
      [request.user.colegioId, search, search, search, search, search, gradeId, gradeId, sectionId, sectionId]
    );
    response.json(students);
  } catch (error) {
    next(error);
  }
});

router.post('/', allowRoles('ADMINISTRADOR'), async (request, response, next) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const student = await insertStudent(connection, request.user.colegioId, request.body);
    await connection.commit();
    response.status(201).json(student);
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally {
    connection?.release();
  }
});

router.post('/import/preview', allowRoles('ADMINISTRADOR'), async (request, response, next) => {
  try {
    const rows = request.body.rows;
    if (!Array.isArray(rows) || rows.length === 0 || rows.length > 2000) {
      throw Object.assign(new Error('El archivo debe tener entre 1 y 2000 filas.'), { status: 400 });
    }

    const seen = new Set();
    const result = [];
    for (let index = 0; index < rows.length; index += 1) {
      try {
        const student = studentFields(rows[index]);
        const key = student.codigo.toLocaleLowerCase();
        if (seen.has(key)) {
          result.push({ fila: index + 2, codigo: student.codigo, error: 'Código duplicado en el archivo.' });
          continue;
        }
        seen.add(key);
        const [existing] = await pool.execute(
          'SELECT id FROM estudiantes WHERE colegio_id = ? AND codigo = ? LIMIT 1',
          [request.user.colegioId, student.codigo]
        );
        result.push(existing.length
          ? { fila: index + 2, codigo: student.codigo, error: 'El código ya está registrado.' }
          : { fila: index + 2, ...student, valido: true });
      } catch (error) {
        result.push({ fila: index + 2, error: error.message });
      }
    }
    response.json({
      validas: result.filter((row) => row.valido).length,
      rechazadas: result.filter((row) => !row.valido).length,
      filas: result
    });
  } catch (error) {
    next(error);
  }
});

router.post('/import', allowRoles('ADMINISTRADOR'), async (request, response, next) => {
  let connection;
  try {
    const rows = request.body.rows;
    if (!Array.isArray(rows) || rows.length === 0 || rows.length > 2000) {
      throw Object.assign(new Error('El archivo debe tener entre 1 y 2000 filas.'), { status: 400 });
    }
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const imported = [];
    for (const row of rows) {
      imported.push(await insertStudent(connection, request.user.colegioId, row));
    }
    await connection.commit();
    response.status(201).json({ importados: imported.length });
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally {
    connection?.release();
  }
});

router.put('/:id', allowRoles('ADMINISTRADOR'), async (request, response, next) => {
  let connection;
  try {
    const student = studentFields(request.body);
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const turnoId = await ensureShift(connection, request.user.colegioId, student.turnoId);
    const { gradeId, sectionId } = await ensureGradeAndSection(
      connection, request.user.colegioId, student.grado, student.seccion
    );
    const [existing] = await connection.execute(
      'SELECT id FROM estudiantes WHERE id = ? AND colegio_id = ? AND activo = TRUE',
      [request.params.id, request.user.colegioId]
    );
    if (!existing.length) throw Object.assign(new Error('Estudiante no encontrado.'), { status: 404 });
    const [result] = await connection.execute(
      `UPDATE estudiantes SET grado_id = ?, seccion_id = ?, turno_id = ?, codigo = ?, nombres = ?, apellidos = ?, dni = ?
       WHERE id = ? AND colegio_id = ? AND activo = TRUE`,
      [gradeId, sectionId, turnoId, student.codigo, student.nombres, student.apellidos, student.dni, request.params.id, request.user.colegioId]
    );
    await connection.commit();
    response.json({ id: Number(request.params.id), ...student, turnoId });
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally {
    connection?.release();
  }
});

router.patch('/:id/active', allowRoles('ADMINISTRADOR'), async (request, response, next) => {
  try {
    const [result] = await pool.execute(
      'UPDATE estudiantes SET activo = FALSE WHERE id = ? AND colegio_id = ? AND activo = TRUE',
      [request.params.id, request.user.colegioId]
    );
    if (!result.affectedRows) throw Object.assign(new Error('Estudiante no encontrado.'), { status: 404 });
    response.json({ id: Number(request.params.id), activo: false });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/qr', allowRoles('ADMINISTRADOR'), async (request, response, next) => {
  try {
    const [student] = await pool.execute(
      'SELECT id FROM estudiantes WHERE id = ? AND colegio_id = ? AND activo = TRUE',
      [request.params.id, request.user.colegioId]
    );
    if (!student.length) throw Object.assign(new Error('Estudiante no encontrado.'), { status: 404 });
    const token = randomUUID();
    const [result] = await pool.execute(
      `UPDATE codigos_qr SET token = ?, activo = TRUE
       WHERE colegio_id = ? AND estudiante_id = ?`,
      [token, request.user.colegioId, request.params.id]
    );
    if (!result.affectedRows) {
      await pool.execute(
        'INSERT INTO codigos_qr (colegio_id, estudiante_id, token) VALUES (?, ?, ?)',
        [request.user.colegioId, request.params.id, token]
      );
    }
    response.json({ token });
  } catch (error) {
    next(error);
  }
});

export default router;
