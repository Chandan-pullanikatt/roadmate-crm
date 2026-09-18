import api from './axios';

export const dashboardApi = {
  getExecutiveDashboard: () => api.get('/dashboard/executive'),
  getIndustryManagerDashboard: (period, value) => api.get('/dashboard/industry-manager', { params: period ? { period, value } : {} }),
  getStateManagerDashboard: (options = {}) => api.get('/dashboard/state-manager', { params: options }),
  getFounderDashboard: (options = {}) => api.get('/dashboard/founder', { params: options }),
  getDistrictManagerDashboard: (options = {}) => api.get('/dashboard/district-manager', { params: options }),
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
