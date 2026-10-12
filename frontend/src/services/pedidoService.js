import api from './api';

export const getProductos = async () => {
  const response = await api.get('/productos');
  return response.data;
};

export const crearPedido = async (data) => {
  const response = await api.post('/pedidos', data);
  return response.data;
};

export const getPedidos = async (estado) => {
  const response = await api.get('/pedidos', { params: estado ? { estado } : {} });
  return response.data;
};

export const cambiarEstado = async (id, estado) => {
  const response = await api.patch(`/pedidos/${id}/estado`, { estado });
  return response.data;
};

export const confirmarPedido = async (id, body = {}) => {
  const response = await api.post(`/pedidos/${id}/confirmar`, body);
  return response.data;
};