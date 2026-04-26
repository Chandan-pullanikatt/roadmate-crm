import api from './axios';

export const dashboardApi = {
  getExecutiveDashboard: () => api.get('/dashboard/executive'),
  getIndustryManagerDashboard: () => api.get('/dashboard/industry-manager'),
  getStateManagerDashboard: () => api.get('/dashboard/state-manager'),
  getFounderDashboard: () => api.get('/dashboard/founder'),
  getReport: (type, params) => api.get(`/dashboard/reports/${type}`, { params }),
};

export default dashboardApi;
