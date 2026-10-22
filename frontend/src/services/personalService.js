import api from './api';

export const getPersonal = async () => {
  const response = await api.get('/personal');
  return response.data;
};

export const createPersonal = async (data) => {
  const response = await api.post('/personal', data);
  return response.data;
};

export const updatePersonal = async (id, data) => {
  const response = await api.patch(`/personal/${id}`, data);
  return response.data;
};