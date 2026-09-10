const express = require('express');
const cors = require('cors');
require('dotenv').config();
const pool = require('./config/db');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);
const insumoRoutes = require('./routes/insumoRoutes');
app.use('/api/insumos', insumoRoutes);
const proveedorRoutes = require('./routes/proveedorRoutes');
app.use('/api/proveedores', proveedorRoutes);
const categoriaGastoRoutes = require('./routes/categoriaGastoRoutes');
app.use('/api/categorias-gasto', categoriaGastoRoutes);
const compraRoutes = require('./routes/compraRoutes');
app.use('/api/compras', compraRoutes);
const productoRoutes = require('./routes/productoRoutes');
app.use('/api/productos', productoRoutes);
const rendimientoRoutes = require('./routes/rendimientoRoutes');
app.use('/api/rendimientos', rendimientoRoutes);
const ventaRoutes = require('./routes/ventaRoutes');
app.use('/api/ventas', ventaRoutes);
const reporteRoutes = require('./routes/reporteRoutes');
app.use('/api/reportes', reporteRoutes);
app.get('/', (req, res) => {
  res.json({ message: 'Servidor de Gestión Restaurante funcionando 🚀' });
});

app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ conectado: true, hora_servidor: result.rows[0].now });
  } catch (error) {
    res.status(500).json({ conectado: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});