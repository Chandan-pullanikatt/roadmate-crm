import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

// Sub-components
import Overview from './components/Overview';
import MyWork from './components/MyWork';
import DistrictExecutives from './components/DistrictExecutives';
import LeadManagement from './components/LeadManagement';
import LeadFlow from './components/LeadFlow';
import Attendance from './components/Attendance';
import MyAttendance from './components/MyAttendance';
import LeaveApprovals from './components/LeaveApprovals';
import LeaveCalendar from './components/LeaveCalendar';
import StaffDocs from './components/StaffDocs';
import CreateExecutive from './components/CreateExecutive';
import Performance from './components/Performance';
import MyPerformance from './components/MyPerformance';
import Reports from './components/Reports';
import CallsDetail from './components/CallsDetail';
import MeetingsDetail from './components/MeetingsDetail';
import SopViewer from './components/SopViewer';
import Tasks from '../founder/sections/Tasks';


const IndDashboard = () => {
  const location = useLocation();
  
  // Extract active page from query param
  const activePage = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('page') || 'overview';
  }, [location.search]);

  const renderContent = () => {
    switch (activePage) {
      // ── My Works ──────────────────────────────────────────
      case 'overview':        return <Overview />;
      case 'my-work':         return <MyWork />;
      case 'my-leads':        return <LeadManagement ownerScope="self" />;
      case 'my-performance':  return <MyPerformance />;
      case 'my-attendance':   return <MyAttendance />;
      case 'my-sop':          return <SopViewer role="industry_manager" />;

      // ── Team ──────────────────────────────────────────────
      case 'team':            return <DistrictExecutives />;
      case 'leads':           return <LeadManagement ownerScope="team" />;
      case 'performance':     return <Performance />;
      case 'attendance':      return <Attendance />;
      case 'staff-docs':      return <StaffDocs />;
      case 'team-sop':        return <SopViewer role="executive" />;

      // ── Management ────────────────────────────────────────
      case 'tasks':           return <Tasks />;
      case 'lead-flow':       return <LeadFlow />;
      case 'calendar':        return <LeaveCalendar />;
      case 'reports':         return <Reports />;

      // ── Legacy / misc ─────────────────────────────────────
      case 'approvals':       return <LeaveApprovals />;
      case 'create-executive': return <CreateExecutive />;
      case 'calls':           return <CallsDetail />;
      case 'meetings':        return <MeetingsDetail />;

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
