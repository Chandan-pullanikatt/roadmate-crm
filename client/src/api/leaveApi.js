import api from './axios';

export const leaveApi = {
  requestLeave: (data) => api.post('/leave/request', data),
  applyLeave: (data) => api.post('/leave/request', data),
  getLeaves: (params) => api.get('/leave', { params }),
  approveLeave: (id) => api.put(`/leave/${id}/approve`),
  rejectLeave: (id, data) => api.put(`/leave/${id}/reject`, data),
  getLeaveBalance: (userId) => api.get(`/leave/balance/${userId}`),
  getLeavePolicy: (state) => api.get(`/leave/policy/${state}`),
  updateLeavePolicy: (data) => api.post('/leave/policy', data),
  getLeaveCalendar: (state, params) => api.get(`/leave/calendar/${state}`, { params }),
};

export default leaveApi;
