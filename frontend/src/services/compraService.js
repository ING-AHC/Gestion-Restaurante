import api from './api';

export const getCompras = async () => {
  const response = await api.get('/compras');
  return response.data;
};

export const createCompra = async (data) => {
  const response = await api.post('/compras', data);
  return response.data;
};

export const marcarComoPagada = async (id) => {
  const response = await api.put(`/compras/${id}/pagar`);
  return response.data;
};