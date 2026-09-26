import React from 'react';
import { useAuth } from '../../../context/AuthContext';
import MyWorkPage from '../../shared/MyWorkPage';
import CallFeedbackModal from './CallFeedbackModal';

/**
 * The Industry Manager's personal work page. The layout, the five summary cards,
 * the queue arithmetic and the task/strategy panels all live in MyWorkPage, which
 * the State Manager and the District Manager render too — only the wording, the
 * allocation target and the feedback dialog differ per role.
 */
const MyWork = () => {
  const { user } = useAuth();

  return (
    <MyWorkPage
      scopeLabel={user?.industry}
      subtitle="Your personal lead queue · District Partner leads · One-by-one execution"
      FeedbackModal={CallFeedbackModal}
      allocate={{
        role: 'executive',
        fieldLabel: 'District Manager',
        emptyMsg: 'No district managers found in your team.',
      }}
      navTargets={{
        myLeads:     '/dashboard?page=leads',
        completed:   '/dashboard?page=leads&completedToday=true',
        calls:       '/dashboard?page=calls&period=weekly',
        conversions: '/dashboard?page=leads&status=converted&period=month',
        blocking:    '/dashboard?page=leads&status=blocking_amount_received',
      }}
      extraInvalidateKeys={[['dashboard', 'industry-manager']]}
    />
  );
};

export default MyWork;
