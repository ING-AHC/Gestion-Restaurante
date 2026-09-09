import api from './api';

export const getCategoriasGasto = async () => {
  const response = await api.get('/categorias-gasto');
  return response.data;
};

export const createCategoriaGasto = async (data) => {
  const response = await api.post('/categorias-gasto', data);
  return response.data;
};
export const deleteCategoriaGasto = async (id) => {
  const response = await api.delete(`/categorias-gasto/${id}`);
  return response.data;
};