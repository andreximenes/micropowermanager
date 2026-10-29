import { createRoute } from '@tanstack/react-router';

import { ticketListSearchSchema } from './listSearch';
import { TicketList } from './TicketList';
import { TicketSettings } from './TicketSettings';

import { authenticatedRoute } from '@/routes/base';

// The open ticket is a search parameter, so its panel opens over the list as filtered.
const ticketsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/tickets',
  validateSearch: ticketListSearchSchema,
  component: function TicketsRoute() {
    return <TicketList search={ticketsRoute.useSearch()} />;
  },
});

const ticketSettingsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/tickets/settings',
  component: TicketSettings,
});

export const ticketRoutes = [ticketsRoute, ticketSettingsRoute];
