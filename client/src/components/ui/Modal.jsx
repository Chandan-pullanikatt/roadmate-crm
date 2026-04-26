import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

const Modal = ({ isOpen = true, title, children, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in"
      onClick={onClose}
    >
      <div 
        className="glass w-full max-w-lg rounded-[28px] shadow-lg overflow-hidden animate-in"
        style={{ animationDuration: '0.3s' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-8 py-6 border-b border-border flex items-center justify-between bg-surface/50">
          <div>
            <h2 className="text-xl font-extrabold text-text-primary tracking-tight">{title}</h2>
            <div className="h-1 w-12 bg-blue-gradient rounded-full mt-1" />
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface2 hover:bg-red-light hover:text-red transition-all duration-300 group"
          >
            <span className="text-lg group-hover:rotate-90 transition-transform">✕</span>
          </button>
        </div>
        <div className="p-8 max-h-[85vh] overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;

