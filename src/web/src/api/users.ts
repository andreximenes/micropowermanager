import { z } from 'zod';

import { apiRequest } from './client';
import { dataOf } from './schemas';

const userAddressSchema = z.object({
  phone: z.string().nullable(),
  street: z.string().nullable(),
  city: z.object({ id: z.number(), name: z.string() }).nullable().optional(),
});
export type UserAddress = z.infer<typeof userAddressSchema>;

// A user without an address arrives with `[]` in the list and `null` on its own.
const addressDetailsSchema = z
  .union([userAddressSchema, z.array(z.unknown()), z.null()])
  .transform((value) => (Array.isArray(value) ? null : value));

export const listedUserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  roles: z.array(z.string()),
  address_details: addressDetailsSchema,
});
export type ListedUser = z.infer<typeof listedUserSchema>;

const userPageSchema = z.object({
  data: z.array(listedUserSchema),
  meta: z.object({ current_page: z.number(), last_page: z.number() }),
});

/**
 * Every CRM user. The endpoint pages by 15 and cannot search, and a company has a handful
 * of users, so the list gathers all pages and filters in the browser.
 */
export async function fetchAllUsers(): Promise<ListedUser[]> {
  const first = await apiRequest('/users', userPageSchema, { query: { page: 1 } });
  const rest = await Promise.all(
    Array.from({ length: first.meta.last_page - 1 }, (_, index) =>
      apiRequest('/users', userPageSchema, { query: { page: index + 2 } }),
    ),
  );
  return [first, ...rest].flatMap((page) => page.data);
}

const userSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  address_details: addressDetailsSchema,
});
export type User = z.infer<typeof userSchema>;

export const fetchUser = async (userId: number) =>
  (await apiRequest(`/users/${userId}`, dataOf(userSchema))).data;

const roleSchema = z.object({ name: z.string(), permissions: z.array(z.string()) });
export type Role = z.infer<typeof roleSchema>;

export const fetchRoles = () => apiRequest('/roles/details', z.array(roleSchema));

export type NewUser = { name: string; email: string; password: string; roles: string[] };

export const createUser = async (user: NewUser) =>
  (
    await apiRequest('/users', dataOf(z.object({ id: z.number() })), {
      method: 'POST',
      body: user,
    })
  ).data;

/** Without `roles` the user keeps the roles they have. */
export const updateUser = (userId: number, changes: { name: string; roles?: string[] }) =>
  apiRequest(`/users/${userId}`, z.unknown(), {
    method: 'PUT',
    body: { id: userId, ...changes },
  });

export type AddressChanges = {
  name: string;
  /** E.164; the endpoint refuses an address without one. */
  phone: string;
  street: string | null;
  cityId: number;
};

export const updateUserAddress = (userId: number, address: AddressChanges) =>
  apiRequest(`/users/${userId}/addresses`, z.unknown(), {
    method: 'PUT',
    body: {
      id: userId,
      name: address.name,
      phone: address.phone,
      street: address.street,
      city_id: address.cityId,
    },
  });

export const changeUserPassword = (userId: number, password: string) =>
  apiRequest(`/users/password/${userId}`, z.unknown(), {
    method: 'PUT',
    body: { id: userId, password, confirm_password: password },
  });

export const deleteUser = (userId: number) =>
  apiRequest(`/users/${userId}`, z.unknown(), { method: 'DELETE' });
