const bcrypt = require('bcryptjs');
const pool = require('../config/db');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ['mesero', 'cocina', 'caja'];
const MAX_PERSONAL = 20;

const soloAdmin = (req, res) => {
  if (req.rol !== 'admin') {
    res.status(403).json({ error: 'Solo el administrador puede gestionar el personal' });
    return false;
  }
  return true;
};

const listarPersonal = async (req, res) => {
  if (!soloAdmin(req, res)) return;
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, rol, activo, created_at
       FROM users WHERE owner_id = $1 ORDER BY created_at ASC`,
      [req.userId]
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al listar el personal' });
  }
};

const crearPersonal = async (req, res) => {
  if (!soloAdmin(req, res)) return;

  const nombre = String(req.body.name || '').trim();
  const correo = String(req.body.email || '').trim().toLowerCase();
  const clave = typeof req.body.password === 'string' ? req.body.password : '';
  const rol = req.body.rol;

  if (!nombre || nombre.length > 100) {
    return res.status(400).json({ error: 'El nombre es obligatorio (máximo 100 caracteres)' });
  }
  if (!EMAIL_REGEX.test(correo) || correo.length > 150) {
    return res.status(400).json({ error: 'El usuario debe tener forma de correo, por ejemplo mesero1@lacocina.com' });
  }
  if (clave.length < 8 || clave.length > 72) {
    return res.status(400).json({ error: 'La contraseña debe tener entre 8 y 72 caracteres' });
  }
  if (!ROLES.includes(rol)) {
    return res.status(400).json({ error: 'Rol no válido' });
  }

  try {
    const cuenta = await pool.query('SELECT COUNT(*) FROM users WHERE owner_id = $1', [req.userId]);
    if (Number(cuenta.rows[0].count) >= MAX_PERSONAL) {
      return res.status(400).json({ error: `Máximo ${MAX_PERSONAL} usuarios de personal` });
    }

    const hash = await bcrypt.hash(clave, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password, rol, owner_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, rol, activo, created_at`,
      [nombre, correo, hash, rol, req.userId]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ese usuario ya existe, elige otro' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al crear el usuario' });
  }
};

const actualizarPersonal = async (req, res) => {
  if (!soloAdmin(req, res)) return;

  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Id no válido' });
  }

  const { activo, password } = req.body;

  if (activo !== undefined && typeof activo !== 'boolean') {
    return res.status(400).json({ error: 'El campo activo debe ser verdadero o falso' });
  }
  if (password !== undefined && (typeof password !== 'string' || password.length < 8 || password.length > 72)) {
    return res.status(400).json({ error: 'La contraseña debe tener entre 8 y 72 caracteres' });
  }
  if (activo === undefined && password === undefined) {
    return res.status(400).json({ error: 'No hay nada que actualizar' });
  }

  try {
    const hash = password !== undefined ? await bcrypt.hash(password, 10) : null;
    const { rows } = await pool.query(
      `UPDATE users
       SET activo = COALESCE($1, activo), password = COALESCE($2, password)
       WHERE id = $3 AND owner_id = $4
       RETURNING id, name, email, rol, activo, created_at`,
      [activo === undefined ? null : activo, hash, id, req.userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el usuario' });
  }
};

module.exports = { listarPersonal, crearPersonal, actualizarPersonal };