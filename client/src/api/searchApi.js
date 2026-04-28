import api from './axios';

export const searchApi = {
  globalSearch: (query) => api.get('/search', { params: { q: query } }),
};

export default searchApi;
