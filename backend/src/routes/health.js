import { Router } from 'express';
import pool from '../config/database.js';

const router = Router();

router.get('/health', async (_request, response) => {
  try {
    await pool.query('SELECT 1');
    response.json({ api: 'ok', database: 'ok' });
  } catch (error) {
    console.error('No se pudo comprobar la conexión con MySQL:', error);
    response.status(503).json({
      api: 'ok',
      database: 'error',
      message: 'No se pudo conectar con la base de datos.'
    });
  }
});

export default router;
