import React from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { Button } from '../../../components/ui';
import LeadManagementPage from '../../shared/LeadManagementPage';

// Same page the Founder dashboard renders -- same filters, tabs, table and
// actions. The rows differ only because the API scopes every query to this
// State Manager's reporting tree.
const LeadManagement = () => {
  const { user } = useAuth();
  const state = user?.state;

  return (
    <LeadManagementPage
      breadcrumbRoot="State Manager"
      defaultTitle="Lead Management"
      subtitle={`${state ? `${state} · ` : ''}Statewide lead tracking · Allocation control · Lifecycle monitoring`}
      listTitle="State Lead List"
      footerNoun="state leads"
      exportPrefix="state-leads-export"
      // Escalating to the Founder is the one action the Founder's own page has no
      // use for, so it is added here rather than living in the shared component.
      extraRowActions={(lead, openModal) => (
        <Button
          size="2xs"
          variant="outline"
          className="bg-white border-amber/20 text-amber shadow-sm font-bold"
          onClick={() => openModal('escalate-lead', { leadData: lead })}
        >
          Escalate
        </Button>
      )}
    />
  );
};

export default LeadManagement;
