const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const ID = '\\d+';
const PERMISOS = {
  mesero: [
    ['GET', /^\/api\/productos\/?$/],
    ['GET', /^\/api\/menu\/hoy\/?$/],
    ['GET', /^\/api\/pedidos\/?$/],
    ['POST', /^\/api\/pedidos\/?$/],
    ['PATCH', new RegExp(`^/api/pedidos/${ID}/estado/?$`)],
  ],
  cocina: [
    ['GET', /^\/api\/pedidos\/?$/],
  ],
  caja: [
    ['GET', /^\/api\/productos\/?$/],
    ['GET', /^\/api\/menu\/hoy\/?$/],
    ['GET', /^\/api\/pedidos\/?$/],
    ['POST', /^\/api\/pedidos\/?$/],
    ['PATCH', new RegExp(`^/api/pedidos/${ID}/estado/?$`)],
    ['POST', new RegExp(`^/api/pedidos/${ID}/confirmar/?$`)],
  ],
};

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado, falta el token' });
  }

  const token = authHeader.split(' ')[1];
  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  const userId = Number(decoded.id);
  if (!Number.isInteger(userId)) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  // Tokens anteriores a los roles no traen "rol": son del dueño (admin)
  if (!decoded.rol || decoded.rol === 'admin') {
    req.userId = userId;
    req.actorId = userId;
    req.rol = 'admin';
    return next();
  }

  // Empleado: se verifica en la base que siga activo y pertenezca a ese restaurante
  try {
    const actorId = Number(decoded.uid);
    if (!Number.isInteger(actorId)) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    const { rows } = await pool.query(
      'SELECT rol, activo, owner_id FROM users WHERE id = $1',
      [actorId]
    );

    if (rows.length === 0 || !rows[0].activo || rows[0].owner_id !== userId) {
      return res.status(401).json({ error: 'Usuario desactivado o inexistente' });
    }

    const rol = rows[0].rol;
    const ruta = req.originalUrl.split('?')[0];
    const permitido = (PERMISOS[rol] || []).some(
      ([metodo, patron]) => metodo === req.method && patron.test(ruta)
    );

    if (!permitido) {
      return res.status(403).json({ error: 'No tienes permiso para esta acción' });
    }

    req.userId = userId;
    req.actorId = actorId;
    req.rol = rol;
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

module.exports = protect;