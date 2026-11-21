import 'dotenv/config';
import readline from 'node:readline';
import bcrypt from 'bcryptjs';
import pool from '../src/config/database.js';

const interfaceReader = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => interfaceReader.question(text, resolve));

function hiddenPassword(prompt) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
      reject(new Error('Ejecuta este comando desde una terminal interactiva.'));
      return;
    }

    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    let value = '';
    const onData = (chunk) => {
      const character = chunk.toString('utf8');
      if (character === '\u0003') {
        process.stdin.setRawMode(false);
        process.stdin.off('data', onData);
        reject(new Error('Operación cancelada.'));
      } else if (character === '\r' || character === '\n') {
        process.stdin.setRawMode(false);
        process.stdin.off('data', onData);
        process.stdout.write('\n');
        resolve(value);
      } else if (character === '\u007f' || character === '\b') {
        value = value.slice(0, -1);
      } else if (character >= ' ') {
        value += character;
      }
    };
    process.stdin.on('data', onData);
  });
}

try {
  const [existing] = await pool.query("SELECT COUNT(*) AS total FROM usuarios WHERE rol = 'MASTER'");
  if (Number(existing[0].total) > 0) {
    console.log('Ya existe una cuenta master. No se realizaron cambios.');
    process.exitCode = 0;
  } else {
    const nombres = (await question('Nombres: ')).trim();
    const apellidos = (await question('Apellidos: ')).trim();
    const correo = (await question('Correo: ')).trim().toLowerCase();
    interfaceReader.close();
    const password = await hiddenPassword('Contraseña (mínimo 8 caracteres, no se mostrará): ');
    if (!nombres || !apellidos || !correo.includes('@') || password.length < 8) {
      throw new Error('Revisa nombres, correo y contraseña (mínimo 8 caracteres).');
    }
    const hash = await bcrypt.hash(password, 12);
    await pool.execute(
      `INSERT INTO usuarios (colegio_id, nombres, apellidos, correo, password_hash, rol)
       VALUES (NULL, ?, ?, ?, ?, 'MASTER')`,
      [nombres, apellidos, correo, hash]
    );
    console.log('Cuenta master creada. Inicia sesión con el correo indicado.');
  }
} catch (error) {
  console.error('No se pudo crear la cuenta master:', error.message);
  process.exitCode = 1;
} finally {
  interfaceReader.close();
  await pool.end();
}
