import React, { useState } from 'react';
import api from '../../api/axios';
import Modal from '../ui/Modal';
import { Button } from '../ui';
import { useToast } from '../../context/ToastContext';

/**
 * Declared at module scope on purpose. Defining this inside ChangePasswordModal
 * makes React see a new component type on every render, which remounts the
 * input and drops focus after each keystroke.
 */
const PasswordField = ({ id, label, name, value, error, show, onToggle, onChange }) => (
  <div className="mb-4">
    <label htmlFor={id} className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
      {label}
    </label>
    <div className="relative group">
      <input
        id={id}
        name={name}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        className={`w-full bg-surface2 border ${error ? 'border-red-500' : 'border-border'} rounded-xl py-3 pl-4 pr-12 text-sm font-bold focus:bg-white focus:ring-4 ${error ? 'focus:ring-red-500/5 focus:border-red-500' : 'focus:ring-orange/5 focus:border-orange'} outline-none transition-all`}
        placeholder={`Enter ${label.toLowerCase()}`}
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-text-primary transition-colors"
      >
        {show ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        )}
      </button>
    </div>
    {error && <p className="mt-1 text-[10px] font-bold text-red uppercase tracking-tight">{error}</p>}
  </div>
);

const ChangePasswordModal = ({ isOpen, onClose }) => {
  const { addToast } = useToast();
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    setApiError('');
  };

  const toggleVisibility = (field) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.currentPassword) newErrors.currentPassword = 'Current password is required';
    if (formData.newPassword.length < 8) newErrors.newPassword = 'Password must be at least 8 characters';
    if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setApiError('');
    
    try {
      // The backend route is actually router.put('/change-password')
      const response = await api.put('/auth/change-password', {
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });

      addToast(response.data.message || 'Password changed successfully', 'success');
      
      // Close modal after a short delay
      setTimeout(() => {
        onClose();
        setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setApiError('');
      }, 1500);
    } catch (err) {
      setApiError(err.response?.data?.message || 'Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Change Password"
      subtitle="Update your account security"
      className="max-w-md"
    >
      <form onSubmit={handleSubmit}>
        {apiError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red animate-in fade-in slide-in-from-top-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span className="text-xs font-bold">{apiError}</span>
          </div>
        )}

        <PasswordField
          id="currentPassword"
          label="Current Password"
          name="currentPassword"
          value={formData.currentPassword}
          error={errors.currentPassword}
          show={showPasswords.current}
          onToggle={() => toggleVisibility('current')}
          onChange={handleChange}
        />

        <PasswordField
          id="newPassword"
          label="New Password"
          name="newPassword"
          value={formData.newPassword}
          error={errors.newPassword}
          show={showPasswords.new}
          onToggle={() => toggleVisibility('new')}
          onChange={handleChange}
        />

        <PasswordField
          id="confirmPassword"
          label="Confirm New Password"
          name="confirmPassword"
          value={formData.confirmPassword}
          error={errors.confirmPassword}
          show={showPasswords.confirm}
          onToggle={() => toggleVisibility('confirm')}
          onChange={handleChange}
        />

        <div className="mt-8">
          <Button
            type="submit"
            className="w-full h-12 bg-orange hover:bg-orange-dark text-white rounded-xl font-black shadow-lg shadow-orange/20 transition-all active:scale-[0.98]"
            disabled={loading}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Updating...
              </div>
            ) : (
              'Change Password'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default ChangePasswordModal;
