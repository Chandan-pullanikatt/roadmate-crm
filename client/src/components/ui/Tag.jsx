import React from 'react';

const Tag = ({ children, label, variant = 'gray', className = '' }) => {
  const variants = {
    green: 'tag-green',
    blue: 'tag-blue',
    amber: 'tag-amber',
    red: 'tag-red',
    purple: 'tag-purple',
    gray: 'tag-gray',
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border inline-flex items-center gap-1 ${variants[variant] || variants.gray} ${className}`}>
      {children || label}
    </span>
  );
};

export default Tag;

