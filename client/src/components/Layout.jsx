import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { dashboardApi } from '../api/dashboardApi';
import { leadsApi } from '../api/leadsApi';
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

  const { data: unallocatedCount = 0 } = useQuery({
    queryKey: ['leads', 'unallocated-count'],
    queryFn: () => leadsApi.getLeads({ owner: 'unassigned', limit: 1 }).then(r => r.data.total || 0),
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    enabled: !!user && user.role === 'founder',
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
            { label: 'Expected Onboarding', path: '/dashboard?page=leads-onboarding', icon: 'expected', badge: unallocatedCount > 0 ? unallocatedCount : getBadge(stats.expectedOnboarding), badgeColor: unallocatedCount > 0 ? 'red' : 'red' },
            { label: 'Targets', path: '/dashboard?page=targets', icon: 'performance', badge: null },
            { label: 'Tasks', path: '/dashboard?page=tasks', icon: 'work', badge: null }
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
      roleBadge: `🗺 ${user?.state || 'State Manager'}`,
      roleBadgeClass: 'state-badge',
      logoMarkClass: 'blue',
      logoMarkText: 'RM',
      avatarClass: 'av-state',
      sections: [
        {
          label: 'Main',
          items: [
            { label: 'Overview', path: '/dashboard?page=overview', icon: 'overview' },
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
            { label: 'Tasks', path: '/dashboard?page=tasks', icon: 'work' },
            { label: 'Create Ind. Manager', path: '#', onClick: () => window.dispatchEvent(new CustomEvent('open-modal', { detail: 'create-exec' })), icon: 'industry' },
            { label: 'Reports', path: '/dashboard?page=reports', icon: 'reports' }
          ]
        }
      ]
    },
    industry_manager: {
      accentColor: 'var(--purple)',
      logoSub: 'Industry Manager Portal',
      roleBadge: `🚗 ${user?.industry || 'Industry'} · ${user?.state || 'State'}`,
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
            { label: 'My Performance', path: '/dashboard?page=my-performance', icon: 'performance' },
            { label: 'Staff Performance', path: '/dashboard?page=performance', icon: 'performance' },
            { label: 'Attendance', path: '/dashboard?page=attendance', icon: 'attendance' },
            { label: 'Leave Calendar', path: '/dashboard?page=calendar', icon: 'calendar', badge: getBadge(pendingCount), badgeColor: 'red' },
            { label: 'Staff Documents', path: '/dashboard?page=staff-docs', icon: 'reports' }
          ]
        },
        {
          label: 'Management',
          items: [
            { label: 'Tasks', path: '/dashboard?page=tasks', icon: 'work' },
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
            { label: 'Earnings & Payouts', path: '/dashboard?page=earnings', icon: 'earnings' }
          ]
        },
        {
          label: 'RESOURCES',
          items: [
            { label: 'Company Policies', path: '/dashboard?page=policies', icon: 'policies' },
            { label: 'Hierarchy Status', path: '/dashboard?page=hierarchy', icon: 'hierarchy' }
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
    page === 'earnings' ? 'Earnings & Payouts' :
    page === 'policies' ? 'Company Policies' : 'Dashboard'
  ) : (pageTitle || (user?.role?.replace('_', ' ')?.toUpperCase() + ' Dashboard'));

  const dynamicSubtitle = isExecutive ? '' : (pageSubtitle || `${getDisplayPage(page)} · ${user?.state || 'Kerala'} · Management Portal`);

  return (
    <DashboardLayout
      userName={user?.name || 'Guest User'}
      userRole={user?.role || 'executive'}
      stateName={user?.state || user?.district || 'N/A'}
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
