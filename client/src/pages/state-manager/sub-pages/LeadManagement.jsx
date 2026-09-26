import React from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { Button } from '../../../components/ui';
import LeadManagementPage from '../../shared/LeadManagementPage';

// Same page the Founder and Industry Manager dashboards render -- same filters,
// tabs, table and actions. The rows differ only because the API scopes every query
// to this State Manager's reporting tree.
//
// `ownerScope` splits the two sidebar entries, the way the Industry Manager's
// already are: 'self' for My Work > Lead Management (this manager's own leads),
// 'team' for Team > Lead Management (everyone reporting under them). An explicit
// ?owner= in the URL still wins, which is how the Overview cards widen the view
// back to the whole subtree they counted.
const LeadManagement = ({ ownerScope = '' }) => {
  const { user } = useAuth();
  const state = user?.state;

  const title = ownerScope === 'self' ? 'My Leads' : ownerScope === 'team' ? 'Team Leads' : 'Lead Management';
  const scopeLine = ownerScope === 'self'
    ? 'My own leads'
    : ownerScope === 'team'
      ? 'Industry & District Manager leads'
      : 'Statewide lead tracking';

  return (
    <LeadManagementPage
      breadcrumbRoot="State Manager"
      defaultTitle={title}
      subtitle={`${scopeLine} · ${state ? `${state} · ` : ''}Allocation control · Lifecycle monitoring`}
      listTitle={ownerScope === 'self' ? 'My Lead List' : 'State Lead List'}
      footerNoun={ownerScope === 'self' ? 'leads' : 'state leads'}
      exportPrefix={ownerScope === 'self' ? 'my-leads-export' : 'state-leads-export'}
      defaultOwnerScope={ownerScope}
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
