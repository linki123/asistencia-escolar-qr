import readline from 'node:readline';
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import mysql from 'mysql2/promise';

const directory = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(directory, '..', '.env');
const reader = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => reader.question(text, resolve));

function hiddenPassword() {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
      reject(new Error('Ejecuta este comando desde la terminal integrada o una terminal interactiva.'));
      return;
    }

    process.stdout.write('Contraseña MySQL (no se mostrará): ');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    let value = '';
    const onData = (chunk) => {
      for (const character of chunk.toString('utf8')) {
        if (character === '\u0003') {
          process.stdin.setRawMode(false);
          process.stdin.off('data', onData);
          reject(new Error('Operación cancelada.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          process.stdin.setRawMode(false);
          process.stdin.off('data', onData);
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (character === '\u007f' || character === '\b') {
          value = value.slice(0, -1);
        } else if (character >= ' ') {
          value += character;
        }
      }
    };
    process.stdin.on('data', onData);
  });
}

let connection;
try {
  const nonInteractivePassword = process.env.ASISTENCIA_MYSQL_PASSWORD;
  const host = nonInteractivePassword
    ? process.env.ASISTENCIA_DB_HOST || 'localhost'
    : (await question('MySQL host [localhost]: ')).trim() || 'localhost';
  const portInput = nonInteractivePassword
    ? process.env.ASISTENCIA_DB_PORT || '3306'
    : (await question('MySQL puerto [3306]: ')).trim() || '3306';
  const port = Number(portInput);
  const user = nonInteractivePassword
    ? process.env.ASISTENCIA_DB_USER || 'root'
    : (await question('Usuario MySQL [root]: ')).trim() || 'root';
  const database = nonInteractivePassword
    ? process.env.ASISTENCIA_DB_NAME || 'asistencia_escolar'
    : (await question('Base de datos [asistencia_escolar]: ')).trim() || 'asistencia_escolar';
  if (!nonInteractivePassword) reader.close();

  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('El puerto MySQL no es válido.');
  if (!/^[a-zA-Z0-9_]+$/.test(database)) throw new Error('El nombre de la base solo puede contener letras, números y guion bajo.');
  if (!/^[a-zA-Z0-9._:[\]-]+$/.test(host) || !/^[a-zA-Z0-9._-]+$/.test(user)) {
    throw new Error('Host o usuario MySQL no válido.');
  }
  const password = nonInteractivePassword ?? await hiddenPassword();

  try {
    connection = await mysql.createConnection({ host, port, user, password, database });
    await connection.query('SELECT 1');
  } catch (error) {
    await connection?.end();
    if (error.code !== 'ER_BAD_DB_ERROR') throw error;
    connection = await mysql.createConnection({ host, port, user, password });
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await connection.query(`USE \`${database}\``);
  }
  await connection.query('SELECT 1');
  const jwtSecret = randomBytes(48).toString('base64url');
  const env = [
    'PORT=3001',
    `DB_HOST=${host}`,
    `DB_PORT=${port}`,
    `DB_USER=${user}`,
    `DB_PASSWORD_BASE64=${Buffer.from(password, 'utf8').toString('base64')}`,
    `DB_NAME=${database}`,
    `JWT_SECRET=${jwtSecret}`,
    ''
  ].join('\n');
  await writeFile(envPath, env, { mode: 0o600 });
  console.log('MySQL quedó configurado y probado. La contraseña y clave de sesión solo se guardaron en backend/.env.');
} catch (error) {
  console.error('No se pudo configurar MySQL:', error.message);
  process.exitCode = 1;
} finally {
  reader.close();
  await connection?.end();
}
