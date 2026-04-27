import api from './axios';

export const configApi = {
  getConfig: (key) => api.get(`/config/${key}`),
  saveConfig: (data) => api.post('/config', data),
};

export default configApi;
