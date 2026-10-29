import { http, HttpResponse } from 'msw';

import { paginator } from './fixtures';
import { server } from './server';

import type { Agent, CommissionType, ListedAgent } from '@/api/agents';

export function commissionTypeFixture(overrides: Partial<CommissionType> = {}): CommissionType {
  return {
    id: 1,
    name: 'Standard',
    energy_commission: 0.05,
    appliance_commission: 0.025,
    risk_balance: 10000,
    ...overrides,
  };
}

export function agentFixture(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 4,
    email: 'musa@example.com',
    balance: 42500,
    commission_revenue: 2000,
    created_at: '2025-03-12T08:00:00.000000Z',
    person: {
      id: 251,
      name: 'Musa',
      surname: 'Ibrahim',
      gender: 'male',
      birth_date: '1990-04-02',
      addresses: [{ id: 1, phone: '+2348034102276', is_primary: 1 }],
    },
    mini_grid: { id: 2, name: 'Kafanchan' },
    commission: commissionTypeFixture(),
    ...overrides,
  };
}

export function listedAgentFixture(overrides: Partial<ListedAgent> = {}): ListedAgent {
  return {
    ...agentFixture(),
    customer_count: 64,
    sales_count: 9,
    is_active: true,
    ...overrides,
  };
}

const empty = () => HttpResponse.json(paginator([]));

/** Every endpoint the agent screens read, answered from the given data. */
export function agentHandlers({
  agents = [listedAgentFixture()],
  agent = agentFixture(),
}: { agents?: ListedAgent[]; agent?: Agent } = {}) {
  server.use(
    http.get('/api/agents', () => HttpResponse.json({ data: agents })),
    http.get(`/api/agents/${agent.id}`, () => HttpResponse.json({ data: agent })),
    http.get('/api/agents/commissions', () =>
      HttpResponse.json({ data: [commissionTypeFixture()] }),
    ),
    http.get('/api/mini-grids', () =>
      HttpResponse.json({
        data: [
          { id: 2, name: 'Kafanchan' },
          { id: 3, name: 'Zonkwa' },
        ],
      }),
    ),
    http.get('/api/agents/assigned/:agentId', empty),
    http.get('/api/agents/sold/:agentId', empty),
    http.get('/api/agents/receipt/:agentId', empty),
    http.get('/api/agents/balance/history/:agentId', empty),
    http.get('/api/agents/transactions/:agentId', empty),
    http.get('/api/tickets/agents/:agentId', empty),
    http.get('/api/appliances', () =>
      HttpResponse.json({
        data: [
          {
            id: 8,
            name: 'Spark Steady Kit',
            price: 144000,
            appliance_type_id: 1,
            sold_count: 0,
          },
        ],
      }),
    ),
  );
}
