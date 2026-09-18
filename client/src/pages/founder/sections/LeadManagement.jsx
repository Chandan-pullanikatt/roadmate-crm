import React from 'react';
import LeadManagementPage from '../../shared/LeadManagementPage';

// The page itself lives in pages/shared so the Founder and State Manager lists
// cannot drift apart. Only the wording differs here; the rows differ because the
// API scopes every query to the caller's reporting tree.
const LeadManagement = () => <LeadManagementPage />;

export default LeadManagement;
