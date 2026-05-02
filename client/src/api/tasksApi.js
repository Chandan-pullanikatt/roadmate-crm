import api from './axios';

export const tasksApi = {
  getTasks:     (params) => api.get('/tasks', { params }),
  createTask:   (data)   => api.post('/tasks', data),
  updateTask:   (id, data) => api.put(`/tasks/${id}`, data),
  completeTask: (id, notes) => api.patch(`/tasks/${id}/complete`, { notes }),
  deleteTask:   (id)   => api.delete(`/tasks/${id}`),
};

export default tasksApi;
