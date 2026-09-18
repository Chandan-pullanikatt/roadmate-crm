import React, { createContext, useState, useEffect } from 'react';
import api from '../api/axios';
import { syncPushSubscription, disablePush } from '../utils/push';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api.get('/auth/me')
        .then(res => setUser(res.data))
        .catch(() => {
          localStorage.removeItem('token');
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  // Point this browser's push subscription at whoever is now logged in.
  useEffect(() => {
    if (user?._id) syncPushSubscription();
  }, [user?._id]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = async () => {
    // Stop pushes to this device before the token goes — a shared browser
    // shouldn't keep receiving the previous user's notifications.
    try { await disablePush(); } catch { /* logging out regardless */ }
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    // Hard redirect to ensure all state is cleared and user is sent to login
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      login, 
      logout, 
      loading,
      isAuthenticated: !!user 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
