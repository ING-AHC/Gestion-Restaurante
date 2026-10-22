import api from './api';

export const getMenuAdmin = async () => {
  const response = await api.get('/menu');
  return response.data;
};

export const getMenuHoy = async () => {
  const response = await api.get('/menu/hoy');
  return response.data;
};

export const updateMenuItem = async (id, data) => {
  const response = await api.patch(`/menu/${id}`, data);
  return response.data;
};

export const reiniciarMenu = async (disponible_hoy, tipo) => {
  const response = await api.post('/menu/reiniciar', { disponible_hoy, tipo });
  return response.data;
};