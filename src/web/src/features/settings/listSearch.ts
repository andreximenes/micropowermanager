import { z } from 'zod';

import type { ListedUser } from '@/api/users';

export const settingsTabs = ['company', 'map', 'modules', 'plugins', 'api-keys'] as const;
export type SettingsTab = (typeof settingsTabs)[number];

// The router parses search values as JSON, so `?term=0803` arrives as a number.
const text = z.union([z.string(), z.number()]).transform(String).optional().catch(undefined);

/** The user list's search and page live in the URL, so reload and back keep them. */
export const userListSearchSchema = z.object({
  term: text,
  page: z.coerce.number().int().positive().optional().catch(undefined),
});
export type UserListSearch = z.infer<typeof userListSearchSchema>;

export const USERS_PER_PAGE = 15;

/** Whether a user's name or e-mail contains the search, ignoring case and spacing. */
export function matchesUser(user: ListedUser, term: string): boolean {
  const wanted = term.toLowerCase().replace(/\s+/g, ' ').trim();
  return `${user.name} ${user.email}`.toLowerCase().includes(wanted);
}
