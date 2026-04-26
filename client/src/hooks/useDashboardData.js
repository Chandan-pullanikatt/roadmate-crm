import { useState, useEffect } from 'react';
import api from '../api/axios';

export const useDashboardData = (role) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const url = role.startsWith('/') ? role : `/dashboard/${role}`;
      const response = await api.get(url);
      setData(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [role]);

  return { data, loading, error, refresh: fetchData };
};
