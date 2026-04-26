import React, { Suspense, lazy, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import DashboardLayout from '../../components/layout/DashboardLayout';
import StateModals from './StateModals';

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
  const [activeModal, setActiveModal] = useState(null);
  const currentPage = searchParams.get('page') || 'overview';

  const renderPage = () => {
    switch (currentPage) {
      case 'overview': return <Overview openModal={setActiveModal} />;
      case 'my-work': return <MyWork openModal={setActiveModal} />;
      case 'industry-managers': return <IndustryManagers openModal={setActiveModal} />;
      case 'executives': return <Executives openModal={setActiveModal} />;
      case 'leads': return <LeadManagement openModal={setActiveModal} />;
      case 'attendance': return <Attendance openModal={setActiveModal} />;
      case 'calendar': return <LeaveCalendar openModal={setActiveModal} />;
      case 'performance': return <Performance openModal={setActiveModal} />;
      case 'reports': return <Reports openModal={setActiveModal} />;
      default: return <Overview openModal={setActiveModal} />;
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
          onClick: () => setActiveModal('create-ind-mgr') 
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
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-4">
               <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue"></div>
               <p className="text-xs font-bold text-text-muted uppercase tracking-widest animate-pulse">Loading {getPageTitle()}...</p>
            </div>
          </div>
        }>
          {renderPage()}
        </Suspense>
      </div>

      {activeModal && (
        <StateModals 
          type={activeModal} 
          onClose={() => setActiveModal(null)} 
        />
      )}
    </DashboardLayout>
  );
};

export default StateDashboard;

