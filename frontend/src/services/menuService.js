import api from './api';

// Menú completo (admin): todos los productos con su estado de hoy
export const getMenuAdmin = async () => {
  const response = await api.get('/menu');
  return response.data;
};

// Menú de hoy (mesero y caja): solo lo disponible, con cuántas porciones quedan
export const getMenuHoy = async () => {
  const response = await api.get('/menu/hoy');
  return response.data;
};

// Cambia disponible_hoy de un producto
export const updateMenuItem = async (id, datos) => {
  const response = await api.patch(`/menu/${id}`, datos);
  return response.data;
};

// Activa o apaga todo el menú de hoy
export const reiniciarMenu = async (disponible) => {
  const response = await api.post('/menu/reiniciar', { disponible_hoy: disponible });
  return response.data;
};