import { z } from 'zod';

import type { TicketQuery } from '@/api/tickets';

const id = z.coerce.number().int().positive().optional().catch(undefined);

export const perPageOptions = [15, 50, 100] as const;
export const DEFAULT_PER_PAGE = 15;

/** Everything the ticket list shows lives in the URL, the open ticket included. */
export const ticketListSearchSchema = z.object({
  status: z.enum(['open', 'closed']).optional().catch(undefined),
  category: id,
  /** "me" or a ticket user's id. */
  assigned: z
    .union([z.literal('me'), z.coerce.number().int().positive()])
    .optional()
    .catch(undefined),
  page: id,
  per_page: z
    .union(perPageOptions.map((size) => z.literal(size)))
    .optional()
    .catch(undefined),
  ticket: id,
});
export type TicketListSearch = z.infer<typeof ticketListSearchSchema>;

export const filterKeys = ['category', 'assigned'] as const;

/**
 * The query for the list. `myTicketUserId` resolves "assigned to me"; while it is unknown the
 * filter cannot be applied, so the caller waits for it.
 */
export function ticketQueryOf(
  search: TicketListSearch,
  myTicketUserId: number | undefined,
): TicketQuery {
  return {
    status: search.status === 'closed' ? 1 : 0,
    category: search.category,
    person: search.assigned === 'me' ? myTicketUserId : search.assigned,
    page: search.page,
    limit: search.per_page ?? DEFAULT_PER_PAGE,
  };
}
