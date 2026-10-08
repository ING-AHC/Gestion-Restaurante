const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const firmarToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

const register = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const nombre = String(name || '').trim();
    const correo = String(email || '').trim().toLowerCase();
    const clave = typeof password === 'string' ? password : '';

    if (!nombre || !correo || !clave) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    if (!EMAIL_REGEX.test(correo)) {
      return res.status(400).json({ error: 'El correo no es válido' });
    }

    if (clave.length < 8 || clave.length > 72) {
      return res.status(400).json({ error: 'La contraseña debe tener entre 8 y 72 caracteres' });
    }

    const userExists = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = $1',
      [correo]
    );
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'Ese email ya está registrado' });
    }

    const hashedPassword = await bcrypt.hash(clave, 10);

    const newUser = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
      [nombre, correo, hashedPassword]
    );

    res.status(201).json({
      user: newUser.rows[0],
      token: firmarToken(newUser.rows[0].id),
    });
  } catch (error) {
    // 23505 = correo duplicado detectado por la base de datos (registro simultáneo)
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Ese email ya está registrado' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const correo = String(email || '').trim().toLowerCase();
    const clave = typeof password === 'string' ? password : '';

    if (!correo || !clave) {
      return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
    }

    const userResult = await pool.query(
      'SELECT * FROM users WHERE LOWER(email) = $1',
      [correo]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Credenciales inválidas' });
    }

    const user = userResult.rows[0];
    const isMatch = await bcrypt.compare(clave, user.password);

    if (!isMatch) {
      return res.status(400).json({ error: 'Credenciales inválidas' });
    }

    res.json({
      user: { id: user.id, name: user.name, email: user.email },
      token: firmarToken(user.id),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

module.exports = { register, login };