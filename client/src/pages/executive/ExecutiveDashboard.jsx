import React from 'react';
import { useSearchParams } from 'react-router-dom';
// Components
import Overview from './components/Overview';
import MyWorkToday from './components/MyWorkToday';
import Meetings from './components/Meetings';
import LeadList from './components/LeadList';
import Attendance from './components/Attendance';
import LeaveManagement from './components/LeaveManagement';
import MyTargets from './components/MyTargets';
import MyPerformance from './components/MyPerformance';
import SopViewer from '../industry-manager/components/SopViewer';
import Tasks from '../founder/sections/Tasks';

const ExecutiveDashboard = () => {
  const [searchParams] = useSearchParams();
  const page = searchParams.get('page') || 'work';

  const renderContent = () => {
    switch (page.toLowerCase()) {
      case 'overview': return <Overview />;
      case 'work': return <MyWorkToday />;
      case 'tasks': return <Tasks />;
      case 'meetings': return <Meetings />;
      case 'leads': return <LeadList />;
      case 'leave-calendar': return <Attendance />;
      case 'attendance': return <Attendance />;
      case 'leave': return <LeaveManagement />;
      case 'targets': return <MyTargets />;
      case 'my-performance': return <MyPerformance />;
      // The old Summary & Reports page; its links now land on My Performance.
      case 'reports-v2': return <MyPerformance />;
      case 'performance': return <MyPerformance />;
      case 'documents': return <SopViewer role="executive" />;
      default: return <MyWorkToday />;
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      {renderContent()}
    </div>
  );
};

export default ExecutiveDashboard;
