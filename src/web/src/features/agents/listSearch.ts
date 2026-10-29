import { z } from 'zod';

import { primaryPhone, type ListedAgent } from '@/api/agents';

// The router parses search values as JSON, so `?term=0803` arrives as a number.
const text = z.union([z.string(), z.number()]).transform(String).optional().catch(undefined);

export const perPageOptions = [15, 50, 100] as const;
export const DEFAULT_PER_PAGE = 15;

/** Everything the agent list shows lives in the URL, so reload, back and links keep it. */
export const agentListSearchSchema = z.object({
  term: text,
  status: z.enum(['active', 'inactive']).optional().catch(undefined),
  page: z.coerce.number().int().positive().optional().catch(undefined),
  per_page: z
    .union(perPageOptions.map((size) => z.literal(size)))
    .optional()
    .catch(undefined),
});
export type AgentListSearch = z.infer<typeof agentListSearchSchema>;

const normalized = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();

/** Whether an agent matches a search by name, phone, e-mail or mini-grid. */
export function matchesTerm(agent: ListedAgent, term: string): boolean {
  const wanted = normalized(term);
  if (wanted === '') {
    return true;
  }
  const digits = wanted.replace(/\D/g, '');
  const phone = (primaryPhone(agent) ?? '').replace(/\D/g, '');
  const haystack = normalized(
    [agent.person.name, agent.person.surname, agent.email, agent.mini_grid?.name ?? ''].join(' '),
  );
  return haystack.includes(wanted) || (digits.length >= 3 && phone.includes(digits));
}

export function filterAgents(agents: ListedAgent[], search: AgentListSearch): ListedAgent[] {
  return agents.filter(
    (agent) =>
      matchesTerm(agent, search.term ?? '') &&
      (search.status === undefined || agent.is_active === (search.status === 'active')),
  );
}
