import React from 'react';

const StatCard = ({ label, value, delta, deltaType, colorClass = 'accent' }) => {
  const isUp = deltaType === 'up';
  
  // Map color class to CSS variables
  const colorVar = `var(--${colorClass})`;
  const bgLightVar = `var(--${colorClass}-light)`;

  return (
    <div className={`stat-card group relative h-full animate-in ${colorClass === 'glass' ? 'glass' : ''}`}>
      {/* Decorative Gradient Background (Subtle) */}
      <div className={`absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full blur-3xl opacity-10 transition-opacity group-hover:opacity-20 bg-${colorClass}`} />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <span className="stat-label">{label}</span>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-${colorClass}-light text-${colorClass} shadow-sm`}>
            {/* Dynamic Icon placeholder or based on colorClass */}
            <span className="text-sm">⚡</span>
          </div>
        </div>
        
        <div className="stat-value">{value}</div>
        
        {delta && (
          <div className="flex items-center gap-2 mt-2">
            <div className={`stat-delta ${isUp ? 'delta-up' : 'delta-down'}`}>
              <span className="text-[10px]">{isUp ? '▲' : '▼'}</span>
              <span>{delta}</span>
            </div>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-tighter">vs last month</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
