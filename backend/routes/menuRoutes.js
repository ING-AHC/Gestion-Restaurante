const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const {
  getMenuAdmin,
  getMenuHoy,
  updateMenuItem,
  reiniciarMenu,
  getAjustes,
  updateAjustes,
} = require('../controllers/menuController');

router.get('/hoy', protect, getMenuHoy);
router.get('/ajustes', protect, getAjustes);
router.put('/ajustes', protect, updateAjustes);
router.get('/', protect, getMenuAdmin);
router.post('/reiniciar', protect, reiniciarMenu);
router.patch('/:id', protect, updateMenuItem);

module.exports = router;