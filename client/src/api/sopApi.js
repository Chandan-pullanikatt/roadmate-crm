import api from './axios';

export const sopApi = {
  /** Every document published for a role, each with a presigned view URL */
  getDocuments: (role) => api.get('/sop', { params: { role } }),

  /** Founder: save a document record after the direct-to-R2 upload */
  saveDocument: (data) => api.post('/sop', data),

  /** Founder: every document across roles, for the management page */
  getAllDocuments: () => api.get('/sop/all'),

  /** Founder: remove a document from the list */
  deleteDocument: (id) => api.delete(`/sop/${id}`),
};

export default sopApi;
