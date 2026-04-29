import api from './axios';

export const leaveApi = {
  getLeaves: (params) => api.get('/leaves', { params }),
  getPendingLeaves: () => api.get('/leaves/pending'),
  getTeamLeaves: (params) => api.get('/leaves', { params }),
  approveLeave: (id) => api.patch(`/leaves/${id}/approve`),
  rejectLeave: (id, data) => api.patch(`/leaves/${id}/reject`, data),
   createLeave: (data) => api.post('/leaves', data),
   applyLeave: (data) => api.post('/leaves', data),
   requestLeave: (data) => api.post('/leaves', data),
   getLeaveBalance: (userId) => api.get(`/leaves/balance/${userId}`),
   getLeavePolicy: (state) => api.get(`/leaves/policy/${state}`),
   updateLeavePolicy: (data) => api.post('/leaves/policy', data),
   getLeaveCalendar: (state, params) => api.get(`/leaves/calendar/${state}`, { params }),
};

export default leaveApi;
