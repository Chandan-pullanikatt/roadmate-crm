import api from './axios';

export const attendanceApi = {
  startWork: () => api.post('/attendance/start'),
  completeWork: (id) => api.post(`/attendance/complete/${id}`),
  getTodayAttendance: () => api.get('/attendance/today'),
  getAttendance: (params) => api.get('/attendance', { params }),
  getAttendanceSummary: (userId) => api.get(`/attendance/summary/${userId}`),
  editAttendance: (id, data) => api.put(`/attendance/${id}`, data),
};

export default attendanceApi;
