import api from './api';

export const getInsumos = async () => {
  const response = await api.get('/insumos');
  return response.data;
};

export const createInsumo = async (insumoData) => {
  const response = await api.post('/insumos', insumoData);
  return response.data;
};
export const deleteInsumo = async (id) => {
  const response = await api.delete(`/insumos/${id}`);
  return response.data;
};
export const updateInsumo = async (id, data) => {
  const response = await api.put(`/insumos/${id}`, data);
  return response.data;
};