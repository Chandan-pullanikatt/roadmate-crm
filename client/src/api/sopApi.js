import api from './axios';

export const sopApi = {
  /** Fetch SOP metadata + presigned view URL for a role */
  getSop: (role) => api.get('/sop', { params: { role } }),

  /** Founder: save SOP record after direct-to-R2 upload */
  saveSop: (data) => api.post('/sop', data),

  /** Founder: get both SOPs for the management page */
  getAllSops: () => api.get('/sop/all'),
};

export default sopApi;
