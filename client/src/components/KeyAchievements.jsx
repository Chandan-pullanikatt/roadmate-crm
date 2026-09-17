import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const ICONS = ['⭐', '🏆', '💰', '📈', '🎯', '🔥', '🥇', '👏'];
const MAX_ACHIEVEMENTS = 10;
const emptyRow = () => ({ icon: '⭐', title: '', description: '' });

/**
 * Key Achievements on a profile page. Everyone sees them; only the Founder can
 * add, edit or remove them.
 */
const KeyAchievements = ({ userId, achievements = [], queryKey }) => {
  const { user: currentUser } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState([]);
  const [saving, setSaving] = useState(false);

  const canEdit = currentUser?.role === 'founder';

  const startEditing = () => {
    setDraft(achievements.length ? achievements.map(a => ({ ...a })) : [emptyRow()]);
    setEditing(true);
  };

  const updateRow = (idx, field, value) =>
    setDraft(rows => rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/users/${userId}/achievements`, {
        achievements: draft.filter(a => a.title.trim())
      });
      await queryClient.invalidateQueries({ queryKey });
      addToast('Achievements saved', 'success');
      setEditing(false);
    } catch (err) {
      addToast(err.response?.data?.message || 'Error saving achievements', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-[18px] font-bold flex items-center gap-2">
          <span className="text-amber">🏆</span> Key Achievements
        </h3>
        {canEdit && !editing && (
          <button onClick={startEditing} className="text-[12px] font-bold text-blue hover:underline">
            {achievements.length ? 'Edit' : '+ Add'}
          </button>
        )}
      </div>

      {!editing && (
        <div className="space-y-4">
          {achievements.map((a, idx) => (
            <div key={a._id || idx} className="flex items-start gap-3 p-3 rounded-xl hover:bg-surface2 transition-colors cursor-default border border-transparent hover:border-border">
              <div className="w-8 h-8 rounded-lg bg-surface2 flex items-center justify-center text-lg shrink-0">{a.icon || '⭐'}</div>
              <div>
                <div className="text-[14px] font-bold text-text-primary">{a.title}</div>
                {a.description && <div className="text-[12px] text-text-muted font-medium">{a.description}</div>}
              </div>
            </div>
          ))}
          {achievements.length === 0 && (
            <div className="text-[13px] text-text-muted italic text-center py-4">
              No achievements yet.{canEdit ? ' Click “+ Add” to set one.' : ''}
            </div>
          )}
        </div>
      )}

      {editing && (
        <div className="space-y-4">
          {draft.map((row, idx) => (
            <div key={idx} className="p-3 rounded-xl border border-border bg-surface2/30 space-y-2">
              <div className="flex gap-2">
                <select
                  className="bg-white border border-border rounded-lg px-2 py-1.5 text-[16px] outline-none focus:border-blue"
                  value={row.icon}
                  onChange={e => updateRow(idx, 'icon', e.target.value)}
                >
                  {ICONS.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
                <input
                  className="flex-1 min-w-0 bg-white border border-border rounded-lg px-3 py-1.5 text-[13px] font-bold outline-none focus:border-blue"
                  placeholder="Title (e.g. Top Performer — Q3)"
                  maxLength={80}
                  value={row.title}
                  onChange={e => updateRow(idx, 'title', e.target.value)}
                />
                <button
                  onClick={() => setDraft(rows => rows.filter((_, i) => i !== idx))}
                  className="text-red text-[12px] font-bold px-2 hover:underline"
                  title="Remove"
                >
                  Remove
                </button>
              </div>
              <input
                className="w-full bg-white border border-border rounded-lg px-3 py-1.5 text-[12px] outline-none focus:border-blue"
                placeholder="Short description (optional)"
                maxLength={200}
                value={row.description || ''}
                onChange={e => updateRow(idx, 'description', e.target.value)}
              />
            </div>
          ))}

          {draft.length < MAX_ACHIEVEMENTS && (
            <button
              onClick={() => setDraft(rows => [...rows, emptyRow()])}
              className="w-full border border-dashed border-border rounded-xl py-2 text-[12px] font-bold text-text-muted hover:border-blue hover:text-blue transition-colors"
            >
              + Add achievement
            </button>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setEditing(false)}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg border border-border text-[12px] font-bold text-text-secondary hover:bg-surface2"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-[#0f766e] text-white text-[12px] font-bold hover:bg-[#0d645e] disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default KeyAchievements;
