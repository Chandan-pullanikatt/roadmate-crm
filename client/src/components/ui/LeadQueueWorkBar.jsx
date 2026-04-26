import React from 'react';

const LeadQueueWorkBar = ({ done = 0, total = 0 }) => {
  const percentage = total > 0 ? (done / total) * 100 : 0;
  
  let colorClass = 'bg-red';
  if (percentage >= 70) {
    colorClass = 'bg-accent'; // green
  } else if (percentage >= 30) {
    colorClass = 'bg-orange';
  }

  return (
    <div className="w-full glass p-5 rounded-2xl shadow-md border border-white/40 animate-in">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[10px] font-extrabold text-text-muted uppercase tracking-widest mb-1">Queue Velocity</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-text-primary tracking-tighter">{done}</span>
            <span className="text-xs font-bold text-text-muted">/ {total} <span className="opacity-60">Leads Handled</span></span>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-black text-white shadow-sm ${percentage >= 70 ? 'bg-accent-gradient' : percentage >= 30 ? 'bg-blue-gradient' : 'bg-red'}`}>
          {Math.round(percentage)}%
        </div>
      </div>
      
      <div className="relative h-3 w-full bg-surface3/50 rounded-full overflow-hidden border border-border">
        {/* Shimmer Effect */}
        <div className="absolute inset-0 shimmer opacity-20 z-0" />
        
        <div 
          className={`relative z-10 h-full transition-all duration-1000 ease-in-out rounded-full shadow-[0_0_12px_rgba(0,0,0,0.1)] ${percentage >= 70 ? 'bg-accent-gradient' : percentage >= 30 ? 'bg-blue-gradient' : 'bg-red'}`}
          style={{ width: `${percentage}%` }}
        >
          {/* Subtle Glow Tip */}
          <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/30 blur-sm" />
        </div>
      </div>
    </div>
  );
};

export default LeadQueueWorkBar;
