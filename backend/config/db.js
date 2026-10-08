const { Pool } = require('pg');
const types = require('pg').types;
require('dotenv').config();

// Evita que PostgreSQL convierta las columnas DATE a objetos Date con zona horaria
// Las devuelve como texto plano "YYYY-MM-DD", sin ambigüedad de husos horarios
types.setTypeParser(1082, (val) => val);

// En producción (Railway) usa DATABASE_URL; en local usa las variables DB_*
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  : new Pool({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
    });

pool.on('connect', () => {
  console.log('Conectado a PostgreSQL ✅');
});

module.exports = pool;