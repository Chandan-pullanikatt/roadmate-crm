import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../../api/usersApi';
import { Button, Tag } from '../../../components/ui';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';

const CreateExecutive = ({ onCancel, onSuccess }) => {
  const { addToast } = useToast();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    district: '',
    industry: currentUser?.industry || 'Automobile',
    joiningDate: new Date().toISOString().split('T')[0],
    password: '',
    address: '',
    basicSalary: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const createMutation = useMutation({
    mutationFn: (data) => usersApi.createExecutive({
      ...data,
      state: currentUser?.state,
      reportingTo: currentUser?._id
    }),
    onSuccess: () => {
      addToast("Executive account created successfully", "success");
      queryClient.invalidateQueries(['dashboard', 'industry-manager']);
      if (onSuccess) onSuccess();
    },
    onError: (err) => {
      addToast(err.response?.data?.message || "Failed to create account", "error");
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-title text-xl">Create District Executive</h2>
          <p className="section-sub">Add a new staff member to your {formData.industry} team</p>
        </div>
        <Tag variant="purple" label={`${formData.industry} · ${currentUser?.state || 'Kerala'}`} />
      </div>

      <div className="card">
        <div className="card-header border-b border-border bg-surface2/30">
          <h3 className="section-title text-base font-bold text-text-primary">Staff Information</h3>
        </div>
        <form className="card-body p-6 space-y-6" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Full Name</label>
              <input 
                type="text" 
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Rahul VK" 
                className="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple transition-all shadow-inner"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Email Address</label>
              <input 
                type="email" 
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="rahul@roadmate.in" 
                className="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple transition-all shadow-inner"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Phone Number</label>
              <input 
                type="tel" 
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+91 94470 00000" 
                className="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple transition-all shadow-inner"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Password</label>
              <input 
                type="text" 
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Temporary password" 
                className="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple transition-all shadow-inner"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">District</label>
              <select 
                name="district"
                value={formData.district}
                onChange={handleChange}
                className="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple transition-all shadow-inner"
                required
              >
                <option value="">Select District</option>
                {['Ernakulam', 'Thrissur', 'Kozhikode', 'Thiruvananthapuram', 'Kollam', 'Alappuzha', 'Idukki', 'Kottayam', 'Palakkad', 'Malappuram', 'Wayanad', 'Kannur', 'Kasaragod', 'Pathanamthitta'].map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Base Salary (₹)</label>
              <input 
                type="number" 
                name="basicSalary"
                value={formData.basicSalary}
                onChange={handleChange}
                placeholder="25000" 
                className="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple transition-all shadow-inner"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Home Address</label>
            <textarea 
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Full residential address..." 
              className="w-full bg-surface2 border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple transition-all shadow-inner min-h-[100px]"
            ></textarea>
          </div>

          <div className="pt-4 border-t border-border flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button 
              type="submit" 
              className="bg-purple text-white px-8 hover:bg-purple/90 shadow-lg shadow-purple/20 transition-all active:scale-95"
              disabled={createMutation.isLoading}
            >
              {createMutation.isLoading ? 'Creating...' : 'Create Account'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateExecutive;
