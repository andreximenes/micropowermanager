import { z } from 'zod';

import { apiRequest } from './client';
import {
  applianceSchema,
  contractSchema,
  dataOf,
  documentSchema,
  pageOf,
  paymentSchema,
  personSchema,
  stockDeviceSchema,
  ticketSchema,
} from './schemas';

import {
  loginResponseSchema,
  writeLegacySettings,
  writeSession,
  type Session,
} from '@/auth/session';

const legacyMainSettingsSchema = dataOf(z.record(z.string(), z.unknown()));
const legacyMapSettingsSchema = dataOf(
  z.array(
    z.object({
      id: z.number(),
      zoom: z.number(),
      latitude: z.number(),
      longitude: z.number(),
      provider: z.string().nullable(),
    }),
  ),
);

export async function login(email: string, password: string): Promise<Session> {
  const response = await apiRequest('/auth/login', loginResponseSchema, {
    method: 'POST',
    body: { email, password },
  });
  const session = writeSession(response);
  const [mainSettings, mapSettings] = await Promise.all([
    apiRequest('/settings/main', legacyMainSettingsSchema),
    apiRequest('/map-settings', legacyMapSettingsSchema),
  ]);
  writeLegacySettings(mainSettings.data, mapSettings.data[0] ?? null);
  return session;
}

const mainSettingsSchema = dataOf(
  z.object({ company_name: z.string(), currency: z.string() }),
);

export const fetchMainSettings = async () =>
  (await apiRequest('/settings/main', mainSettingsSchema)).data;

export const fetchCustomer = async (customerId: number) =>
  (await apiRequest(`/people/${customerId}`, dataOf(personSchema))).data;

export const fetchContracts = async (customerId: number) =>
  (await apiRequest(`/appliances/person/people/${customerId}`, dataOf(z.array(contractSchema)))).data;

export const fetchPayments = (customerId: number, page = 1) =>
  apiRequest(`/people/${customerId}/transactions`, pageOf(paymentSchema), { query: { page } });

export const fetchDocuments = async (customerId: number) =>
  (await apiRequest(`/people/${customerId}/documents`, dataOf(z.array(documentSchema)))).data;

export const fetchTickets = (customerId: number) =>
  apiRequest(`/tickets/user/${customerId}`, pageOf(ticketSchema));

export const fetchAppliances = async () =>
  (await apiRequest('/appliances', dataOf(z.array(applianceSchema)))).data;

export const fetchStockDevices = (applianceId: number, serial: string) =>
  apiRequest('/devices', pageOf(stockDeviceSchema), {
    query: { appliance_id: applianceId, unassigned: 1, serial: serial || undefined, per_page: 10 },
  });

export type SaleInput =
  | {
      paymentType: 'installment';
      cost: number;
      downPayment: number;
      rateCount: number;
      rateType: 'monthly' | 'weekly';
    }
  | { paymentType: 'energy_service'; pricePerDay: number; minimumPayableAmount: number };

export type SaleRequest = {
  userId: number;
  customerId: number;
  applianceId: number;
  deviceSerial: string | null;
  location: { latitude: number; longitude: number } | null;
  plan: SaleInput;
};

export function saleBody(request: SaleRequest): Record<string, unknown> {
  const common = {
    user_id: request.userId,
    payment_type: request.plan.paymentType,
    device_serial: request.deviceSerial,
    points: request.location ? `${request.location.latitude},${request.location.longitude}` : null,
  };
  if (request.plan.paymentType === 'energy_service') {
    return {
      ...common,
      price_per_day: request.plan.pricePerDay,
      minimum_payable_amount: request.plan.minimumPayableAmount,
    };
  }
  return {
    ...common,
    cost: request.plan.cost,
    down_payment: request.plan.downPayment,
    rate: request.plan.rateCount,
    rate_type: request.plan.rateType,
  };
}

export const sellProduct = (request: SaleRequest) =>
  apiRequest(
    `/appliances/person/${request.applianceId}/people/${request.customerId}`,
    z.object({ data: z.unknown() }),
    { method: 'POST', body: saleBody(request) },
  );
