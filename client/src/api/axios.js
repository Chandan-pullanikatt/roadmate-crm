import axios from 'axios';

const getBaseURL = () => {
  let url = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  if (!url.endsWith('/api')) {
    url = url.endsWith('/') ? `${url}api` : `${url}/api`;
  }
  return url;
};

const api = axios.create({
  baseURL: getBaseURL(),
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// A deactivated account is rejected on its next request; drop the session.
// The login call itself is left alone so the form can show the message.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const { response, config } = error;
    if (response?.status === 403 && response.data?.code === 'ACCOUNT_INACTIVE' && !config?.url?.includes('/auth/login')) {
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
