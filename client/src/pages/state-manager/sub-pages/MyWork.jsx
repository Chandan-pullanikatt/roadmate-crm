import React from 'react';
import { useAuth } from '../../../context/AuthContext';
import MyWorkPage from '../../shared/MyWorkPage';
import CallFeedbackModal from '../../industry-manager/components/CallFeedbackModal';

/**
 * The State Manager's personal work page — the same layout the Industry Manager
 * and the District Manager work from, out of the shared MyWorkPage. This page used
 * to carry its own four stat cards, an all-leads table and a performance panel; the
 * client asked for one work page across every manager role, and the leads table and
 * performance figures have their own sidebar pages (page=my-leads, page=my-performance).
 */
const MyWork = () => {
  const { user } = useAuth();

  return (
    <MyWorkPage
      scopeLabel={user?.state}
      subtitle="Your personal lead queue · Industry Partner leads at state level · One-by-one execution"
      startPrompt="Industry Partner leads appear one-by-one · Meetings first, then new leads, then follow-ups"
      FeedbackModal={CallFeedbackModal}
      allocate={{
        role: 'industry_manager',
        fieldLabel: 'Industry Manager',
        emptyMsg: 'No industry managers found in your team.',
      }}
      // These cards count this manager's own leads, so they drill into My Work >
      // Lead Management rather than the statewide list under Team.
      navTargets={{
        myLeads:     '/dashboard?page=my-leads',
        completed:   '/dashboard?page=my-leads&completedToday=true',
        calls:       '/dashboard?page=my-leads',
        conversions: '/dashboard?page=my-leads&status=converted&period=month',
        blocking:    '/dashboard?page=my-leads&status=blocking_amount_received',
      }}
      extraInvalidateKeys={[['dashboard', 'state-manager']]}
    />
  );
};

export default MyWork;
