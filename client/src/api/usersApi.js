import api from './axios';

export const usersApi = {
  getUsers: (params) => api.get('/users', { params }),
  getUserById: (id) => api.get(`/users/${id}`),
  createStateManager: (data) => api.post('/users/create-state-manager', data),
  createIndustryManager: (data) => api.post('/users/create-industry-manager', data),
  createExecutive: (data) => api.post('/users/create-executive', data),
  updateUser: (id, data) => api.put(`/users/${id}`, data),
  deleteUser: (id) => api.delete(`/users/${id}`),
  addUserDocument: (id, metadata) => api.post(`/users/${id}/documents`, metadata),
};

export default usersApi;
