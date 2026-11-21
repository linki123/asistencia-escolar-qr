import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool from '../src/config/database.js';

const accounts = [
  { email: 'admin@gmail.com', variable: 'DEMO_MASTER_PASSWORD' },
  { email: 'admin@demo-01.local', variable: 'DEMO_SCHOOL_ADMIN_PASSWORD' }
];

try {
  for (const account of accounts) {
    const password = process.env[account.variable];
    if (typeof password !== 'string' || password.length < 16) {
      throw new Error(`${account.variable} debe tener al menos 16 caracteres.`);
    }
  }

  const hashes = await Promise.all(accounts.map(({ variable }) => bcrypt.hash(process.env[variable], 12)));
  const connection = await pool.getConnection();
  let transactionStarted = false;
  try {
    await connection.beginTransaction();
    transactionStarted = true;
    for (let index = 0; index < accounts.length; index += 1) {
      const [result] = await connection.execute(
        'UPDATE usuarios SET password_hash = ? WHERE correo = ? AND activo = TRUE',
        [hashes[index], accounts[index].email]
      );
      if (!result.affectedRows) throw new Error(`No se encontró la cuenta activa ${accounts[index].email}.`);
    }
    await connection.commit();
    transactionStarted = false;
    console.log('Las contraseñas de demostración fueron rotadas.');
  } catch (error) {
    if (transactionStarted) await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
} catch (error) {
  console.error('No se pudieron rotar las contraseñas de demostración:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
