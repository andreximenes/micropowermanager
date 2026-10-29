import { z } from 'zod';

import { deviceTypes, peopleSorts, type PeopleQuery } from '@/api/people';

// The router parses search values as JSON, so `?term=6380` arrives as a number.
const text = z.union([z.string(), z.number()]).transform(String).optional().catch(undefined);
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);
const id = z.coerce.number().int().positive().optional().catch(undefined);

export const perPageOptions = [15, 50, 100] as const;

/** Everything the customer list shows lives in the URL, so reload, back and links keep it. */
export const customerListSearchSchema = z.object({
  term: text,
  status: z.enum(['paying', 'not_paying']).optional().catch(undefined),
  village: id,
  agent: id,
  device: z.enum(deviceTypes).optional().catch(undefined),
  overdue: z.boolean().optional().catch(undefined),
  paid_from: isoDate,
  paid_to: isoDate,
  registered_from: isoDate,
  registered_to: isoDate,
  page: z.coerce.number().int().positive().optional().catch(undefined),
  per_page: z
    .union(perPageOptions.map((size) => z.literal(size)))
    .optional()
    .catch(undefined),
  sort: z.enum(peopleSorts).optional().catch(undefined),
});
export type CustomerListSearch = z.infer<typeof customerListSearchSchema>;

export const filterKeys = [
  'status',
  'village',
  'agent',
  'device',
  'overdue',
  'paid_from',
  'paid_to',
  'registered_from',
  'registered_to',
] as const;
export type FilterKey = (typeof filterKeys)[number];

export const DEFAULT_PER_PAGE = 15;

export function peopleQueryOf(search: CustomerListSearch): PeopleQuery {
  return {
    page: search.page,
    per_page: search.per_page ?? DEFAULT_PER_PAGE,
    sort_by: search.sort ?? '-created_at',
    term: search.term?.trim() || undefined,
    active_customer: search.status === undefined ? undefined : search.status === 'paying' ? 1 : 0,
    city_id: search.village,
    agent_id: search.agent,
    device_type: search.device,
    overdue: search.overdue ? 1 : undefined,
    latest_payment_from: search.paid_from,
    latest_payment_to: search.paid_to,
    registration_from: search.registered_from,
    registration_to: search.registered_to,
  };
}
