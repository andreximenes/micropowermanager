import { z } from 'zod';

import { apiRequest } from './client';
import { dataOf, geoSchema, paginatorOf } from './schemas';

// Money and credit columns are decimals in MySQL, which some drivers serialise as strings.
const amount = z.coerce.number();

export const mappingStatuses = ['unknown', 'mapped', 'not_mapped', 'unsupported'] as const;
export type MappingStatus = (typeof mappingStatuses)[number];

const ownerSchema = z.object({
  id: z.number(),
  name: z.string(),
  surname: z.string(),
  addresses: z
    .array(
      z.object({
        phone: z.string().nullable(),
        street: z.string().nullable(),
        is_primary: z.number(),
        city: z.object({ id: z.number(), name: z.string() }).nullable().optional(),
      }),
    )
    .optional(),
});
export type Owner = z.infer<typeof ownerSchema>;

const namedSchema = z.object({ id: z.number(), name: z.string() });

export const listedSolarHomeSystemSchema = z.object({
  id: z.number(),
  serial_number: z.string(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  manufacturer: namedSchema.nullable(),
  /** Null when kit sync found no product rule for the kit's type. */
  appliance: namedSchema.nullable(),
  device: z
    .object({
      id: z.number(),
      person_id: z.number().nullable(),
      manufacturer_mapping_status: z.enum(mappingStatuses).catch('unknown'),
      manufacturer_mapping_checked_at: z.string().nullable(),
      person: ownerSchema.nullable(),
      geo: geoSchema,
    })
    .nullable(),
});
export type ListedSolarHomeSystem = z.infer<typeof listedSolarHomeSystemSchema>;

const tokenSchema = z.object({
  id: z.number(),
  token: z.string(),
  token_type: z.string().nullable().optional(),
  token_amount: amount.nullable().optional(),
  token_unit: z.string().nullable().optional(),
  created_at: z.string().nullable(),
});
export type DeviceToken = z.infer<typeof tokenSchema>;

export const solarHomeSystemSchema = listedSolarHomeSystemSchema.extend({
  manufacturer_id: z.number(),
  appliance_id: z.number().nullable(),
  tokens: z.array(tokenSchema),
});
export type SolarHomeSystem = z.infer<typeof solarHomeSystemSchema>;

export const solarHomeSystemSorts = [
  '-updated_at',
  '-created_at',
  'serial_number',
  'owner',
] as const;
export type SolarHomeSystemSort = (typeof solarHomeSystemSorts)[number];

export type SolarHomeSystemQuery = {
  page?: number;
  per_page?: number;
  sort_by?: SolarHomeSystemSort;
  term?: string;
};

export const fetchSolarHomeSystems = (query: SolarHomeSystemQuery) =>
  apiRequest('/solar-home-systems', paginatorOf(listedSolarHomeSystemSchema), { query });

const totalSchema = z.object({ total: z.number() });

/** How many solar home systems there are, and how many of them no customer owns yet. */
export async function countSolarHomeSystems() {
  const [all, inStock] = await Promise.all([
    apiRequest('/solar-home-systems', totalSchema, { query: { per_page: 1 } }),
    apiRequest('/devices', totalSchema, {
      query: { device_type: 'solar_home_system', unassigned: 1, per_page: 1 },
    }),
  ]);
  return { total: all.total, inStock: inStock.total };
}

export const fetchSolarHomeSystem = async (solarHomeSystemId: number) =>
  (await apiRequest(`/solar-home-systems/${solarHomeSystemId}`, dataOf(solarHomeSystemSchema)))
    .data;

export type NewSolarHomeSystems = {
  serialNumbers: string[];
  manufacturerId: number;
  productId: number;
};

export const createSolarHomeSystems = (input: NewSolarHomeSystems) =>
  apiRequest('/solar-home-systems', dataOf(z.array(z.object({ id: z.number() }))), {
    method: 'POST',
    body: {
      serial_numbers: input.serialNumbers,
      manufacturer_id: input.manufacturerId,
      appliance_id: input.productId,
    },
  });

export type SolarHomeSystemChanges = {
  /** Only a changed serial is sent: older serials can break today's length rule. */
  serialNumber?: string;
  manufacturerId: number;
  productId: number;
};

export const updateSolarHomeSystem = (solarHomeSystemId: number, changes: SolarHomeSystemChanges) =>
  apiRequest(`/solar-home-systems/${solarHomeSystemId}`, dataOf(z.object({ id: z.number() })), {
    method: 'PUT',
    body: {
      ...(changes.serialNumber === undefined ? {} : { serial_number: changes.serialNumber }),
      manufacturer_id: changes.manufacturerId,
      appliance_id: changes.productId,
    },
  });

export const deleteSolarHomeSystem = (solarHomeSystemId: number) =>
  apiRequest(`/solar-home-systems/${solarHomeSystemId}`, z.unknown(), { method: 'DELETE' });

const deviceTransactionSchema = z.object({
  id: z.number(),
  amount,
  payment_service: z.string().nullable(),
  payment_type: z.string(),
  created_at: z.string(),
  /** The token the payment bought, when it bought one. */
  paid_for: z
    .object({
      token: z.string().optional(),
      token_amount: amount.nullable().optional(),
      token_unit: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});
export type DeviceTransaction = z.infer<typeof deviceTransactionSchema>;

export const fetchSolarHomeSystemTransactions = (
  solarHomeSystemId: number,
  page: number,
  perPage = 10,
) =>
  apiRequest(
    `/solar-home-systems/${solarHomeSystemId}/transactions`,
    paginatorOf(deviceTransactionSchema),
    { query: { page, per_page: perPage } },
  );

const manufacturerSchema = z.object({ id: z.number(), name: z.string(), type: z.string() });

export const fetchShsManufacturers = async () =>
  (await apiRequest('/manufacturers', dataOf(z.array(manufacturerSchema)))).data.filter(
    (manufacturer) => manufacturer.type === 'shs',
  );

const capabilitiesSchema = z.object({
  token_generation: z.boolean(),
  unlock_token: z.boolean(),
  reset_token: z.boolean(),
  /** The unit credit can be issued in besides money, e.g. `days`. */
  credit_unit: z.string().nullable(),
  token_generation_blocked_reason: z.string().nullable(),
});
export type DeviceCapabilities = z.infer<typeof capabilitiesSchema>;

export const fetchDeviceCapabilities = async (deviceId: number) =>
  (await apiRequest(`/devices/${deviceId}/capabilities`, dataOf(capabilitiesSchema))).data;

const mappingCheckSchema = z.object({
  supported: z.boolean(),
  mapped: z.boolean().optional(),
  device: z.record(z.string(), z.unknown()).nullable().optional(),
});
export type MappingCheck = z.infer<typeof mappingCheckSchema>;

/** Asks the manufacturer whether the device is still mapped to this company; the answer is saved. */
export const checkDeviceMapping = async (deviceId: number) =>
  (await apiRequest(`/devices/${deviceId}/device-info`, dataOf(mappingCheckSchema))).data;

export type TokenRequest =
  { type: 'credit'; amount: number; unit: string } | { type: 'unlock' } | { type: 'reset' };

export const generateDeviceToken = async (deviceId: number, request: TokenRequest) =>
  (
    await apiRequest(`/devices/${deviceId}/token`, dataOf(tokenSchema), {
      method: 'POST',
      body: request,
    })
  ).data;
