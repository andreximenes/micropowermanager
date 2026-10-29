import { z } from 'zod';

import { apiDownload, apiRequest } from './client';
import { addressSchema, dataOf, paginatorOf, personSchema } from './schemas';

const personNameSchema = z.object({ name: z.string(), surname: z.string() });

export const listedPersonSchema = z.object({
  id: z.number(),
  name: z.string(),
  surname: z.string(),
  /** Paid in the last 25 days. */
  is_active: z.boolean(),
  addresses: z.array(
    z.object({
      phone: z.string().nullable(),
      city: z.object({ id: z.number(), name: z.string() }).nullable().optional(),
    }),
  ),
  devices: z.array(
    z.object({ id: z.number(), device_type: z.string(), device_serial: z.string() }),
  ),
  agent_sold_appliance: z
    .object({
      assigned_appliance: z
        .object({ agent: z.object({ person: personNameSchema.nullable() }).nullable() })
        .nullable(),
    })
    .nullable()
    .optional(),
  latest_payment: z.object({ amount: z.coerce.number(), created_at: z.string() }).nullable(),
  // MySQL aggregates arrive as strings.
  contracts_count: z.coerce.number(),
  outstanding_amount: z.coerce.number(),
  /** Due date of the oldest unpaid installment past due, or null when nothing is overdue. */
  overdue_since: z.string().nullable(),
});
export type ListedPerson = z.infer<typeof listedPersonSchema>;

export const peopleSorts = [
  'name',
  '-name',
  'created_at',
  '-created_at',
  'city',
  '-city',
  'agent',
  '-agent',
  'device',
  '-device',
] as const;
export type PeopleSort = (typeof peopleSorts)[number];

export const deviceTypes = ['meter', 'solar_home_system', 'e_bike'] as const;
export type DeviceType = (typeof deviceTypes)[number];

export type PeopleQuery = {
  page?: number;
  per_page?: number;
  sort_by?: PeopleSort;
  term?: string;
  active_customer?: 0 | 1;
  city_id?: number;
  agent_id?: number;
  device_type?: DeviceType;
  overdue?: 1;
  latest_payment_from?: string;
  latest_payment_to?: string;
  registration_from?: string;
  registration_to?: string;
};

export const fetchPeople = (query: PeopleQuery) =>
  apiRequest('/people', paginatorOf(listedPersonSchema), { query });

/** How many customers match, without loading them. */
export const countPeople = async (query: PeopleQuery = {}) =>
  (
    await apiRequest('/people', z.object({ total: z.number() }), {
      query: { ...query, per_page: 1 },
    })
  ).total;

const citySchema = z.object({
  id: z.number(),
  name: z.string(),
  mini_grid: z
    .object({ name: z.string(), cluster: z.object({ name: z.string() }).nullable().optional() })
    .nullable()
    .optional(),
});
export type City = z.infer<typeof citySchema>;

export const searchCities = async (term: string) =>
  (await apiRequest('/cities', paginatorOf(citySchema), { query: { term, per_page: 30 } })).data;

export const fetchCity = async (cityId: number) =>
  (await apiRequest(`/cities/${cityId}`, dataOf(citySchema))).data;

const agentSchema = z.object({ id: z.number(), person: personNameSchema });
export type Agent = z.infer<typeof agentSchema>;

export const fetchAgents = async () =>
  (await apiRequest('/agents', paginatorOf(agentSchema), { query: { per_page: 100 } })).data;

export type PersonDetails = {
  name: string;
  surname: string;
  title: string | null;
  education: string | null;
  birth_date: string | null;
  gender: string | null;
};

export type AddressDetails = {
  email: string | null;
  /** E.164, such as +2348035550199. */
  phone: string | null;
  street: string | null;
  city_id: number;
  /** "latitude,longitude", or null to keep the address where it is on the map. */
  points: string | null;
};

const withoutNulls = (body: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(body).filter(([, value]) => value !== null));

export const createPerson = async (
  person: PersonDetails,
  address: AddressDetails & { country_code: string },
) =>
  (
    await apiRequest('/people', dataOf(z.object({ id: z.number() })), {
      method: 'POST',
      // The create endpoint validates optional fields only when sent, so blanks stay out.
      body: withoutNulls({ ...person, ...address, is_primary: true, is_customer: true }),
    })
  ).data;

export const updatePerson = (personId: number, person: PersonDetails) =>
  apiRequest(`/people/${personId}`, dataOf(personSchema.pick({ id: true })), {
    method: 'PUT',
    body: person,
  });

/** Updates the primary address, or adds one when the person has none yet. */
export const savePrimaryAddress = (
  personId: number,
  addressId: number | null,
  address: AddressDetails,
) =>
  apiRequest(`/people/${personId}/addresses`, dataOf(addressSchema), {
    method: addressId === null ? 'POST' : 'PUT',
    body: withoutNulls({ ...address, id: addressId, is_primary: 1 }),
  });

export const deletePerson = (personId: number) =>
  apiRequest(`/people/${personId}`, z.unknown(), { method: 'DELETE' });

export const exportDebts = () => apiDownload('/export/debts');

export const exportCustomers = () => apiDownload('/export/customers', { format: 'excel' });
