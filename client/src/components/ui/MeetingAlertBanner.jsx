import React, { useState } from 'react';
import Button from './Button';

const MeetingAlertBanner = ({ meeting, onConfirm, onReject, onFeedback }) => {
  const [feedback, setFeedback] = useState('');

  if (!meeting) return null;

  return (
    <div className="fixed bottom-8 right-8 z-[100] w-full max-w-[340px] animate-in">
      <div className="glass rounded-3xl shadow-2xl border border-accent/30 p-6 flex flex-col gap-5 relative overflow-hidden">
        {/* Urgent Pulse Glow */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-accent-gradient animate-pulse" />
        
        <div className="flex items-start gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-accent-gradient flex items-center justify-center text-white shadow-lg animate-pulse">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red rounded-full border-2 border-white flex items-center justify-center text-[8px] font-black text-white">!</div>
          </div>
          
          <div className="flex flex-col">
            <div className="text-[10px] font-black text-accent uppercase tracking-[0.2em] mb-1">
              {meeting.reminderType === '15m' ? '⚡ Urgent Reminder' : 'Live Reminder'}
            </div>
            <h4 className="font-extrabold text-base text-text-primary leading-tight">
              {meeting.reminderType === '15m' ? 'Meeting in 15 minutes!' : 'Meeting in 1 hour'}
            </h4>
            <p className="text-xs font-bold text-text-secondary mt-1">
              {meeting.type === 'virtual' ? '🎥 Virtual' : '📍 Direct'} · <span className="text-blue">{meeting.lead}</span>
            </p>
            <p className="text-[10px] text-text-muted mt-0.5">
              {new Date(meeting.meetingAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
        
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Button size="sm" variant="primary" className="flex-1 rounded-xl" onClick={onConfirm}>
              Confirm
            </Button>
            <Button size="sm" variant="outline" className="flex-1 rounded-xl" onClick={onReject}>
              Reschedule
            </Button>
          </div>
          
          <div className="relative group">
            <input 
              type="text"
              placeholder="Quick feedback or notes..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="input pr-12 text-xs h-10 bg-surface2/50 group-focus-within:bg-surface"
            />
            <button 
              onClick={() => onFeedback(feedback)}
              className="absolute right-3 top-2.5 text-blue font-black text-[10px] uppercase tracking-wider hover:scale-110 transition-transform"
            >
              Post
            </button>
          </div>

          {meeting.meetingLink && (
            <a 
              href={meeting.meetingLink} 
              target="_blank" 
              rel="noopener noreferrer"
              className="btn btn-outline h-9 text-[10px] font-black uppercase tracking-widest bg-blue-light/30 border-blue/20 text-blue hover:bg-blue-gradient hover:text-white hover:border-transparent"
            >
              🚀 Join Meeting Space
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default MeetingAlertBanner;
