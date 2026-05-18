import React from 'react';

const Earnings = () => (
  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: 48,
      textAlign: 'center',
      color: 'var(--text-muted)'
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>💰</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
        Earnings & Payouts
      </div>
      <div style={{ fontSize: 13 }}>Detailed payout report coming soon.</div>
    </div>
  </div>
);

export default Earnings;
