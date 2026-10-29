import { z } from 'zod';

import { apiDownload, apiRequest } from './client';
import {
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
export const mapSettingsSchema = dataOf(
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

/** The company's map defaults (centre and zoom), or null when none are configured. */
export const fetchMapSettings = async () =>
  (await apiRequest('/map-settings', mapSettingsSchema)).data[0] ?? null;

export async function login(email: string, password: string): Promise<Session> {
  const response = await apiRequest('/auth/login', loginResponseSchema, {
    method: 'POST',
    body: { email, password },
  });
  const session = writeSession(response);
  const [mainSettings, mapSettings] = await Promise.all([
    apiRequest('/settings/main', legacyMainSettingsSchema),
    fetchMapSettings(),
  ]);
  writeLegacySettings(mainSettings.data, mapSettings);
  return session;
}

const mainSettingsSchema = dataOf(
  z.object({
    company_name: z.string(),
    currency: z.string(),
    country: z.string().nullable().optional(),
    enabled_modules: z.array(z.string()).nullable().optional(),
  }),
);

export const fetchMainSettings = async () =>
  (await apiRequest('/settings/main', mainSettingsSchema)).data;

const pluginsSchema = dataOf(z.array(z.object({ mpm_plugin_id: z.number(), status: z.number() })));

/** Ids of the plugins this company has switched on. */
export const fetchEnabledPluginIds = async () =>
  (await apiRequest('/plugins', pluginsSchema)).data
    .filter((plugin) => plugin.status === 1)
    .map((plugin) => plugin.mpm_plugin_id);

export const fetchCustomer = async (customerId: number) =>
  (await apiRequest(`/people/${customerId}`, dataOf(personSchema))).data;

export const fetchContracts = async (customerId: number) =>
  (await apiRequest(`/appliances/person/people/${customerId}`, dataOf(z.array(contractSchema))))
    .data;

export const fetchPayments = (customerId: number, page = 1) =>
  apiRequest(`/people/${customerId}/transactions`, pageOf(paymentSchema), { query: { page } });

export const fetchDocuments = async (customerId: number) =>
  (await apiRequest(`/people/${customerId}/documents`, dataOf(z.array(documentSchema)))).data;

/** The backend's `PersonDocumentUploadService::MAX_DOCUMENTS_PER_PERSON`. */
export const MAX_DOCUMENTS_PER_CUSTOMER = 3;

export const uploadDocument = async (customerId: number, file: File, type: string) => {
  const form = new FormData();
  form.append('file', file);
  form.append('type', type);
  return (
    await apiRequest(`/people/${customerId}/documents`, dataOf(documentSchema), {
      method: 'POST',
      body: form,
    })
  ).data;
};

export const downloadDocument = (documentId: number) =>
  apiDownload(`/person-documents/${documentId}/download`);

export const deleteDocument = (documentId: number) =>
  apiRequest(`/person-documents/${documentId}`, z.unknown(), { method: 'DELETE' });

export const fetchTickets = (customerId: number) =>
  apiRequest(`/tickets/user/${customerId}`, pageOf(ticketSchema));

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
