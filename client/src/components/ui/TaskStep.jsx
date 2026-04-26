import React from 'react';

const TaskStep = ({ step, title, subtitle, status = 'pending', onClick }) => {
  const isDone = status === 'done';
  const isActive = status === 'active';
  
  return (
    <div 
      className={`flex items-start gap-3 p-3 border rounded-xl transition-all cursor-pointer ${
        isActive ? 'border-purple bg-purple-light' : 'border-border hover:bg-surface2'
      }`}
      onClick={onClick}
    >
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
        isDone ? 'bg-accent text-white' : isActive ? 'bg-purple text-white' : 'bg-border2 text-text-muted'
      }`}>
        {isDone ? '✓' : step}
      </div>
      <div>
        <div className={`text-sm font-semibold ${isActive ? 'text-purple' : isDone ? 'text-text-primary' : 'text-text-secondary'}`}>
          {title}
        </div>
        {subtitle && (
          <div className="text-[11px] text-text-muted mt-0.5">
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskStep;
