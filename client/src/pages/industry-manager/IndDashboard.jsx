import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

// Sub-components
import Overview from './components/Overview';
import MyWork from './components/MyWork';
import DistrictExecutives from './components/DistrictExecutives';
import LeadManagement from './components/LeadManagement';
import LeadFlow from './components/LeadFlow';
import Attendance from './components/Attendance';
import LeaveApprovals from './components/LeaveApprovals';
import LeaveCalendar from './components/LeaveCalendar';
import StaffDocs from './components/StaffDocs';
import CreateExecutive from './components/CreateExecutive';
import Performance from './components/Performance';
import Reports from './components/Reports';
import RevenueDashboard from '../founder/sections/RevenueDashboard';

const IndDashboard = () => {
  const location = useLocation();
  
  // Extract active page from query param
  const activePage = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('page') || 'overview';
  }, [location.search]);

  const renderContent = () => {
    switch (activePage) {
      case 'overview': return <Overview />;
      case 'my-work': return <MyWork />;
      case 'team': return <DistrictExecutives />;
      case 'leads': return <LeadManagement />;
      case 'lead-flow': return <LeadFlow />;
      case 'attendance': return <Attendance />;
      case 'approvals': return <LeaveApprovals />;
      case 'calendar': return <LeaveCalendar />;
      case 'staff-docs': return <StaffDocs />;
      case 'create-executive': return <CreateExecutive />;
      case 'performance': return <Performance />;
      case 'reports': return <Reports />;
      case 'revenue': return <RevenueDashboard />;
      default: return <Overview />;
    }
  };


  return (
    <div className="pb-12">
      {/* Page Header (Internal to Dashboard) - Only show for overview */}
      {activePage === 'overview' && (
        <div className="mb-8 border-b border-border/50 pb-6 hidden md:block">
           <div className="flex items-center gap-3 text-[10px] font-bold text-text-muted uppercase tracking-[0.2em]">
              <span>Industry Hub</span>
              <span className="opacity-30">/</span>
              <span className="text-purple">{activePage.replace('-', ' ')}</span>
           </div>
        </div>
      )}

      {/* Main Page Area */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-400">
        {renderContent()}
      </div>
    </div>
  );
};

export default IndDashboard;
