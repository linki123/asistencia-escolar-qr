import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/database.js';
import { allowRoles, requireAuth, validateText } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, allowRoles('MASTER'));

router.get('/', async (_request, response, next) => {
  try {
    const [schools] = await pool.query(
      `SELECT c.id, c.nombre, c.codigo, c.activo, c.creado_en,
              (SELECT COUNT(*) FROM estudiantes e WHERE e.colegio_id = c.id AND e.activo = TRUE) AS estudiantes
       FROM colegios c ORDER BY c.nombre`
    );
    response.json(schools);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (request, response, next) => {
  let connection;
  try {
    const schoolName = validateText(request.body.nombre, 'El nombre del colegio', 180);
    const code = validateText(request.body.codigo, 'El código', 40).toUpperCase();
    const adminNames = validateText(request.body.adminNombres, 'Los nombres del administrador');
    const adminLastnames = validateText(request.body.adminApellidos, 'Los apellidos del administrador');
    const adminEmail = validateText(request.body.adminCorreo, 'El correo', 190).toLowerCase();
    const adminPassword = request.body.adminPassword;
    if (typeof adminPassword !== 'string' || adminPassword.length < 8) {
      throw Object.assign(new Error('La contraseña inicial debe tener al menos 8 caracteres.'), { status: 400 });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [schoolResult] = await connection.execute(
      'INSERT INTO colegios (nombre, codigo) VALUES (?, ?)',
      [schoolName, code]
    );
    const schoolId = schoolResult.insertId;
    const hash = await bcrypt.hash(adminPassword, 12);
    await connection.execute(
      `INSERT INTO usuarios (colegio_id, nombres, apellidos, correo, password_hash, rol)
       VALUES (?, ?, ?, ?, ?, 'ADMINISTRADOR')`,
      [schoolId, adminNames, adminLastnames, adminEmail, hash]
    );
    const [turnResult] = await connection.execute(
      `INSERT INTO turnos (colegio_id, nombre, hora_entrada, hora_salida, tolerancia_minutos)
       VALUES (?, 'Mañana', '08:00:00', '13:00:00', 10)`,
      [schoolId]
    );
    for (let day = 1; day <= 5; day += 1) {
      await connection.execute(
        'INSERT INTO dias_asistencia (colegio_id, turno_id, dia_semana) VALUES (?, ?, ?)',
        [schoolId, turnResult.insertId, day]
      );
    }
    await connection.commit();
    response.status(201).json({ id: schoolId, nombre: schoolName, codigo: code });
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally {
    connection?.release();
  }
});

export default router;
