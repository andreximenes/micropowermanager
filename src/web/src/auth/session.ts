import { z } from 'zod';

/**
 * The session is shared with the legacy Vue app, which runs on the same origin under
 * /legacy. That app reads the token from `localStorage.token` and the user from the
 * `auth.authenticateUser` slice of its vuex-persist blob (`localStorage.vuex`), so this
 * module writes exactly that shape and never touches the blob's other slices.
 */
export const TOKEN_KEY = 'token';
export const VUEX_KEY = 'vuex';

export const loginResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number(),
  user: z.object({
    id: z.number(),
    name: z.string(),
    email: z.string(),
    company_id: z.number(),
  }),
  roles: z.array(z.string()).default([]),
  permissions: z.array(z.string()).default([]),
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

const authenticateUserSchema = z.object({
  id: z.number(),
  email: z.string(),
  token: z.string().min(1),
  remaining_time: z.number(),
  name: z.string(),
  intervalId: z.number(),
  companyId: z.number(),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
});
type AuthenticateUser = z.infer<typeof authenticateUserSchema>;

export type Session = {
  token: string;
  user: { id: number; name: string; email: string; companyId: number };
  roles: string[];
  permissions: string[];
};

function readVuex(storage: Storage): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(VUEX_KEY) ?? '{}');
    return parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function writeAuthenticateUser(storage: Storage, user: AuthenticateUser | Record<string, never>) {
  const vuex = readVuex(storage);
  const auth = (vuex.auth as Record<string, unknown> | undefined) ?? {};
  storage.setItem(VUEX_KEY, JSON.stringify({ ...vuex, auth: { ...auth, authenticateUser: user } }));
}

export function readSession(storage: Storage = localStorage): Session | null {
  const token = storage.getItem(TOKEN_KEY);
  const auth = readVuex(storage).auth as { authenticateUser?: unknown } | undefined;
  const parsed = authenticateUserSchema.safeParse(auth?.authenticateUser);
  if (!token || !parsed.success) {
    return null;
  }
  const user = parsed.data;
  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, companyId: user.companyId },
    roles: user.roles,
    permissions: user.permissions,
  };
}

export function writeSession(response: LoginResponse, storage: Storage = localStorage): Session {
  const user: AuthenticateUser = {
    id: response.user.id,
    email: response.user.email,
    token: response.access_token,
    remaining_time: response.expires_in,
    name: response.user.name,
    intervalId: 0,
    companyId: response.user.company_id,
    roles: response.roles,
    permissions: response.permissions,
  };
  storage.setItem(TOKEN_KEY, user.token);
  writeAuthenticateUser(storage, user);
  return {
    token: user.token,
    user: { id: user.id, name: user.name, email: user.email, companyId: user.companyId },
    roles: user.roles,
    permissions: user.permissions,
  };
}

export type MapSettings = {
  id: number;
  zoom: number;
  latitude: number;
  longitude: number;
  provider: string | null;
};

function camelCaseKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(camelCaseKeys);
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()),
      camelCaseKeys(nested),
    ]),
  );
}

/**
 * The legacy app loads company and map settings during its own login and reads them from
 * `vuex.settings` afterwards (sidebar, currency, map centre). A login through this app
 * must leave them there in the same shape, or legacy map screens get an empty centre.
 */
export function writeLegacySettings(
  mainSettings: Record<string, unknown>,
  mapSettings: MapSettings | null,
  storage: Storage = localStorage,
): void {
  const vuex = readVuex(storage);
  const settings = (vuex.settings as Record<string, unknown> | undefined) ?? {};
  storage.setItem(
    VUEX_KEY,
    JSON.stringify({
      ...vuex,
      settings: {
        ...settings,
        mainSettings: { ...(camelCaseKeys(mainSettings) as object), protectedPagePassword: null },
        ...(mapSettings ? { mapSettings } : {}),
      },
    }),
  );
}

export function clearSession(storage: Storage = localStorage): void {
  storage.removeItem(TOKEN_KEY);
  writeAuthenticateUser(storage, {});
}

export function can(session: Session | null, ...required: string[]): boolean {
  return session !== null && required.every((permission) => session.permissions.includes(permission));
}
