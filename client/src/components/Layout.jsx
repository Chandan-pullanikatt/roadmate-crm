import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import DashboardLayout from './layout/DashboardLayout';

const Layout = ({ children, pageTitle, pageSubtitle }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Role-specific configuration
  const roleConfigs = {
    founder: {
      accentColor: 'var(--accent)',
      logoSub: 'Team Management',
      roleBadge: '👑 Founder',
      roleBadgeClass: 'founder-badge',
      logoMarkClass: '',
      logoMarkText: 'RM',
      avatarClass: 'av-founder',
      sections: [
        {
          label: 'Overview',
          items: [
            { label: 'Founder Dashboard', path: '/dashboard?page=overview', icon: 'overview' },
            { label: 'State Managers', path: '/dashboard?page=state-managers', icon: 'industry' },
            { label: 'Industry Managers', path: '/dashboard?page=industry-managers', icon: 'industry' },
            { label: 'District Executives', path: '/dashboard?page=executives', icon: 'executives' }
          ]
        },
        {
          label: 'Leads',
          items: [
            { label: 'All Leads', path: '/dashboard?page=leads', icon: 'leads', badge: 124, badgeColor: 'green' },
            { label: 'Add Lead', path: '#', onClick: () => window.dispatchEvent(new CustomEvent('open-modal', { detail: 'add-lead' })), icon: 'leads' },
            { label: 'Bulk Upload', path: '#', onClick: () => window.dispatchEvent(new CustomEvent('open-modal', { detail: 'bulk-upload' })), icon: 'leads' },
            { label: 'Expected Onboarding', path: '/dashboard?page=leads-onboarding', icon: 'leads', badge: 18 }
          ]
        },
        {
          label: 'HR & Team',
          items: [
            { label: 'Attendance', path: '/dashboard?page=attendance', icon: 'attendance' },
            { label: 'Leave Calendar', path: '/dashboard?page=calendar', icon: 'calendar', badge: 3 },
            { label: 'Performance', path: '/dashboard?page=performance', icon: 'performance' },
            { label: 'Working Hours', path: '#', onClick: () => window.dispatchEvent(new CustomEvent('open-modal', { detail: 'work-time' })), icon: 'attendance', badge: '9:30 AM', badgeColor: 'green' }
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
            { label: 'My Work', path: '/dashboard?page=my-work', icon: 'my-work', badge: '4', badgeColor: 'blue', special: true },
            { label: 'Industry Managers', path: '/dashboard?page=industry-managers', icon: 'industry', badge: '5', badgeColor: 'blue' },
            { label: 'District Executives', path: '/dashboard?page=executives', icon: 'executives' },
            { label: 'Lead Management', path: '/dashboard?page=leads', icon: 'leads', badge: '8' }
          ]
        },
        {
          label: 'Team',
          items: [
            { label: 'Attendance', path: '/dashboard?page=attendance', icon: 'attendance' },
            { label: 'Leave Calendar', path: '/dashboard?page=calendar', icon: 'calendar', badge: '3', badgeColor: 'red' },
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
            { label: 'My Work', path: '/dashboard?page=my-work', icon: 'my-work', badge: 5, badgeColor: 'purple', special: true },
            { label: 'District Executives', path: '/dashboard?page=team', icon: 'executives', badge: 6, badgeColor: 'purple' },
            { label: 'Lead Management', path: '/dashboard?page=leads', icon: 'leads', badge: 12 },
            { label: 'Lead Task Flow', path: '/dashboard?page=lead-flow', icon: 'leads' }
          ]
        },
        {
          label: 'Team',
          items: [
            { label: 'Staff Performance', path: '/dashboard?page=performance', icon: 'performance' },
            { label: 'Attendance', path: '/dashboard?page=attendance', icon: 'attendance' },
            { label: 'Leave Calendar', path: '/dashboard?page=calendar', icon: 'calendar', badge: 4 },
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
      accentColor: 'var(--orange)',
      logoSub: 'Executive Portal',
      roleBadge: '⚡ District Executive',
      roleBadgeClass: 'exec-badge',
      logoMarkClass: 'orange',
      logoMarkText: 'EX',
      avatarClass: 'av-exec',
      sections: [
        {
          label: 'Work',
          items: [
            { label: 'Start My Work', path: '/dashboard?page=work', icon: 'calendar' },
            { label: 'My Leads', path: '/dashboard?page=leads', icon: 'leads', badge: 38, badgeColor: 'amber' },
            { label: 'Work Report', path: '/dashboard?page=performance', icon: 'reports' }
          ]
        },
        {
          label: 'HR',
          items: [
            { label: 'Attendance', path: '/dashboard?page=attendance', icon: 'attendance' },
            { label: 'Leave & Calendar', path: '/dashboard?page=leave', icon: 'calendar' },
            { label: 'Performance', path: '/dashboard?page=performance', icon: 'performance' }
          ]
        }
      ]
    },
  };

  const config = user ? roleConfigs[user.role] : roleConfigs.executive;

  const handleLogout = () => {
    logout();
  };

  return (
    <DashboardLayout
      userName={user?.name || 'Guest User'}
      userRole={user?.role || 'executive'}
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
      pageTitle={pageTitle}
      pageSubtitle={pageSubtitle}
    >
      {children}
    </DashboardLayout>
  );
};

export default Layout;
