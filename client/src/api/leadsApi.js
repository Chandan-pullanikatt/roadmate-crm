import api from './axios';

export const leadsApi = {
  getLeads: (params) => api.get('/leads', { params }),
  getLeadById: (id) => api.get(`/leads/${id}`),
  createLead: (data) => api.post('/leads', data),
  bulkUpload: (leadsArray) => api.post('/leads/bulk', leadsArray),
  updateLead: (id, data) => api.put(`/leads/${id}`, data),
  updateLeadDetails: (id, data) => api.patch(`/leads/${id}/details`, data),
  deleteLead: (id) => api.delete(`/leads/${id}`),
  transitionLead: (id, action, data) => api.post(`/leads/${id}/transition`, { action, ...data }),
  getLeadQueue: (userId) => api.get('/leads/queue', userId ? { params: { userId } } : {}),
  getSuggestedDates: () => api.get('/leads/suggested-dates'),
  // Every activity timeline shares the ['lead-activity', id] cache, so the shape
  // is normalised to a plain array here instead of in each caller -- mixing
  // `r.data` and `r.data.activities` across components meant whichever one
  // fetched first decided what the others read out of the cache.
  getLeadActivity: (id) =>
    api.get(`/leads/${id}/activity`).then((res) => ({
      ...res,
      data: Array.isArray(res.data) ? res.data : (res.data?.activities || []),
    })),
  allocateLead: (id, ownerId) => api.put(`/leads/${id}/allocate`, { ownerId }),
  addLeadDocument: (id, metadata) => api.post(`/leads/${id}/documents`, metadata),
  getCounts: (params) => api.get('/leads/counts', { params }),
  bulkAllocate: (data) => api.patch('/leads/bulk-allocate', data),
  bulkEscalate: (data) => api.patch('/leads/bulk-escalate', data),
  // Escalations waiting on the logged-in manager's approval. An escalated lead
  // stays with the owner who sent it up until it is approved here.
  getPendingEscalations: () => api.get('/leads/escalations/pending'),
  getPendingEscalationCount: () => api.get('/leads/escalations/pending-count'),
  decideEscalation: (id, decision, note) =>
    api.post(`/leads/${id}/escalation/decision`, { decision, note }),
};

export default leadsApi;
