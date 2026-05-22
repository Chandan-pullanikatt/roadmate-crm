import React from 'react';

const LeadFunnel = ({ stages = [] }) => {
  return (
    <div className="space-y-3">
      {stages.map((stage, idx) => (
        (() => {
          const pct = Number.isFinite(stage.pct) ? Math.min(100, Math.max(0, stage.pct)) : 0;
          return (
        <div key={idx} className="flex items-center gap-3">
          <div className="w-20 text-[11px] font-semibold text-text-secondary">{stage.label}</div>
          <div className="flex-1 h-6 bg-surface2 rounded-md overflow-hidden border border-border relative">
            <div 
              className="h-full rounded-md flex items-center px-2 transition-all duration-500"
              style={{ 
                width: `${pct}%`, 
                backgroundColor: stage.color || 'var(--purple)' 
              }}
            >
              {pct >= 20 && (
                <span className="text-[10px] font-mono font-bold text-white whitespace-nowrap">
                  {stage.val}
                </span>
              )}
            </div>
          </div>
          <div className="w-8 text-right text-[11px] font-mono text-text-muted">
            {stage.val}
          </div>
        </div>
          );
        })()
      ))}
    </div>
  );
};

export default LeadFunnel;
