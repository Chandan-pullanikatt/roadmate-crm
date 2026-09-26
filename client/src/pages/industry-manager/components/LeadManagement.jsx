import React from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { Button } from '../../../components/ui';
import LeadManagementPage from '../../shared/LeadManagementPage';

// Same page the Founder and State Manager dashboards render -- same filters, tabs,
// table and actions. `ownerScope` is what the route was already built around:
// 'self' for My Works > Lead Management, 'team' for Team > Lead Management. An
// explicit ?owner= in the URL still wins, which is how the Overview cards widen
// the view to the whole subtree they counted.
const LeadManagement = ({ ownerScope = '' }) => {
  const { user } = useAuth();
  const industry = user?.industry;

  const title = ownerScope === 'self' ? 'My Leads' : ownerScope === 'team' ? 'Team Leads' : 'Lead Management';
  const scopeLine = ownerScope === 'self'
    ? 'My own leads'
    : ownerScope === 'team'
      ? 'District Manager leads'
      : 'All leads in my reporting line';

  return (
    <LeadManagementPage
      breadcrumbRoot="Industry Hub"
      defaultTitle={title}
      subtitle={`${scopeLine} · ${industry ? `${industry} · ` : ''}Allocation control · Lifecycle monitoring`}
      listTitle={title}
      footerNoun="leads"
      exportPrefix="industry-leads-export"
      defaultOwnerScope={ownerScope}
      showStateColumn={false}
      // Escalation goes one step up the reporting line, so an Industry Manager
      // escalates to their State Manager -- the modal picks the target, this only
      // puts the action on the row.
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
