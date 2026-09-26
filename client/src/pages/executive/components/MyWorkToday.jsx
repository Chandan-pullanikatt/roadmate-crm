import React from 'react';
import { useAuth } from '../../../hooks/useAuth';
import MyWorkPage from '../../shared/MyWorkPage';
import ExecCallFeedbackModal from './ExecCallFeedbackModal';
import LeadWizard from './LeadWizard';

/**
 * The District Manager's work page — the same layout the Industry Manager and the
 * State Manager work from, out of the shared MyWorkPage. It used to be a separate
 * wizard-styled screen with seven metric tiles, a meetings panel and an activity
 * feed; the client asked for one work page across every role.
 *
 * Two things stay specific to this role: the work-from-home declaration when the
 * day is started, and the meeting-confirmation tasks cron pushes into the queue,
 * which are still answered through LeadWizard.
 */
const MyWorkToday = () => {
  const { user } = useAuth();

  return (
    <MyWorkPage
      scopeLabel={user?.district || user?.state}
      subtitle="Your personal lead queue · Meetings, follow-ups and new leads · One-by-one execution"
      FeedbackModal={ExecCallFeedbackModal}
      ConfirmTaskWizard={LeadWizard}
      wfhCapture
      navTargets={{
        myLeads:     '/dashboard?page=leads',
        completed:   '/dashboard?page=leads&completedToday=true',
        calls:       '/dashboard?page=leads',
        conversions: '/dashboard?page=leads&status=converted&period=month',
        blocking:    '/dashboard?page=leads&status=blocking_amount_received',
      }}
    />
  );
};

export default MyWorkToday;
