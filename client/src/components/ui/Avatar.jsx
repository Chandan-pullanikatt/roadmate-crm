import React from 'react';

const SIZES = { xs: 24, sm: 32, md: 40, lg: 56, xl: 72 };

const getInitials = (name) => {
  if (!name) return '';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('');
};

const Avatar = ({ initials, name, size = 'md', colorClass = 'accent', className = '' }) => {
  const variants = {
    state: 'av-state',
    industry: 'av-ind',
    executive: 'av-exec',
    green: 'av-green',
    teal: 'av-teal',
    accent: 'bg-accent-gradient',
  };

  const px = SIZES[size] || SIZES.md;
  const label = (initials || getInitials(name) || '?').toUpperCase();

  return (
    <div
      className={`avatar ${variants[colorClass] || variants.accent} ${className}`}
      style={{ width: px, height: px, flexShrink: 0, fontSize: Math.max(10, Math.round(px * 0.36)) }}
      title={name || undefined}
    >
      {label}
    </div>
  );
};

export default Avatar;
