import React, { useState } from 'react';
import { roleLabel } from '../../../utils/roleLabel';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '../../../api/tasksApi';
import { usersApi } from '../../../api/usersApi';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';

const PRIORITY_META = {
  high:   { label: 'High',   color: '#DC2626', bg: '#FEF2F2' },
  medium: { label: 'Medium', color: '#D97706', bg: '#FFFBEB' },
  low:    { label: 'Low',    color: '#059669', bg: '#ECFDF5' },
};

const STATUS_META = {
  pending:     { label: 'Pending',     color: '#6B7280' },
  in_progress: { label: 'In Progress', color: '#3B82F6' },
  completed:   { label: 'Completed',   color: '#059669' },
  overdue:     { label: 'Overdue',     color: '#DC2626' },
};

// Higher number = more senior. The assignee list only offers people below you;
// the server enforces the same rule against the reporting tree.
const ROLE_RANK = { founder: 4, state_manager: 3, industry_manager: 2, executive: 1 };

// The founder can push one task to several people at once, so their form holds
// an array of assignees; every other role assigns to exactly one person.
const makeEmptyForm = (selfId = '', isFounder = false) => ({
  title: '', description: '', assignedTo: isFounder ? [selfId] : selfId,
  startDate: '', endDate: '', startTime: '09:30', endTime: '18:30',
  priority: 'medium', category: '',
});

const Tasks = () => {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const { user } = useAuth();
  const selfId = user?._id || '';
  const isExec = user?.role === 'executive';
  const isFounder = user?.role === 'founder';
  const emptyForm = makeEmptyForm(selfId, isFounder);
  const [filterStatus, setFilterStatus] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(() => makeEmptyForm(selfId, isFounder));
  const [saving, setSaving] = useState(false);

  const { data: taskData } = useQuery({
    queryKey: ['tasks', filterStatus],
    queryFn: () => tasksApi.getTasks({ status: filterStatus === 'all' ? undefined : filterStatus, limit: 100 }).then(r => r.data),
    staleTime: 60 * 1000,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users', 'all'],
    queryFn: () => usersApi.getUsers().then(r => r.data || []),
    staleTime: 10 * 60 * 1000,
    enabled: !isExec,
  });

  // Everyone this user is allowed to assign to, excluding themselves — the
  // server enforces the same rule against the reporting tree.
  const assignable = allUsers.filter(u =>
    u._id !== selfId && u.isActive !== false && (ROLE_RANK[u.role] || 0) < (ROLE_RANK[user?.role] || 0)
  );
  const everyoneIds = [selfId, ...assignable.map(u => u._id)];

  const toggleAssignee = (id) => setForm(f => ({
    ...f,
    assignedTo: f.assignedTo.includes(id) ? f.assignedTo.filter(x => x !== id) : [...f.assignedTo, id],
  }));

  const startMutation = useMutation({
    mutationFn: (id) => tasksApi.startTask(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); addToast('Task moved to In Progress', 'success'); },
    onError: () => addToast('Failed to update task', 'error'),
  });

  const completeMutation = useMutation({
    mutationFn: ({ id }) => tasksApi.completeTask(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); addToast('Task marked complete ✓', 'success'); },
    onError: () => addToast('Failed to update task', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => tasksApi.deleteTask(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); addToast('Task deleted', 'success'); },
    onError: () => addToast('Failed to delete task', 'error'),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.startDate || !form.endDate) {
      return addToast('Please fill all required fields', 'warning');
    }
    if (isFounder && !form.assignedTo.length) {
      return addToast('Pick at least one person to assign this task to', 'warning');
    }
    setSaving(true);
    try {
      const assignedTo = isFounder ? form.assignedTo : (form.assignedTo || selfId);
      await tasksApi.createTask({ ...form, assignedTo });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      addToast(
        isFounder && assignedTo.length > 1 ? `Task created for ${assignedTo.length} people!` : 'Task created!',
        'success'
      );
      setForm(emptyForm);
      setShowForm(false);
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to create task', 'error');
    } finally {
      setSaving(false);
    }
  };

  const tasks = taskData?.tasks || [];
  const STATUS_TABS = ['all', 'pending', 'in_progress', 'completed', 'overdue'];

  const fmt = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  const canDelete = (t) => user?.role === 'founder' || String(t.assignedBy?._id || t.assignedBy) === String(selfId);
  const isOverdue = (t) => t.status !== 'completed' && new Date(t.endDate) < new Date();

  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      {/* Header */}
      <div className="section-header">
        <div>
          <div className="section-title">Task Management</div>
          <div className="section-sub">{isExec ? 'Create and track your own tasks' : 'Create, assign and track tasks across all hierarchy levels'}</div>
        </div>
        <button
          className="btn btn-primary bg-[#0f766e] border-[#0f766e] px-6 font-bold"
          onClick={() => setShowForm(s => !s)}
        >
          {showForm ? '✕ Cancel' : '+ Create Task'}
        </button>
      </div>

      {/* Create Task Form */}
      {showForm && (
        <div className="card animate-in slide-in-from-top-2 duration-300">
          <div className="card-header border-b border-border bg-surface2/10">
            <div className="section-title text-sm">New Task</div>
          </div>
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 space-y-1">
                  <label className="form-label">Task Title *</label>
                  <input className="input" placeholder="e.g. Follow up with Kerala leads" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
                </div>
                <div className={isFounder ? 'md:col-span-2 space-y-1' : 'space-y-1'}>
                  <label className="form-label">Assign To *</label>
                  {isExec ? (
                    <input className="input" value="Myself" disabled />
                  ) : isFounder ? (
                    /* Founder only: pick several people and get one task each. */
                    <div className="border border-border rounded-xl overflow-hidden bg-surface2/30">
                      <div className="px-3 py-2 border-b border-border bg-surface flex items-center justify-between gap-3">
                        <span className="text-[11px] font-bold text-text-secondary">
                          {form.assignedTo.length} selected · one task is created for each person
                        </span>
                        <div className="flex gap-3 shrink-0">
                          <button type="button" className="text-[11px] font-bold text-[#0f766e] hover:underline"
                            onClick={() => setForm(f => ({ ...f, assignedTo: everyoneIds }))}>
                            Select everyone
                          </button>
                          <button type="button" className="text-[11px] font-bold text-text-muted hover:underline"
                            onClick={() => setForm(f => ({ ...f, assignedTo: [] }))}>
                            Clear
                          </button>
                        </div>
                      </div>
                      <div className="max-h-52 overflow-y-auto">
                        <label className="px-3 py-2 border-b border-border/50 flex items-center gap-3 cursor-pointer hover:bg-surface transition-colors">
                          <input type="checkbox" className="w-4 h-4 rounded accent-[#0f766e]"
                            checked={form.assignedTo.includes(selfId)} onChange={() => toggleAssignee(selfId)} />
                          <span className="text-sm font-bold text-text-primary">Myself</span>
                        </label>
                        {assignable.map(u => (
                          <label key={u._id} className="px-3 py-2 border-b border-border/50 last:border-0 flex items-center gap-3 cursor-pointer hover:bg-surface transition-colors">
                            <input type="checkbox" className="w-4 h-4 rounded accent-[#0f766e]"
                              checked={form.assignedTo.includes(u._id)} onChange={() => toggleAssignee(u._id)} />
                            <span className="text-sm text-text-primary">{u.name}</span>
                            <span className="text-[11px] text-text-muted ml-auto">{roleLabel(u.role)}</span>
                          </label>
                        ))}
                        {!assignable.length && (
                          <div className="px-3 py-2 text-xs text-text-muted">No other staff available yet.</div>
                        )}
                      </div>
                    </div>
                  ) : (
                  <select className="select" value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} required>
                    <option value={selfId}>Myself</option>
                    {assignable.map(u => (
                      <option key={u._id} value={u._id}>{u.name} — {roleLabel(u.role)}</option>
                    ))}
                  </select>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="form-label">Priority</label>
                  <select className="select" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="form-label">Start Date *</label>
                  <input type="date" className="input" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required />
                </div>
                <div className="space-y-1">
                  <label className="form-label">End Date *</label>
                  <input type="date" className="input" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} required />
                </div>
                <div className="space-y-1">
                  <label className="form-label">Start Time</label>
                  <input type="time" className="input" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="form-label">End Time</label>
                  <input type="time" className="input" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="form-label">Category</label>
                  <input className="input" placeholder="e.g. Sales, HR, Operations" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="form-label">Description</label>
                  <textarea className="textarea h-20" placeholder="Task details and instructions..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn btn-primary bg-[#0f766e] border-[#0f766e] px-8" disabled={saving}>
                  {saving ? 'Creating...' : 'Create Task'}
                </button>
                <button type="button" className="btn btn-outline px-6" onClick={() => { setShowForm(false); setForm(emptyForm); }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex bg-surface2 p-1 rounded-xl border border-border gap-1 w-fit">
        {STATUS_TABS.map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-4 py-1.5 text-[12px] font-bold uppercase tracking-widest rounded-lg transition-all ${filterStatus === s ? 'bg-surface text-[#0f766e] shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Task Cards */}
      {tasks.length === 0 ? (
        <div className="card p-16 text-center text-text-muted italic">
          No tasks found. Create one using the button above.
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => {
            const pm = PRIORITY_META[task.priority] || PRIORITY_META.medium;
            const sm = STATUS_META[isOverdue(task) ? 'overdue' : task.status] || STATUS_META.pending;
            return (
              <div key={task._id} className="card p-5 flex items-start gap-5 group hover:shadow-md transition-shadow">
                {/* Priority stripe */}
                <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: pm.color }} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <span className="font-bold text-[15px] text-text-primary">{task.title}</span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase" style={{ background: pm.bg, color: pm.color }}>{pm.label}</span>
                    <span className="text-[10px] font-bold" style={{ color: sm.color }}>{sm.label}</span>
                    {task.category && <span className="text-[12px] text-text-muted bg-surface2 px-2 py-0.5 rounded-full">{task.category}</span>}
                  </div>
                  {task.description && <p className="text-[14px] text-text-muted mb-2 line-clamp-2">{task.description}</p>}
                  <div className="flex items-center gap-4 text-[13px] text-text-muted flex-wrap">
                    <span>👤 <strong className="text-text-secondary">{task.assignedTo?.name}</strong> ({roleLabel(task.assignedTo?.role)})</span>
                    <span>📅 {fmt(task.startDate)} → {fmt(task.endDate)}</span>
                    <span>⏱ {task.startTime} – {task.endTime}</span>
                    <span>By: {task.assignedBy?.name}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {(task.status === 'pending' || task.status === 'overdue') && (
                    <button
                      className="text-[11px] font-bold text-[#3B82F6] border border-[#3B82F6]/20 px-3 py-1 rounded-lg hover:bg-[#EFF6FF] transition-colors"
                      onClick={() => startMutation.mutate(task._id)}
                      disabled={startMutation.isPending}
                    >
                      ▶ Start
                    </button>
                  )}
                  {task.status !== 'completed' && (
                    <button
                      className="text-[11px] font-bold text-[#059669] border border-[#059669]/20 px-3 py-1 rounded-lg hover:bg-[#ECFDF5] transition-colors"
                      onClick={() => completeMutation.mutate({ id: task._id })}
                    >
                      ✓ Done
                    </button>
                  )}
                  {canDelete(task) && (
                    <button
                      className="text-[11px] font-bold text-red border border-red/20 px-3 py-1 rounded-lg hover:bg-red/5 transition-colors"
                      onClick={() => deleteMutation.mutate(task._id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Tasks;
