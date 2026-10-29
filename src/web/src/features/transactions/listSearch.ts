import { z } from 'zod';

import { deviceTypes } from '@/api/people';
import {
  analyticsPeriods,
  transactionSorts,
  transactionStatusCodes,
  type TransactionFilters,
  type TransactionQuery,
  type TransactionStatusFilter,
} from '@/api/transactions';

// The router parses search values as JSON, so `?serial=6380` arrives as a number.
const text = z.union([z.string(), z.number()]).transform(String).optional().catch(undefined);
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);
const positiveInteger = z.coerce.number().int().positive().optional().catch(undefined);

export const perPageOptions = [15, 50, 100] as const;
export const DEFAULT_PER_PAGE = 15;
export const DEFAULT_PERIOD = 3;

const statusFilters = Object.keys(transactionStatusCodes) as [
  TransactionStatusFilter,
  ...TransactionStatusFilter[],
];

/** Everything the transaction list shows lives in the URL, the open transaction included. */
export const transactionListSearchSchema = z.object({
  period: z
    .union(analyticsPeriods.map((period) => z.literal(period)))
    .optional()
    .catch(undefined),
  serial: text,
  status: z.enum(statusFilters).optional().catch(undefined),
  provider: z.string().optional().catch(undefined),
  device: z.enum(deviceTypes).optional().catch(undefined),
  from: isoDate,
  to: isoDate,
  page: positiveInteger,
  per_page: z
    .union(perPageOptions.map((size) => z.literal(size)))
    .optional()
    .catch(undefined),
  sort: z.enum(transactionSorts).optional().catch(undefined),
  transaction: positiveInteger,
});
export type TransactionListSearch = z.infer<typeof transactionListSearchSchema>;

export const filterKeys = ['serial', 'status', 'provider', 'device', 'from', 'to'] as const;
export type FilterKey = (typeof filterKeys)[number];

export function transactionFiltersOf(search: TransactionListSearch): TransactionFilters {
  return {
    deviceType: search.device,
    provider: search.provider,
    status: search.status === undefined ? undefined : transactionStatusCodes[search.status],
    serial_number: search.serial?.trim() || undefined,
    from: search.from,
    to: search.to,
  };
}

export function transactionQueryOf(search: TransactionListSearch): TransactionQuery {
  return {
    ...transactionFiltersOf(search),
    page: search.page,
    per_page: search.per_page ?? DEFAULT_PER_PAGE,
    sort_by: search.sort ?? '-created_at',
  };
}
