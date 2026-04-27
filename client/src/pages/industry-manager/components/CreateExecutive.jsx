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
    employmentType: 'Full Time',
    joiningDate: new Date().toISOString().split('T')[0],
    password: '',
    address: '',
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
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text-primary tracking-tight">Create District Executive</h2>
          <p className="text-sm text-text-muted mt-1">Add a new staff member to your {formData.industry} team</p>
        </div>
        <div className="flex items-center gap-3">
             <div className="px-3 py-1 rounded-lg bg-purple-light text-purple text-[10px] font-black uppercase tracking-wider border border-purple/10">
                {formData.industry} Team
             </div>
             <Tag variant="purple" label={currentUser?.state || 'Kerala'} className="font-black px-4" />
        </div>
      </div>

      <div className="card shadow-lg shadow-purple/5 border-border/40 overflow-hidden">
        <div className="card-header border-b border-border/40 bg-surface2/30 px-8 py-5">
          <h3 className="text-sm font-black text-text-primary uppercase tracking-widest">Executive Registration</h3>
        </div>
        <form className="card-body p-8 space-y-8" onSubmit={handleSubmit}>
          {/* Section 1: Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Full Name</label>
              <input 
                type="text" 
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Rahul VK" 
                className="w-full bg-surface2/50 border border-border/60 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-purple focus:ring-2 focus:ring-purple/10 transition-all"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Email Address</label>
              <input 
                type="email" 
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="rahul@roadmate.in" 
                className="w-full bg-surface2/50 border border-border/60 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-purple focus:ring-2 focus:ring-purple/10 transition-all"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Phone Number</label>
              <input 
                type="tel" 
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+91 94470 00000" 
                className="w-full bg-surface2/50 border border-border/60 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-purple focus:ring-2 focus:ring-purple/10 transition-all"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Login Password</label>
              <input 
                type="text" 
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Set temporary password" 
                className="w-full bg-surface2/50 border border-border/60 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-purple focus:ring-2 focus:ring-purple/10 transition-all"
                required
              />
            </div>
          </div>

          {/* Section 2: Roles & Placement */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-border/40">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Assigned District</label>
              <select 
                name="district"
                value={formData.district}
                onChange={handleChange}
                className="w-full bg-surface2/50 border border-border/60 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-purple focus:ring-2 focus:ring-purple/10 transition-all appearance-none"
                required
              >
                <option value="">Select District</option>
                {['Ernakulam', 'Thrissur', 'Kozhikode', 'Thiruvananthapuram', 'Kollam', 'Alappuzha', 'Idukki', 'Kottayam', 'Palakkad', 'Malappuram', 'Wayanad', 'Kannur', 'Kasaragod', 'Pathanamthitta'].map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Joining Date</label>
              <input 
                type="date" 
                name="joiningDate"
                value={formData.joiningDate}
                onChange={handleChange}
                className="w-full bg-surface2/50 border border-border/60 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-purple focus:ring-2 focus:ring-purple/10 transition-all"
                required
              />
            </div>
          </div>

          {/* Section 3: New Fields from Screenshot */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-border/40">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Industry</label>
              <input 
                type="text" 
                value={formData.industry}
                readOnly
                className="w-full bg-surface2/30 border border-border/40 rounded-xl px-4 py-3 text-sm font-bold text-text-muted outline-none cursor-not-allowed"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-purple uppercase tracking-[0.2em]">Employment Type</label>
              <select 
                name="employmentType"
                value={formData.employmentType}
                onChange={handleChange}
                className="w-full bg-white border border-purple/40 rounded-xl px-4 py-3 text-sm font-bold text-text-primary outline-none focus:ring-2 focus:ring-purple/10 shadow-sm"
              >
                <option value="Full Time">Full Time</option>
                <option value="Probation">Probation</option>
                <option value="Part Time">Part Time</option>
              </select>
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t border-border/40">
            <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Full Address</label>
            <textarea 
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Enter full residential address..." 
              className="w-full bg-surface2/50 border border-border/60 rounded-xl px-4 py-4 text-sm font-bold outline-none focus:border-purple focus:ring-2 focus:ring-purple/10 transition-all min-h-[120px]"
              required
            ></textarea>
          </div>

          <div className="pt-8 border-t border-border/40 flex justify-end gap-4">
            <Button type="button" variant="outline" className="rounded-xl px-8 font-black text-[10px] uppercase tracking-widest h-12" onClick={onCancel}>Discard</Button>
            <Button 
              type="submit" 
              className="bg-purple text-white px-12 hover:bg-purple/90 shadow-xl shadow-purple/20 transition-all active:scale-95 rounded-xl font-black text-[10px] uppercase tracking-widest h-12"
              disabled={createMutation.isLoading}
            >
              {createMutation.isLoading ? 'Creating Account...' : 'Generate Executive Account'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateExecutive;
