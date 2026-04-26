import React from 'react';

const Avatar = ({ initials, colorClass = 'accent' }) => {
  const variants = {
    state: 'av-state',
    industry: 'av-ind',
    executive: 'av-exec',
    green: 'av-green',
    teal: 'av-teal',
    accent: 'bg-accent-gradient',
  };

  return (
    <div className={`avatar ${variants[colorClass] || variants.accent}`}>
      {initials?.toUpperCase() || '?'}
    </div>
  );
};

export default Avatar;
