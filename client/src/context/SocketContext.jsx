import React, { createContext, useEffect, useState, useContext } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext';

export const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const { user, token } = useContext(AuthContext);

  useEffect(() => {
    if (user && token) {
      const newSocket = io('https://roadmate-crm.onrender.com', {
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
