import api from './api';

export const getProductos = async () => {
  const response = await api.get('/productos');
  return response.data;
};

export const crearPedido = async (data) => {
  const response = await api.post('/pedidos', data);
  return response.data;
};

export const agregarItems = async (id, items) => {
  const response = await api.post(`/pedidos/${id}/items`, { items });
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

export const quitarItem = async (pedidoId, detalleId) => {
  const response = await api.delete(`/pedidos/${pedidoId}/items/${detalleId}`);
  return response.data;
};

export const editarItem = async (pedidoId, detalleId, cambios) => {
  const response = await api.patch(`/pedidos/${pedidoId}/items/${detalleId}`, cambios);
  return response.data;
};

export const cambiarMesa = async (pedidoId, mesa) => {
  const response = await api.patch(`/pedidos/${pedidoId}`, { mesa });
  return response.data;
};