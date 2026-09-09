import api from './api';

export const getVentas = async () => {
  const response = await api.get('/ventas');
  return response.data;
};

export const createVenta = async (data) => {
  const response = await api.post('/ventas', data);
  return response.data;
};