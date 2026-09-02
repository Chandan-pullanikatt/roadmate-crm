import React from 'react';
import { useLocation } from 'react-router-dom';
import Overview from './sections/Overview';
import StateManagers from './sections/StateManagers';
import IndustryManagers from './sections/IndustryManagers';
import DistrictExecutives from './sections/DistrictExecutives';
import LeadManagement from './sections/LeadManagement';
import Attendance from './sections/Attendance';
import LeaveCalendar from './sections/LeaveCalendar';
import Performance from './sections/Performance';
import Reports from './sections/Reports';
import ExpectedOnboarding from './sections/ExpectedOnboarding';
import Targets from './sections/Targets';
import Tasks from './sections/Tasks';
import Documents from './sections/Documents';
import RevenueDashboard from './sections/RevenueDashboard';

import './founder.css';

const FounderDashboard = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const activePage = queryParams.get('page') || 'overview';

  const renderActivePage = () => {
    switch (activePage) {
      case 'overview': return <Overview />;
      case 'state-managers': return <StateManagers />;
      case 'industry-managers': return <IndustryManagers />;
      case 'executives': return <DistrictExecutives />;
      case 'leads': return <LeadManagement />;
      case 'attendance': return <Attendance />;
      case 'calendar': return <LeaveCalendar />;
      case 'performance': return <Performance />;
      case 'reports': return <Reports />;
      case 'leads-onboarding': return <ExpectedOnboarding />;
      case 'targets': return <Targets />;
      case 'tasks':   return <Tasks />;
      case 'sop':     return <Documents />;
      case 'revenue': return <RevenueDashboard />;

      default: return <Overview />;
    }
  };

  return (
    <div className="main-content">
      {renderActivePage()}
    </div>
  );
};

export default FounderDashboard;
