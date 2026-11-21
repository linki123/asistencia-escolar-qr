import express from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import authRouter from './routes/auth.js';
import schoolRouter from './routes/schools.js';
import userRouter from './routes/users.js';
import studentRouter from './routes/students.js';
import attendanceRouter from './routes/attendance.js';
import settingsRouter from './routes/settings.js';
import dashboardRouter from './routes/dashboard.js';
import healthRouter from './routes/health.js';

const app = express();
const frontendDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');

app.use(express.json({ limit: '5mb' }));
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/schools', schoolRouter);
app.use('/api/users', userRouter);
app.use('/api/students', studentRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/dashboard', dashboardRouter);

if (process.env.NODE_ENV === 'production' && existsSync(frontendDist)) {
  app.use(express.static(frontendDist, { index: false, maxAge: '1h' }));
  app.get(/^(?!\/api(?:\/|$)).*/, (_request, response) => {
    response.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.use((_request, response) => {
  response.status(404).json({ message: 'Ruta no encontrada.' });
});

app.use((error, _request, response, _next) => {
  console.error('Error en la solicitud:', error);
  const status = error.status || (error.code === 'ER_DUP_ENTRY' ? 409 : 500);
  const databaseUnavailable = [
    'ER_ACCESS_DENIED_ERROR',
    'ER_BAD_DB_ERROR',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'PROTOCOL_CONNECTION_LOST'
  ].includes(error.code);
  const message = error.status
    ? error.message
    : error.code === 'ER_DUP_ENTRY'
      ? 'El registro ya existe.'
      : databaseUnavailable
        ? 'No se pudo acceder a MySQL. Revisa DB_HOST, DB_USER, DB_PASSWORD y DB_NAME en backend/.env.'
      : 'Error interno del servidor.';
  response.status(status).json({ message });
});

export default app;
