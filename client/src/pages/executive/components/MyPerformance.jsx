import React from 'react';
import { useAuth } from '../../../context/AuthContext';
import MyPerformancePage from '../../../components/MyPerformancePage';

const MyPerformance = () => {
  const { user } = useAuth();
  return <MyPerformancePage roleName="District Manager" scope={[user?.district, user?.state].filter(Boolean).join(' · ')} />;
};

export default MyPerformance;
