import api from './api';

export const getProductos = async () => {
  const response = await api.get('/productos');
  return response.data;
};

export const createProducto = async (data) => {
  const response = await api.post('/productos', data);
  return response.data;
};

export const asignarInsumosAProducto = async (productoId, insumos) => {
  const response = await api.post(`/productos/${productoId}/insumos`, { insumos });
  return response.data;
};

export const deleteProducto = async (id) => {
  const response = await api.delete(`/productos/${id}`);
  return response.data;
};
export const updateProducto = async (id, data) => {
  const response = await api.put(`/productos/${id}`, data);
  return response.data;
};