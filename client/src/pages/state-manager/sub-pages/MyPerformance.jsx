import React from 'react';
import { useAuth } from '../../../context/AuthContext';
import MyPerformancePage from '../../../components/MyPerformancePage';

const MyPerformance = () => {
  const { user } = useAuth();
  return <MyPerformancePage roleName="State Manager" scope={user?.state} />;
};

export default MyPerformance;
