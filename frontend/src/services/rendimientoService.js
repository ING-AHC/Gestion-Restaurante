import api from './api';

export const getRendimientos = async () => {
  const response = await api.get('/rendimientos');
  return response.data;
};

export const createRendimiento = async (data) => {
  const response = await api.post('/rendimientos', data);
  return response.data;
};