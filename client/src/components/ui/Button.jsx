import React from 'react';

const Button = ({ 
  variant = 'primary', 
  size = 'md', 
  onClick, 
  loading, 
  disabled, 
  children,
  className = '',
  type = 'button'
}) => {
  const variants = {
    primary: 'btn-primary',
    outline: 'btn-outline',
    ghost: 'hover:bg-surface2 text-text-secondary',
    danger: 'bg-red text-white hover:bg-red/90',
  };

  const sizes = {
    xs: 'h-7 px-2 text-[10px] uppercase tracking-wider',
    sm: 'btn-sm',
    md: '',
  };

  const baseStyles = 'btn transition-all disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseStyles} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
    >
      {loading ? (
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          <span>Loading...</span>
        </div>
      ) : children}
    </button>
  );
};

export default Button;
