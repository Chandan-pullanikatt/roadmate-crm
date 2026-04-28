import React, { Suspense, lazy, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import DashboardLayout from '../../components/layout/DashboardLayout';
import StateModals from './StateModals';
import DashboardSkeleton from '../../components/skeletons/DashboardSkeleton';

// Lazy loading sub-pages
const Overview = lazy(() => import('./sub-pages/Overview'));
const MyWork = lazy(() => import('./sub-pages/MyWork'));
const IndustryManagers = lazy(() => import('./sub-pages/IndustryManagers'));
const Executives = lazy(() => import('./sub-pages/Executives'));
const LeadManagement = lazy(() => import('./sub-pages/LeadManagement'));
const Attendance = lazy(() => import('./sub-pages/Attendance'));
const LeaveCalendar = lazy(() => import('./sub-pages/LeaveCalendar'));
const Performance = lazy(() => import('./sub-pages/Performance'));
const Reports = lazy(() => import('./sub-pages/Reports'));

const StateDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentPage = searchParams.get('page') || 'overview';

  const renderPage = () => {
    switch (currentPage) {
      case 'overview': return <Overview />;
      case 'my-work': return <MyWork />;
      case 'industry-managers': return <IndustryManagers />;
      case 'executives': return <Executives />;
      case 'leads': return <LeadManagement />;
      case 'attendance': return <Attendance />;
      case 'calendar': return <LeaveCalendar />;
      case 'performance': return <Performance />;
      case 'reports': return <Reports />;
      default: return <Overview />;
    }
  };

  const getPageTitle = () => {
    return currentPage.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const navSections = [
    {
      label: 'Main',
      items: [
        { label: 'Overview', path: '/dashboard?page=overview', icon: 'overview' },
        { 
          label: 'My Work', 
          path: '/dashboard?page=my-work', 
          icon: 'my-work', 
          badge: '4', 
          badgeColor: 'blue',
          special: true 
        },
        { 
          label: 'Industry Managers', 
          path: '/dashboard?page=industry-managers', 
          icon: 'industry', 
          badge: '5', 
          badgeColor: 'blue' 
        },
        { label: 'District Executives', path: '/dashboard?page=executives', icon: 'executives' },
        { label: 'Lead Management', path: '/dashboard?page=leads', icon: 'leads', badge: '8' },
      ]
    },
    {
      label: 'Team',
      items: [
        { label: 'Attendance', path: '/dashboard?page=attendance', icon: 'attendance' },
        { label: 'Leave Calendar', path: '/dashboard?page=calendar', icon: 'calendar', badge: '3', badgeColor: 'red' },
        { label: 'Performance', path: '/dashboard?page=performance', icon: 'performance' },
      ]
    },
    {
      label: 'Management',
      items: [
        { 
          label: 'Create Ind. Manager', 
          path: '#', 
          icon: 'industry', 
          onClick: () => window.dispatchEvent(new CustomEvent('open-modal', { detail: { type: 'create-exec', role: 'industry-manager' } })) 
        },
        { label: 'Reports', path: '/dashboard?page=reports', icon: 'reports' },
      ]
    }
  ];

  const handleLogout = () => {
    logout();
  };

  return (
    <DashboardLayout 
      pageTitle="State Manager Dashboard" 
      pageSubtitle={`${getPageTitle()} · Kerala · Full state overview`}
      logoSub="State Manager Portal"
      roleBadge="🗺 Kerala"
      roleBadgeClass="state-badge"
      avatarClass="av-state"
      userName={user?.name || "Sreejith Menon"}
      userRole={user?.role || "state_manager"}
      sections={navSections}
      onLogout={handleLogout}
    >
      <div className="max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
        <Suspense fallback={<DashboardSkeleton />}>
          {renderPage()}
        </Suspense>
      </div>
    </DashboardLayout>
  );
};

export default StateDashboard;

