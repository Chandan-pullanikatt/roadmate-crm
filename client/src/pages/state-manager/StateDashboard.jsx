import React, { Suspense, lazy } from 'react';
import { useSearchParams } from 'react-router-dom';
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

  return (
    <div className="max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
      <Suspense fallback={<DashboardSkeleton />}>
        {renderPage()}
      </Suspense>
    </div>
  );
};

export default StateDashboard;
