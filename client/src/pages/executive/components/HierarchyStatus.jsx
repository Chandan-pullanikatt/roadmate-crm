import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { usersApi } from '../../../api/usersApi';
import { Avatar } from '../../../components/ui';
import { useToast } from '../../../context/ToastContext';

const STORAGE_KEY = 'hierarchy_statuses';
const REMARKS_KEY  = 'hierarchy_remarks';

const HierarchyStatus = () => {
  const navigate   = useNavigate();
  const { addToast } = useToast();

  const [statuses, setStatuses] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch { return {}; }
  });
  const [remarks, setRemarks] = useState(() => localStorage.getItem(REMARKS_KEY) || '');

  const { data: hierarchy, isLoading } = useQuery({
    queryKey: ['users', 'hierarchy'],
    queryFn: () => usersApi.getHierarchy().then(res => res.data)
  });

  const handleStatusChange = (userId, status) => {
    setStatuses(prev => ({ ...prev, [userId]: status }));
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(statuses));
    localStorage.setItem(REMARKS_KEY, remarks);
    addToast('Hierarchy statuses saved', 'success');
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-64 font-black text-orange animate-pulse">
      INITIALIZING HIERARCHY...
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-[32px] border border-border shadow-2xl overflow-hidden relative">

        {/* Header */}
        <div className="p-8 border-b border-border flex justify-between items-start">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-2xl shadow-sm">📖</div>
            <h1 className="text-2xl font-black tracking-tight text-text-primary">Hierarchy Lead Status Management</h1>
          </div>
          <button
            className="w-10 h-10 rounded-full hover:bg-surface flex items-center justify-center text-muted text-xl transition-colors"
            onClick={() => navigate(-1)}
          >✕</button>
        </div>

        {/* Banner */}
        <div className="px-8 pb-4 pt-6">
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-4">
            <div className="text-blue-600 text-xl">ℹ️</div>
            <p className="text-sm font-medium text-blue-700 leading-relaxed">
              Set lead status for executives, managers, or state-level hierarchy. This allows founders and managers to track and update status across all levels.
            </p>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-8 space-y-10 max-h-[60vh] overflow-y-auto custom-scrollbar">

          <div>
            <div className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-6">District Executives</div>
            <div className="space-y-4">
              {hierarchy?.executives?.map(user => (
                <HierarchyUserRow
                  key={user._id}
                  user={user}
                  statuses={['Active', 'RNR', 'Future Lead', 'On Leave']}
                  activeStatus={statuses[user._id] || 'Active'}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-6">Industry Managers</div>
            <div className="space-y-4">
              {hierarchy?.industryManagers?.map(user => (
                <HierarchyUserRow
                  key={user._id}
                  user={user}
                  statuses={['Active', 'RNR', 'Future Lead', 'Reviewing']}
                  activeStatus={statuses[user._id] || 'Active'}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-6">State Managers</div>
            <div className="space-y-4">
              {hierarchy?.stateManagers?.map(user => (
                <HierarchyUserRow
                  key={user._id}
                  user={user}
                  statuses={['Active', 'RNR', 'Future Lead', 'Closed']}
                  activeStatus={statuses[user._id] || 'Active'}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          </div>

          <div className="pt-4">
            <div className="text-[11px] font-black text-text-primary uppercase mb-4">Notes / Remarks for Hierarchy</div>
            <textarea
              className="w-full bg-surface border border-border rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-orange/20 focus:border-orange outline-none min-h-[100px] transition-all"
              placeholder="Add notes visible to the selected hierarchy members..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 bg-white border-t border-border flex justify-end gap-4">
          <button
            className="px-8 py-3 text-sm font-black text-muted hover:text-text-primary transition-colors"
            onClick={() => navigate(-1)}
          >Close</button>
          <button
            className="px-10 py-3 bg-[#B45309] hover:bg-[#92400E] text-white text-sm font-black rounded-xl shadow-lg shadow-orange/20 transition-all"
            onClick={handleSave}
          >Save All Status</button>
        </div>
      </div>
    </div>
  );
};

const HierarchyUserRow = ({ user, statuses, activeStatus, onStatusChange }) => (
  <div className="bg-white border border-border rounded-2xl p-4 flex items-center justify-between hover:shadow-sm transition-shadow group">
    <div className="flex items-center gap-4">
      <Avatar
        name={user.name}
        size="lg"
        className={
          user.role === 'executive' ? 'bg-orange/10 text-orange-700' :
          user.role === 'industry_manager' ? 'bg-blue/10 text-blue-700' :
          'bg-purple/10 text-purple-700'
        }
      />
      <div>
        <div className="text-sm font-black text-text-primary group-hover:text-orange transition-colors">{user.name}</div>
        <div className="text-[10px] font-bold text-muted uppercase tracking-tight">
          {user.role === 'executive' ? 'District Executive' : user.role === 'industry_manager' ? 'Industry Manager' : 'State Manager'} · {user.state || '—'}
        </div>
      </div>
    </div>

    <div className="flex items-center gap-1.5 p-1 bg-surface2 rounded-xl">
      {statuses.map(status => (
        <button
          key={status}
          onClick={() => onStatusChange(user._id, status)}
          className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
            activeStatus === status
              ? 'bg-[#B45309] text-white shadow-md'
              : 'text-muted hover:text-text-primary hover:bg-white'
          }`}
        >
          {status}
        </button>
      ))}
    </div>
  </div>
);

export default HierarchyStatus;
