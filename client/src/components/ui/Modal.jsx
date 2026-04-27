import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

const Modal = ({ isOpen = true, title, subtitle, children, onClose, className = "" }) => {
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
        className={`bg-white w-full rounded-[28px] shadow-2xl overflow-hidden animate-in ${className}`}
        style={{ animationDuration: '0.3s' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-8 py-6 border-b border-border flex items-start justify-between bg-white">
          <div>
            <h2 className="text-xl font-bold text-text-primary">{title}</h2>
            {subtitle && <p className="text-sm text-text-muted mt-0.5">{subtitle}</p>}
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-border hover:bg-gray-100 transition-all"
          >
            <span className="text-sm text-text-muted">✕</span>
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

