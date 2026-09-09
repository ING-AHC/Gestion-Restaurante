import api from './api';

export const getPlatos = async () => {
  const response = await api.get('/platos');
  return response.data;
};

export const createPlato = async (data) => {
  const response = await api.post('/platos', data);
  return response.data;
};

export const asignarInsumosAPlato = async (platoId, insumos) => {
  const response = await api.post(`/platos/${platoId}/insumos`, { insumos });
  return response.data;
};
export const deletePlato = async (id) => {
  const response = await api.delete(`/platos/${id}`);
  return response.data;
};