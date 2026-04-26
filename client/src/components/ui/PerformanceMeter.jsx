import React from 'react';

const PerformanceMeter = ({ value = 0, color = 'var(--accent)' }) => {
  const percentage = Math.min(100, Math.max(0, value));

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Performance</span>
        <span className="text-xs font-bold text-text-primary">{percentage}%</span>
      </div>
      <div className="h-2 w-full bg-surface2 rounded-full overflow-hidden border border-border/50">
        <div 
          className="h-full transition-all duration-500 ease-out rounded-full"
          style={{ 
            width: `${percentage}%`,
            backgroundColor: color,
            boxShadow: `0 0 10px ${color}40`
          }}
        />
      </div>
    </div>
  );
};

export default PerformanceMeter;
