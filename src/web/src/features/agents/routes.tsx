import { createRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { AgentDetail } from './AgentDetail';
import { AgentList } from './AgentList';
import { CommissionTypes } from './CommissionTypes';
import { agentTabs } from './labels';
import { agentListSearchSchema } from './listSearch';

import { authenticatedRoute, positiveId } from '@/routes/base';

const agentsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/agents',
  validateSearch: agentListSearchSchema,
  component: function AgentsRoute() {
    return <AgentList search={agentsRoute.useSearch()} />;
  },
});

const agentRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/agents/$agentId',
  params: {
    parse: ({ agentId }) => ({ agentId: positiveId.parse(agentId) }),
    stringify: ({ agentId }) => ({ agentId: String(agentId) }),
  },
  validateSearch: z.object({ tab: z.enum(agentTabs).optional().catch(undefined) }),
  component: function AgentRoute() {
    const { agentId } = agentRoute.useParams();
    const { tab } = agentRoute.useSearch();
    return <AgentDetail agentId={agentId} tab={tab ?? 'assigned'} />;
  },
});

const commissionTypesRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/agents/commissions',
  component: CommissionTypes,
});

export const agentRoutes = [agentsRoute, agentRoute, commissionTypesRoute];
