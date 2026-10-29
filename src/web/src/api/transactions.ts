import { z } from 'zod';

import { apiDownload, apiRequest } from './client';
import { dataOf, paginatorOf } from './schemas';

import type { DeviceType } from './people';

// Money columns are decimals in MySQL, which some providers' tables serialise as strings.
const amount = z.coerce.number();

const personNameSchema = z.object({ id: z.number(), name: z.string(), surname: z.string() });

/** The payment provider's own record; its fields differ from one provider to the next. */
const originalTransactionSchema = z
  .object({
    id: z.number(),
    // Payment providers: 1 or 2 confirmed, 0 processing, -1 rejected, 3 cancelled.
    status: z.number(),
  })
  .loose();

export const listedTransactionSchema = z.object({
  id: z.number(),
  amount,
  type: z.string().nullable(),
  sender: z.string().nullable(),
  /** The device serial the payment was made for. */
  message: z.string().nullable(),
  original_transaction_type: z.string(),
  created_at: z.string(),
  original_transaction: originalTransactionSchema.nullable(),
  device: z
    .object({ device_type: z.string(), person: personNameSchema.nullable() })
    .nullable()
    .optional(),
});
export type ListedTransaction = z.infer<typeof listedTransactionSchema>;

export const transactionSorts = [
  'created_at',
  '-created_at',
  'amount',
  '-amount',
  'sender',
  '-sender',
  'original_transaction_type',
  '-original_transaction_type',
] as const;
export type TransactionSort = (typeof transactionSorts)[number];

export const transactionStatusCodes = { confirmed: 1, processing: 0, rejected: -1, cancelled: 3 };
export type TransactionStatusFilter = keyof typeof transactionStatusCodes;

/** The filters `/transactions/advanced` and `/export/transactions` share. */
export type TransactionFilters = {
  deviceType?: DeviceType;
  provider?: string;
  status?: number;
  serial_number?: string;
  from?: string;
  to?: string;
};

export type TransactionQuery = TransactionFilters & {
  page?: number;
  per_page: number;
  sort_by: TransactionSort;
};

export const fetchTransactions = (query: TransactionQuery) =>
  apiRequest('/transactions/advanced', paginatorOf(listedTransactionSchema), { query });

const periodTotalsSchema = z.object({
  total: z.number(),
  amount,
  confirmed: z.number(),
  cancelled: z.number(),
});
export type PeriodTotals = z.infer<typeof periodTotalsSchema>;

const analyticsSchema = z.object({ current: periodTotalsSchema, past: periodTotalsSchema });

export const analyticsPeriods = [0, 1, 2, 3] as const;
export type AnalyticsPeriod = (typeof analyticsPeriods)[number];

/** Totals for a period and for the period it is compared with. */
export const fetchTransactionAnalytics = (period: AnalyticsPeriod) =>
  apiRequest(`/transactions/analytics/${period}`, analyticsSchema);

/** Provider keys such as `wavecom_transaction`, as the provider filter expects them. */
export const fetchTransactionProviders = async () =>
  (await apiRequest('/transaction-providers', dataOf(z.array(z.string())))).data;

const paymentHistorySchema = z.object({
  id: z.number(),
  amount,
  payment_type: z.string(),
  paid_for_type: z.string(),
  paid_for: z
    .object({
      appliance_person_id: z.number().optional(),
      rate_cost: amount.optional(),
      due_date: z.string().nullable().optional(),
    })
    .loose()
    .nullable(),
});
export type PaymentHistory = z.infer<typeof paymentHistorySchema>;

export const transactionDetailSchema = listedTransactionSchema.extend({
  token: z
    .object({
      token: z.string(),
      token_amount: amount.nullable(),
      token_unit: z.string().nullable(),
    })
    .nullable(),
  original_transaction: originalTransactionSchema
    .extend({
      conflicts: z.array(z.object({ id: z.number(), state: z.string() })).default([]),
      user: z.object({ name: z.string() }).nullable().optional(),
    })
    .nullable(),
  sms: z
    .object({
      receiver: z.string().nullable(),
      body: z.string().nullable(),
      status: z.number(),
      created_at: z.string().nullable(),
    })
    .nullable(),
  payment_histories: z.array(paymentHistorySchema),
  device: z
    .object({
      device_type: z.string(),
      device_serial: z.string(),
      person: personNameSchema.nullable(),
    })
    .nullable()
    .optional(),
  /** Only for appliances sold without a device, found through the installments it paid. */
  appliance: z
    .object({
      id: z.number(),
      appliance: z.object({ name: z.string() }).nullable().optional(),
      person: personNameSchema.nullable().optional(),
    })
    .nullable()
    .optional(),
});
export type TransactionDetail = z.infer<typeof transactionDetailSchema>;

export const fetchTransaction = async (transactionId: number) =>
  (await apiRequest(`/transactions/${transactionId}`, dataOf(transactionDetailSchema))).data;

export const exportTransactions = (filters: TransactionFilters) =>
  apiDownload('/export/transactions', { format: 'csv', ...filters });
