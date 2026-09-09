import api from './api';

export const getProveedores = async () => {
  const response = await api.get('/proveedores');
  return response.data;
};

export const createProveedor = async (data) => {
  const response = await api.post('/proveedores', data);
  return response.data;
};
export const deleteProveedor = async (id) => {
  const response = await api.delete(`/proveedores/${id}`);
  return response.data;
};