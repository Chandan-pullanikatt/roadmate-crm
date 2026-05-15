import api from './axios';

export const leadsApi = {
  getLeads: (params) => api.get('/leads', { params }),
  getLeadById: (id) => api.get(`/leads/${id}`),
  createLead: (data) => api.post('/leads', data),
  bulkUpload: (leadsArray) => api.post('/leads/bulk', leadsArray),
  updateLead: (id, data) => api.put(`/leads/${id}`, data),
  deleteLead: (id) => api.delete(`/leads/${id}`),
  transitionLead: (id, action, data) => api.post(`/leads/${id}/transition`, { action, ...data }),
  getLeadQueue: (userId) => api.get('/leads/queue', userId ? { params: { userId } } : {}),
  getSuggestedDates: () => api.get('/leads/suggested-dates'),
  getLeadActivity: (id) => api.get(`/leads/${id}/activity`),
  allocateLead: (id, ownerId) => api.put(`/leads/${id}/allocate`, { ownerId }),
  addLeadDocument: (id, metadata) => api.post(`/leads/${id}/documents`, metadata),
  getCounts: (params) => api.get('/leads/counts', { params }),
  bulkAllocate: (data) => api.patch('/leads/bulk-allocate', data),
};

export default leadsApi;
