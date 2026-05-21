import api from './axios';

export const dashboardApi = {
  getExecutiveDashboard: () => api.get('/dashboard/executive'),
  getIndustryManagerDashboard: (period, value) => api.get('/dashboard/industry-manager', { params: period ? { period, value } : {} }),
  getStateManagerDashboard: () => api.get('/dashboard/state-manager'),
  getFounderDashboard: (options = {}) => api.get('/dashboard/founder', { params: options }),
  getReport: (type, params) => api.get(`/dashboard/reports/${type}`, { params }),
  getActivities: (type, params) => api.get('/dashboard/reports/activities', { params: { type, ...params } }),
  getAttendanceSummary: (params) => api.get('/dashboard/reports/attendance-summary', { params }),
  getMeetings: () => api.get('/dashboard/meetings'),
  getPerformance: (params) => api.get('/dashboard/performance', { params }),
  generateSalary: (data) => api.post('/dashboard/salary/generate', data),
  updateSalary: (id, data) => api.put(`/dashboard/salary/${id}`, data),
  saveStrategy: (data) => api.post('/dashboard/strategy', data),
  getRevenueDashboard: (period, value) => api.get('/dashboard/revenue', { params: { period, value } }),
};

export default dashboardApi;
