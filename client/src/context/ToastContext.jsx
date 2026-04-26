import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success', duration = 3000) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    
    setTimeout(() => {
      removeToast(id);
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-3">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`
                flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-lg glass border-l-4 min-w-[280px]
                ${toast.type === 'success' ? 'border-l-accent' : ''}
                ${toast.type === 'error' ? 'border-l-red' : ''}
                ${toast.type === 'warning' ? 'border-l-amber' : ''}
              `}
            >
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-lg
                ${toast.type === 'success' ? 'bg-accent-light text-accent' : ''}
                ${toast.type === 'error' ? 'bg-red-light text-red' : ''}
                ${toast.type === 'warning' ? 'bg-amber-light text-amber' : ''}
              `}>
                {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : '!'}
              </div>
              <div className="flex-1">
                <div className="text-xs font-bold text-text-muted uppercase tracking-wider mb-0.5">{toast.type}</div>
                <div className="text-sm font-semibold text-text-primary leading-tight">{toast.message}</div>
              </div>
              <button 
                onClick={() => removeToast(toast.id)}
                className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-surface2 transition-colors text-text-muted"
              >
                ✕
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};
