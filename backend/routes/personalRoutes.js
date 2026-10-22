const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const {
  listarPersonal,
  crearPersonal,
  actualizarPersonal,
} = require('../controllers/personalController');

router.get('/', protect, listarPersonal);
router.post('/', protect, crearPersonal);
router.patch('/:id', protect, actualizarPersonal);

module.exports = router;