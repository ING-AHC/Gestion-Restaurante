const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const { createProveedores, getProveedores, deleteProveedor } = require('../controllers/proveedorController');
router.post('/', protect, createProveedores);
router.get('/', protect, getProveedores);
router.delete('/:id', protect, deleteProveedor);
module.exports = router;