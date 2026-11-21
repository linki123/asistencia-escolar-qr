import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const directory = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(directory, '..', '.env');
const examplePath = path.join(directory, '..', '.env.example');

try {
  let contents;
  try {
    contents = await readFile(envPath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    contents = await readFile(examplePath, 'utf8');
  }

  const secret = contents.match(/^JWT_SECRET=(.*)$/m)?.[1]?.trim();
  if (!secret || secret.length < 32 || secret.startsWith('generate-')) {
    const newSecret = randomBytes(48).toString('base64url');
    contents = /^JWT_SECRET=.*$/m.test(contents)
      ? contents.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${newSecret}`)
      : `${contents.trimEnd()}\nJWT_SECRET=${newSecret}\n`;
  }
  await writeFile(envPath, contents.endsWith('\n') ? contents : `${contents}\n`, { mode: 0o600 });
  console.log('backend/.env está listo. Completa DB_PASSWORD con tu contraseña local de MySQL.');
} catch (error) {
  console.error('No se pudo preparar backend/.env:', error.message);
  process.exitCode = 1;
}
