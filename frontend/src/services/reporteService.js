import api from './api';

export const getResumenFinanciero = async (mes, anio) => {
  const params = mes && anio ? { mes, anio } : {};
  const response = await api.get('/reportes/resumen', { params });
  return response.data;
};

export const getDeudasProveedores = async () => {
  const response = await api.get('/reportes/deudas-proveedores');
  return response.data;
};

export const getGastosPorCategoria = async (mes, anio) => {
  const params = mes && anio ? { mes, anio } : {};
  const response = await api.get('/reportes/gastos-categoria', { params });
  return response.data;
};