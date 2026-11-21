import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool from '../src/config/database.js';

const masterName = (process.env.DEMO_MASTER_NAME || '').trim();
const masterEmail = (process.env.DEMO_MASTER_EMAIL || '').trim().toLowerCase();
const masterPassword = process.env.DEMO_MASTER_PASSWORD;
const schoolName = (process.env.DEMO_SCHOOL_NAME || '').trim();
const schoolCode = (process.env.DEMO_SCHOOL_CODE || '').trim().toUpperCase();
const schoolAdminEmail = (process.env.DEMO_SCHOOL_ADMIN_EMAIL || '').trim().toLowerCase();
const schoolAdminPassword = process.env.DEMO_SCHOOL_ADMIN_PASSWORD;

const connection = await pool.getConnection();
let transactionStarted = false;
try {
  const [existingMasters] = await connection.query("SELECT COUNT(*) AS total FROM usuarios WHERE rol = 'MASTER'");
  if (Number(existingMasters[0].total) > 0) {
    console.log('Las cuentas iniciales ya existen; no se realizaron cambios.');
  } else {
    if (!masterName || !masterEmail.includes('@') || !schoolName || !schoolCode || !schoolAdminEmail.includes('@')) {
      throw new Error('Faltan datos válidos para crear las cuentas y el colegio de demostración.');
    }
    if (typeof masterPassword !== 'string' || masterPassword.length < 12
      || typeof schoolAdminPassword !== 'string' || schoolAdminPassword.length < 12) {
      throw new Error('Configura contraseñas nuevas de al menos 12 caracteres en las variables DEMO_*_PASSWORD.');
    }

    const [existingSchool] = await connection.execute(
      'SELECT id FROM colegios WHERE codigo = ? LIMIT 1',
      [schoolCode]
    );
    if (existingSchool.length) throw new Error('El código del colegio ya existe.');
    const [existingAdmin] = await connection.execute(
      'SELECT id FROM usuarios WHERE correo IN (?, ?) LIMIT 1',
      [masterEmail, schoolAdminEmail]
    );
    if (existingAdmin.length) throw new Error('Uno de los correos iniciales ya está en uso.');

    const [masterHash, adminHash] = await Promise.all([
      bcrypt.hash(masterPassword, 12),
      bcrypt.hash(schoolAdminPassword, 12)
    ]);

    await connection.beginTransaction();
    transactionStarted = true;
    const [schoolResult] = await connection.execute(
      'INSERT INTO colegios (nombre, codigo) VALUES (?, ?)',
      [schoolName, schoolCode]
    );
    const schoolId = schoolResult.insertId;
    await connection.execute(
      `INSERT INTO usuarios (colegio_id, nombres, apellidos, correo, password_hash, rol)
       VALUES (NULL, ?, 'Administrador', ?, ?, 'MASTER')`,
      [masterName, masterEmail, masterHash]
    );
    await connection.execute(
      `INSERT INTO usuarios (colegio_id, nombres, apellidos, correo, password_hash, rol)
       VALUES (?, ?, 'Administrador', ?, ?, 'ADMINISTRADOR')`,
      [schoolId, masterName, schoolAdminEmail, adminHash]
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
    transactionStarted = false;
    console.log('Colegio y cuentas iniciales creados. Las contraseñas no se escribieron en los registros.');
  }
} catch (error) {
  if (transactionStarted) await connection.rollback();
  console.error('No se pudo completar la preparación de la demo:', error.message);
  process.exitCode = 1;
} finally {
  connection.release();
  await pool.end();
}
