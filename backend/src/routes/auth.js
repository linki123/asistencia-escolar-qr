import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Demasiados intentos. Espera 15 minutos antes de volver a intentar.' }
});

router.post('/login', loginLimiter, async (request, response, next) => {
  try {
    const email = String(request.body.email || '').trim().toLowerCase();
    const password = request.body.password;
    if (!email || typeof password !== 'string' || !password) {
      return response.status(400).json({ message: 'Ingresa correo y contraseña.' });
    }

    const [rows] = await pool.execute(
      `SELECT u.id, u.colegio_id, u.nombres, u.apellidos, u.correo, u.password_hash, u.rol,
              c.nombre AS colegio_nombre
       FROM usuarios u
       LEFT JOIN colegios c ON c.id = u.colegio_id AND c.activo = TRUE
       WHERE u.correo = ? AND u.activo = TRUE
       LIMIT 1`,
      [email]
    );
    const user = rows[0];
    const hashToCompare = user?.password_hash
      || '$2a$10$invalidhashforcomparison000000000000000000000000000000';
    const passwordMatches = await bcrypt.compare(password, hashToCompare);
    if (!user || (user.rol !== 'MASTER' && !user.colegio_nombre) || !passwordMatches) {
      return response.status(401).json({ message: 'Correo o contraseña incorrectos.' });
    }

    const payload = {
      id: user.id,
      colegioId: user.colegio_id,
      rol: user.rol,
      nombres: user.nombres,
      apellidos: user.apellidos,
      correo: user.correo,
      colegioNombre: user.colegio_nombre
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
    return response.json({ token, user: payload });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', requireAuth, (request, response) => {
  response.json({ user: request.user });
});

export default router;
