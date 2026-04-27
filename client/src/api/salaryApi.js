import api from './axios';

export const salaryApi = {
  getSalaryReport: (params) => api.get('/dashboard/reports/salary', { params }),
  updateIncentives: (id, data) => api.put(`/dashboard/salary/${id}`, data),
  generateSalary: (month, year) => api.post('/dashboard/salary/generate', { month, year }),
};

export default salaryApi;
