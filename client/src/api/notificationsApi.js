import api from './axios';

export const notificationsApi = {
  getNotifications: (params) => api.get('/notifications', { params }),
  markAsRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),

  /** Founder or manager: send a message to their own team */
  broadcast: (data) => api.post('/notifications/broadcast', data),
};
