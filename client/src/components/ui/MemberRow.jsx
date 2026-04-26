import React from 'react';
import Avatar from './Avatar';
import PerformanceMeter from './PerformanceMeter';
import Tag from './Tag';

const MemberRow = ({ 
  name, 
  meta, 
  avatar, 
  avatarClass, 
  workPct, 
  metrics = [], 
  status, 
  statusVariant,
  actions,
  onClick 
}) => {
  return (
    <div 
      className="flex items-center gap-3 p-3 px-4 border-b border-border last:border-b-0 hover:bg-surface2 transition-colors cursor-pointer group"
      onClick={onClick}
    >
      <Avatar name={name} className={avatarClass} size="md" />
      
      <div className="flex-1 min-width-0">
        <div className="text-sm font-semibold text-text-primary group-hover:text-purple transition-colors">{name}</div>
        <div className="text-[11px] text-text-muted">{meta}</div>
        <div className="mt-1.5 max-w-[120px]">
          <PerformanceMeter value={workPct} size="sm" showValue />
        </div>
      </div>
      
      <div className="flex items-center gap-4 shrink-0">
        {metrics.map((m, idx) => (
          <div key={idx} className="text-center min-w-[32px]">
            <div className={`font-mono text-xs font-bold ${m.colorClass || 'text-text-primary'}`}>{m.value}</div>
            <div className="text-[9px] text-text-muted uppercase tracking-wider">{m.label}</div>
          </div>
        ))}
      </div>
      
      <div className="flex items-center gap-2 shrink-0 ml-2">
        <Tag variant={statusVariant || (status === 'Active' ? 'green' : 'amber')} label={status} />
        {actions}
      </div>
    </div>
  );
};

export default MemberRow;
