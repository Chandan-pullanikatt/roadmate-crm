import api from './axios';

export const targetsApi = {
  getMyTargets: (params) => api.get('/targets/my-targets', { params }),
  getTeamTargets: (params) => api.get('/targets/team', { params }),
  assignTarget: (data) => api.post('/targets/assign', data)
};
