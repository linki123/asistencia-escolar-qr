import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/database.js';
import { allowRoles, requireAuth, requireSchool, validateText } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireSchool);

router.get('/', allowRoles('ADMINISTRADOR'), async (request, response, next) => {
  try {
    const [users] = await pool.execute(
      `SELECT id, nombres, apellidos, correo, rol, activo, creado_en
       FROM usuarios WHERE colegio_id = ? ORDER BY apellidos, nombres`,
      [request.user.colegioId]
    );
    response.json(users);
  } catch (error) {
    next(error);
  }
});

router.post('/', allowRoles('ADMINISTRADOR'), async (request, response, next) => {
  try {
    const nombres = validateText(request.body.nombres, 'Los nombres');
    const apellidos = validateText(request.body.apellidos, 'Los apellidos');
    const correo = validateText(request.body.correo, 'El correo', 190).toLowerCase();
    const rol = request.body.rol;
    const password = request.body.password;
    if (!['ADMINISTRADOR', 'OPERADOR'].includes(rol)) {
      throw Object.assign(new Error('El rol debe ser ADMINISTRADOR u OPERADOR.'), { status: 400 });
    }
    if (typeof password !== 'string' || password.length < 8) {
      throw Object.assign(new Error('La contraseña debe tener al menos 8 caracteres.'), { status: 400 });
    }

    const hash = await bcrypt.hash(password, 12);
    const [result] = await pool.execute(
      `INSERT INTO usuarios (colegio_id, nombres, apellidos, correo, password_hash, rol)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [request.user.colegioId, nombres, apellidos, correo, hash, rol]
    );
    response.status(201).json({ id: result.insertId, nombres, apellidos, correo, rol, activo: true });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/active', allowRoles('ADMINISTRADOR'), async (request, response, next) => {
  try {
    const active = request.body.activo;
    if (typeof active !== 'boolean') {
      throw Object.assign(new Error('El estado activo debe ser verdadero o falso.'), { status: 400 });
    }
    if (Number(request.params.id) === Number(request.user.id)) {
      throw Object.assign(new Error('No puedes desactivar tu propia cuenta.'), { status: 400 });
    }
    const [result] = await pool.execute(
      'UPDATE usuarios SET activo = ? WHERE id = ? AND colegio_id = ? AND rol <> ?',
      [active, request.params.id, request.user.colegioId, 'MASTER']
    );
    if (!result.affectedRows) {
      throw Object.assign(new Error('Usuario no encontrado.'), { status: 404 });
    }
    response.json({ id: Number(request.params.id), activo: active });
  } catch (error) {
    next(error);
  }
});

export default router;
