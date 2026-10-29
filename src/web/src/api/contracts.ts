import { z } from 'zod';

import { apiRequest } from './client';
import { contractSchema, dataOf, rateSchema } from './schemas';

// Money columns are decimals in MySQL, which some drivers serialise as strings.
const amount = z.coerce.number();

const contractRateSchema = rateSchema.extend({
  rate_cost: amount,
  remaining: amount,
});

export const contractDetailSchema = contractSchema.extend({
  person_id: z.number(),
  total_cost: amount,
  rate_count: amount,
  down_payment: amount.nullable(),
  price_per_day: amount.nullable(),
  minimum_payable_amount: amount.nullable(),
  first_payment_date: z.string().nullable(),
  rates: z.array(contractRateSchema),
  device: z
    .object({ device_type: z.string(), device_id: z.number(), device_serial: z.string() })
    .nullable(),
  rateType: z.enum(['weekly', 'monthly']),
});
export type ContractDetail = z.infer<typeof contractDetailSchema>;

export const contractLogSchema = z.object({
  id: z.number(),
  action: z.string(),
  created_at: z.string().nullable(),
  owner: z.object({ name: z.string() }).nullable(),
});
export type ContractLog = z.infer<typeof contractLogSchema>;

const logPageSchema = z.object({
  data: z.array(contractLogSchema),
  current_page: z.number(),
  last_page: z.number(),
});

export const solarHomeSystemSchema = z.object({
  id: z.number(),
  manufacturer: z.object({ name: z.string() }).nullable().optional(),
  tokens: z
    .array(
      z.object({
        id: z.number(),
        token_amount: amount.nullable().optional(),
        token_unit: z.string().nullable().optional(),
        created_at: z.string().nullable(),
      }),
    )
    .optional(),
});
export type SolarHomeSystem = z.infer<typeof solarHomeSystemSchema>;

const providersSchema = dataOf(z.array(z.object({ id: z.number(), name: z.string() })));
export type PaymentProvider = { id: number; name: string };

/** Cash is handled by the backend as provider 0 and is never part of the provider list. */
export const CASH_PROVIDER: PaymentProvider = { id: 0, name: 'Cash' };

const paymentStartedSchema = dataOf(
  z.object({
    transaction_id: z.number(),
    // Rendered as a link, so only an https page is accepted (never javascript: or http:).
    redirect_url: z.url({ protocol: /^https$/ }).optional(),
  }),
);

const paymentStatusSchema = dataOf(
  z.object({ status: z.enum(['processing', 'processed', 'failed']), processed: z.boolean() }),
);
export type PaymentOutcome = 'processed' | 'failed' | 'processing';

const anyData = z.object({ data: z.unknown() });

export const fetchContractDetail = async (contractId: number) =>
  (await apiRequest(`/appliances/person/people/detail/${contractId}`, dataOf(contractDetailSchema)))
    .data;

export const fetchContractLogs = (contractId: number, page: number) =>
  apiRequest(`/appliances/person/${contractId}/logs`, logPageSchema, {
    query: { page, per_page: 10 },
  });

export const fetchSolarHomeSystem = async (solarHomeSystemId: number) =>
  (await apiRequest(`/solar-home-systems/${solarHomeSystemId}`, dataOf(solarHomeSystemSchema)))
    .data;

export const fetchPaymentProviders = async (): Promise<PaymentProvider[]> => [
  CASH_PROVIDER,
  ...(await apiRequest('/appliances/payment/providers', providersSchema)).data,
];

export const startPayment = async (
  contractId: number,
  payment: { amount: number; providerId: number },
) =>
  (
    await apiRequest(`/appliances/payment/${contractId}`, paymentStartedSchema, {
      method: 'POST',
      body: { amount: payment.amount, payment_provider: payment.providerId },
    })
  ).data;

const wait = (milliseconds: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

/**
 * Payments are processed by a queue worker, so the transaction is checked until it settles.
 * After `attempts` checks it is reported as still processing rather than as an error: the
 * payment may well go through later.
 */
export async function waitForPayment(
  transactionId: number,
  { intervalMs = 1000, attempts = 20 }: { intervalMs?: number; attempts?: number } = {},
): Promise<PaymentOutcome> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const { status } = (
      await apiRequest(`/appliances/payment/status/${transactionId}`, paymentStatusSchema)
    ).data;
    if (status !== 'processing') {
      return status;
    }
    if (attempt < attempts) {
      await wait(intervalMs);
    }
  }
  return 'processing';
}

export const updateRateCost = (rateId: number, newCost: number) =>
  apiRequest(`/appliances/rates/${rateId}`, anyData, { method: 'PUT', body: { newCost } });

export type PlanChange = {
  newTotalCost: number;
  schedule?: { rateCount: number; rateType: 'monthly' | 'weekly' };
};

export const changePlan = (contractId: number, change: PlanChange) =>
  apiRequest(`/appliances/person/${contractId}/total-cost`, anyData, {
    method: 'PUT',
    body: {
      new_total_cost: change.newTotalCost,
      ...(change.schedule
        ? { rate_count: change.schedule.rateCount, rate_type: change.schedule.rateType }
        : {}),
    },
  });

export const deleteContract = (contractId: number) =>
  apiRequest(`/appliances/person/${contractId}`, anyData, { method: 'DELETE' });
