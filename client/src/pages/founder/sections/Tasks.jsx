import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '../../../api/tasksApi';
import { usersApi } from '../../../api/usersApi';
import { useToast } from '../../../context/ToastContext';

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

const emptyForm = {
  title: '', description: '', assignedTo: '',
  startDate: '', endDate: '', startTime: '09:30', endTime: '18:30',
  priority: 'medium', category: '',
};

const Tasks = () => {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [filterStatus, setFilterStatus] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
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
    if (!form.title || !form.assignedTo || !form.startDate || !form.endDate) {
      return addToast('Please fill all required fields', 'warning');
    }
    setSaving(true);
    try {
      await tasksApi.createTask(form);
      qc.invalidateQueries({ queryKey: ['tasks'] });
      addToast('Task created!', 'success');
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
  const isOverdue = (t) => t.status !== 'completed' && new Date(t.endDate) < new Date();

  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      {/* Header */}
      <div className="section-header">
        <div>
          <div className="section-title">Task Management</div>
          <div className="section-sub">Create, assign and track tasks across all hierarchy levels</div>
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
                <div className="space-y-1">
                  <label className="form-label">Assign To *</label>
                  <select className="select" value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} required>
                    <option value="">Select Staff Member</option>
                    {allUsers.filter(u => u.role !== 'founder').map(u => (
                      <option key={u._id} value={u._id}>{u.name} — {u.role?.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
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
            className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${filterStatus === s ? 'bg-surface text-[#0f766e] shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
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
                    {task.category && <span className="text-[10px] text-text-muted bg-surface2 px-2 py-0.5 rounded-full">{task.category}</span>}
                  </div>
                  {task.description && <p className="text-xs text-text-muted mb-2 line-clamp-2">{task.description}</p>}
                  <div className="flex items-center gap-4 text-[11px] text-text-muted flex-wrap">
                    <span>👤 <strong className="text-text-secondary">{task.assignedTo?.name}</strong> ({task.assignedTo?.role?.replace(/_/g, ' ')})</span>
                    <span>📅 {fmt(task.startDate)} → {fmt(task.endDate)}</span>
                    <span>⏱ {task.startTime} – {task.endTime}</span>
                    <span>By: {task.assignedBy?.name}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {task.status !== 'completed' && (
                    <button
                      className="text-[11px] font-bold text-[#059669] border border-[#059669]/20 px-3 py-1 rounded-lg hover:bg-[#ECFDF5] transition-colors"
                      onClick={() => completeMutation.mutate({ id: task._id })}
                    >
                      ✓ Done
                    </button>
                  )}
                  <button
                    className="text-[11px] font-bold text-red border border-red/20 px-3 py-1 rounded-lg hover:bg-red/5 transition-colors"
                    onClick={() => deleteMutation.mutate(task._id)}
                  >
                    Delete
                  </button>
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
