import { http, HttpResponse } from 'msw';

import { paginator } from './fixtures';
import { server } from './server';

import type { Ticket, TicketCategory } from '@/api/tickets';

export function ticketCategoryFixture(overrides: Partial<TicketCategory> = {}): TicketCategory {
  return { id: 3, label_name: 'Device fault', label_color: 'red', out_source: false, ...overrides };
}

export function listedTicketFixture(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 2291,
    title: 'Kit not charging after rain',
    content: 'Battery light stays red since the storm.',
    status: 0,
    due_date: '2026-10-26',
    created_at: '2026-10-24T08:00:00.000000Z',
    category: ticketCategoryFixture(),
    owner: { id: 7, name: 'Chinedu', surname: 'Okafor' },
    assigned_to: { id: 11, user_name: 'Musa Ibrahim', out_source: false },
    comments: [],
    ...overrides,
  };
}

/** `GET /api/tickets/users`: CRM users, with the ticket user tickets point at. */
export const crmUsers = [
  {
    id: 1,
    name: 'Grace Admin',
    email: 'grace@example.com',
    relation_ticket_user: { id: 10 },
  },
  { id: 2, name: 'Musa Ibrahim', email: 'musa@example.com', relation_ticket_user: { id: 11 } },
  { id: 3, name: 'New Hire', email: null, relation_ticket_user: null },
];

type TicketListData = { open?: Ticket[]; closed?: Ticket[]; categories?: TicketCategory[] };

/** Every endpoint the ticket list reads; returns the list requests it received. */
export function ticketListHandlers({
  open = [listedTicketFixture()],
  closed = [],
  categories = [
    ticketCategoryFixture(),
    ticketCategoryFixture({
      id: 4,
      label_name: 'Installation',
      label_color: 'green',
      out_source: true,
    }),
  ],
}: TicketListData = {}) {
  const requests: URLSearchParams[] = [];
  server.use(
    http.get('/api/tickets/ticket', ({ request }) => {
      const params = new URL(request.url).searchParams;
      const rows = params.get('status') === '1' ? closed : open;
      if (params.get('limit') === '1') {
        return HttpResponse.json(paginator(rows.slice(0, 1), { perPage: 1, total: rows.length }));
      }
      requests.push(params);
      return HttpResponse.json(paginator(rows));
    }),
    http.get('/api/tickets/labels', () => HttpResponse.json({ data: categories })),
    http.get('/api/tickets/users', () => HttpResponse.json({ data: crmUsers })),
  );
  return requests;
}
