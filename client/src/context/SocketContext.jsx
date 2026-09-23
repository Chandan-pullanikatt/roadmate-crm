import React, { createContext, useEffect, useState, useContext } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext';

export const SocketContext = createContext();

// The socket talks to the API host, so it follows VITE_API_URL and moves with
// the backend instead of being pinned to one Render service.
const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/api\/?$/, '');

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const { user, token } = useContext(AuthContext);

  useEffect(() => {
    if (user && token) {
      const newSocket = io(SOCKET_URL, {
        auth: { token }
      });
      setSocket(newSocket);

      return () => newSocket.close();
    }
  }, [user, token]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};
