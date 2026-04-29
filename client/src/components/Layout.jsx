import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { dashboardApi } from '../api/dashboardApi';
import { leaveApi } from '../api/leaveApi';
import DashboardLayout from './layout/DashboardLayout';

const Layout = ({ children, pageTitle, pageSubtitle }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Fetch counts for badges based on role
  const { data: dashData, isLoading, isError } = useQuery({
    queryKey: ['dashboard', user?.role],
    queryFn: () => {
      switch (user?.role) {
        case 'founder': return dashboardApi.getFounderDashboard().then(res => res.data);
        case 'state_manager': return dashboardApi.getStateManagerDashboard().then(res => res.data);
        case 'industry_manager': return dashboardApi.getIndustryManagerDashboard().then(res => res.data);
        case 'executive': return dashboardApi.getExecutiveDashboard().then(res => res.data);
        default: return null;
      }
    },
    enabled: !!user && ['founder', 'state_manager', 'industry_manager', 'executive'].includes(user.role)
  });

  const { data: pendingData } = useQuery({
    queryKey: ['leaves', 'pending'],
    queryFn: () => leaveApi.getPendingLeaves().then(res => res.data),
    staleTime: 2 * 60 * 1000,
    enabled: !!user && user.role !== 'executive'
  });

  const pendingCount = pendingData?.length || 0;

  const getBadge = (value) => {
    if (isLoading || isError) return null;
    const num = parseInt(value);
    return !isNaN(num) && num > 0 ? num : null;
  };

  const stats = dashData?.stats || dashData?.todayStats || {};

  // Role-specific configuration
  const roleConfigs = {
    founder: {
      accentColor: '#0f766e',
      logoSub: 'Team Management',
      roleBadge: '👑 Founder',
      roleBadgeClass: 'founder-badge',
      logoMarkClass: 'founder',
      logoMarkText: 'RM',
      avatarClass: 'av-green',
      sections: [
        {
          label: 'Overview',
          items: [
            { label: 'Founder Dashboard', path: '/dashboard?page=overview', icon: 'overview' },
            { label: 'Revenue Analytics', path: '/dashboard?page=revenue', icon: 'earnings' },
            { label: 'State Managers', path: '/dashboard?page=state-managers', icon: 'state-managers' },
            { label: 'Industry Managers', path: '/dashboard?page=industry-managers', icon: 'industry-managers' },
            { label: 'District Executives', path: '/dashboard?page=executives', icon: 'executives' }
          ]
        },
        {
          label: 'Leads',
          items: [
            { label: 'All Leads', path: '/dashboard?page=leads', icon: 'leads', badge: getBadge(stats.totalLeads), badgeColor: 'green' },
            { label: 'Add Lead', path: '#', onClick: () => window.dispatchEvent(new CustomEvent('open-modal', { detail: 'add-lead' })), icon: 'add-lead' },
            { label: 'Bulk Upload', path: '#', onClick: () => window.dispatchEvent(new CustomEvent('open-modal', { detail: 'bulk-upload' })), icon: 'bulk-upload' },
            { label: 'Expected Onboarding', path: '/dashboard?page=leads-onboarding', icon: 'expected', badge: getBadge(stats.expectedOnboarding), badgeColor: 'red' }
          ]
        },
        {
          label: 'HR & Team',
          items: [
            { label: 'Attendance', path: '/dashboard?page=attendance', icon: 'attendance' },
            { label: 'Leave Calendar', path: '/dashboard?page=calendar', icon: 'calendar', badge: getBadge(pendingCount), badgeColor: 'red' },
            { label: 'Performance', path: '/dashboard?page=performance', icon: 'performance' },
            { label: 'Working Hours', path: '#', onClick: () => window.dispatchEvent(new CustomEvent('open-modal', { detail: 'work-time' })), icon: 'working-hours', badge: '9:30 AM', badgeColor: 'green' }
          ]
        },
        {
          label: 'Reports',
          items: [
            { label: 'Reports', path: '/dashboard?page=reports', icon: 'reports' }
          ]
        }
      ]
    },
    state_manager: {
      accentColor: 'var(--blue)',
      logoSub: 'State Manager Portal',
      roleBadge: '🗺 Kerala',
      roleBadgeClass: 'state-badge',
      logoMarkClass: 'blue',
      logoMarkText: 'RM',
      avatarClass: 'av-state',
      sections: [
        {
          label: 'Main',
          items: [
            { label: 'Overview', path: '/dashboard?page=overview', icon: 'overview' },
            { label: 'Revenue Analytics', path: '/dashboard?page=revenue', icon: 'earnings' },
            { label: 'My Work', path: '/dashboard?page=my-work', icon: 'my-work', special: true },
            { label: 'Industry Managers', path: '/dashboard?page=industry-managers', icon: 'industry', badge: getBadge(stats.industryManagersCount), badgeColor: 'blue' },
            { label: 'District Executives', path: '/dashboard?page=executives', icon: 'executives' },
            { label: 'Lead Management', path: '/dashboard?page=leads', icon: 'leads', badge: getBadge(stats.activeLeads) }
          ]
        },
        {
          label: 'Team',
          items: [
            { label: 'Attendance', path: '/dashboard?page=attendance', icon: 'attendance' },
            { label: 'Leave Calendar', path: '/dashboard?page=calendar', icon: 'calendar', badge: getBadge(pendingCount), badgeColor: 'red' },
            { label: 'Performance', path: '/dashboard?page=performance', icon: 'performance' }
          ]
        },
        {
          label: 'Management',
          items: [
            { label: 'Create Ind. Manager', path: '#', onClick: () => window.dispatchEvent(new CustomEvent('open-modal', { detail: 'create-exec' })), icon: 'industry' },
            { label: 'Reports', path: '/dashboard?page=reports', icon: 'reports' }
          ]
        }
      ]
    },
    industry_manager: {
      accentColor: 'var(--purple)',
      logoSub: 'Industry Manager Portal',
      roleBadge: '🚗 Automobile · Kerala',
      roleBadgeClass: 'ind-badge',
      logoMarkClass: 'purple',
      logoMarkText: 'RM',
      avatarClass: 'av-ind',
      sections: [
        {
          label: 'Main',
          items: [
            { label: 'Overview', path: '/dashboard?page=overview', icon: 'overview' },
            { label: 'My Work', path: '/dashboard?page=my-work', icon: 'my-work', special: true },
            { label: 'District Executives', path: '/dashboard?page=team', icon: 'executives', badge: getBadge(stats.totalExecutives), badgeColor: 'purple' },
            { label: 'Lead Management', path: '/dashboard?page=leads', icon: 'leads', badge: getBadge(stats.totalLeads) },
            { label: 'Lead Task Flow', path: '/dashboard?page=lead-flow', icon: 'leads' }
          ]
        },
        {
          label: 'Team',
          items: [
            { label: 'Staff Performance', path: '/dashboard?page=performance', icon: 'performance' },
            { label: 'Attendance', path: '/dashboard?page=attendance', icon: 'attendance' },
            { label: 'Leave Calendar', path: '/dashboard?page=calendar', icon: 'calendar', badge: getBadge(pendingCount), badgeColor: 'red' },
            { label: 'Staff Documents', path: '/dashboard?page=staff-docs', icon: 'reports' }
          ]
        },
        {
          label: 'Management',
          items: [
            { label: 'Create Executive', path: '/dashboard?page=create-executive', icon: 'executives' },
            { label: 'Reports', path: '/dashboard?page=reports', icon: 'reports' }
          ]
        }
      ]
    },
    executive: {
      accentColor: '#B45309',
      roleBadge: 'District Executive',
      roleBadgeClass: 'exec-badge-v2',
      logoMarkClass: 'brown',
      logoMarkText: 'RM',
      avatarClass: 'av-exec',
      sections: [
        {
          label: 'OPERATIONS',
          items: [
            { label: 'Start My Work', path: '/dashboard?page=work', icon: 'work', special: true },
            { label: 'Meetings', path: '/dashboard?page=meetings', icon: 'meetings' },
            { label: 'My Leads', path: '/dashboard?page=leads', icon: 'leads-v2', badge: getBadge(stats.totalLeads), badgeColor: 'red' },
            { label: 'Leave Calendar', path: '/dashboard?page=leave-calendar', icon: 'calendar-v2' }
          ]
        },
        {
          label: 'INSIGHTS',
          items: [
            { label: 'Summary & Reports', path: '/dashboard?page=reports-v2', icon: 'reports-v2' },
            { label: 'Earnings & Payouts', path: '#', icon: 'earnings', comingSoon: true }
          ]
        },
        {
          label: 'RESOURCES',
          items: [
            { label: 'Company Policies', path: '#', icon: 'policies', comingSoon: true },
            { label: 'Hierarchy Status', path: '#', icon: 'hierarchy', comingSoon: true }
          ]
        }
      ]
    },
  };

  const config = user ? roleConfigs[user.role] : roleConfigs.executive;
  const isExecutive = (user?.role || 'executive') === 'executive';

  const handleLogout = () => {
    logout();
  };

  const page = new URLSearchParams(window.location.search).get('page') || (user?.role === 'executive' ? 'work' : 'overview');
  
  const getDisplayPage = (p) => p.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

  const dynamicTitle = isExecutive ? (
    page === 'work' ? 'Start My Work' :
    page === 'meetings' ? 'My Meetings' :
    page === 'leads' ? 'My Leads' :
    page === 'leave-calendar' ? 'Leave Calendar' :
    page === 'reports-v2' ? 'Summary & Reports' : 
    page === 'hierarchy' ? 'Hierarchy Status' :
    page === 'earnings' ? 'Earnings & Payouts' : 'Dashboard'
  ) : (pageTitle || (user?.role?.replace('_', ' ')?.toUpperCase() + ' Dashboard'));

  const dynamicSubtitle = isExecutive ? '' : (pageSubtitle || `${getDisplayPage(page)} · ${user?.state || 'Kerala'} · Management Portal`);

  return (
    <DashboardLayout
      userName={isExecutive ? 'Mohan R.' : (user?.name || 'Guest User')}
      userRole={user?.role || 'executive'}
      stateName={isExecutive ? 'Mumbai' : (user?.state || 'Kerala')}
      accentColor={config?.accentColor}
      logoSub={config?.logoSub}
      roleBadge={config?.roleBadge}
      roleBadgeClass={config?.roleBadgeClass}
      logoMarkClass={config?.logoMarkClass}
      logoMarkText={config?.logoMarkText}
      avatarClass={config?.avatarClass}
      sections={config?.sections}
      onLogout={handleLogout}
      extraContent={config?.extraContent}
      footerBranding={config?.footerBranding}
      pageTitle={dynamicTitle}
      pageSubtitle={dynamicSubtitle}
    >
      {children}
    </DashboardLayout>
  );
};

export default Layout;
