import api from './axios';

export const dashboardApi = {
  getExecutiveDashboard: () => api.get('/dashboard/executive'),
  getIndustryManagerDashboard: () => api.get('/dashboard/industry-manager'),
  getStateManagerDashboard: () => api.get('/dashboard/state-manager'),
  getFounderDashboard: (params) => api.get('/dashboard/founder', { params }),
  getReport: (type, params) => api.get(`/dashboard/reports/${type}`, { params }),
  getAttendanceSummary: (params) => api.get('/dashboard/reports/attendance-summary', { params }),
  generateSalary: (data) => api.post('/dashboard/salary/generate', data),
  updateSalary: (id, data) => api.put(`/dashboard/salary/${id}`, data),
};

export default dashboardApi;
