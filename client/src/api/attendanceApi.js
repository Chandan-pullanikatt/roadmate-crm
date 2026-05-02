import api from './axios';

export const attendanceApi = {
  startWork: () => api.post('/attendance/start'),
  endWork: (attendanceId) => api.post('/attendance/complete', { attendanceId }),
  completeWork: (attendanceId) => api.post('/attendance/complete', { attendanceId }),
  getTodayAttendance: () => api.get('/attendance/today'),
  getAttendance: (params) => api.get('/attendance', { params }),
  getAttendanceSummary: (userId) => api.get(`/attendance/summary/${userId}`),
  editAttendance: (id, data) => api.put(`/attendance/${id}`, data),
  getTeamAttendance: (params) => api.get('/attendance/team', { params: typeof params === 'string' ? { date: params } : params }),
};

export default attendanceApi;
