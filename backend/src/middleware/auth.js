import jwt from 'jsonwebtoken';

export function requireAuth(request, _response, next) {
  const authorization = request.headers.authorization;
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;

  if (!token) {
    return next(Object.assign(new Error('Inicia sesión para continuar.'), { status: 401 }));
  }

  try {
    request.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return next(Object.assign(new Error('La sesión no es válida o expiró.'), { status: 401 }));
  }
}

export function allowRoles(...roles) {
  return (request, _response, next) => {
    if (!roles.includes(request.user?.rol)) {
      return next(Object.assign(new Error('No tienes permiso para realizar esta acción.'), { status: 403 }));
    }
    return next();
  };
}

export function requireSchool(request, _response, next) {
  if (!request.user?.colegioId) {
    return next(Object.assign(new Error('Esta cuenta no está asociada a un colegio.'), { status: 403 }));
  }
  return next();
}

export function validateText(value, label, maxLength = 120) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > maxLength) {
    throw Object.assign(new Error(`${label} es obligatorio y debe tener máximo ${maxLength} caracteres.`), { status: 400 });
  }
  return value.trim();
}
