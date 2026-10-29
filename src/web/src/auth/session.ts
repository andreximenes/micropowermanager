import { z } from 'zod';

export const SESSION_KEY = 'spark-crm.session';

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

const sessionSchema = z.object({
  token: z.string().min(1),
  /** Seconds the token was valid for when it was issued. */
  expiresIn: z.number(),
  user: z.object({ id: z.number(), name: z.string(), email: z.string(), companyId: z.number() }),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
});
export type Session = z.infer<typeof sessionSchema>;

export function readSession(storage: Storage = localStorage): Session | null {
  try {
    const parsed = sessionSchema.safeParse(JSON.parse(storage.getItem(SESSION_KEY) ?? 'null'));
    return parsed.success ? parsed.data : null;
  } catch {
    // Not JSON: treat it as signed out, the next login overwrites it.
    return null;
  }
}

export function writeSession(response: LoginResponse, storage: Storage = localStorage): Session {
  const session: Session = {
    token: response.access_token,
    expiresIn: response.expires_in,
    user: {
      id: response.user.id,
      name: response.user.name,
      email: response.user.email,
      companyId: response.user.company_id,
    },
    roles: response.roles,
    permissions: response.permissions,
  };
  storage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function clearSession(storage: Storage = localStorage): void {
  storage.removeItem(SESSION_KEY);
}

export function can(session: Session | null, ...required: string[]): boolean {
  return (
    session !== null && required.every((permission) => session.permissions.includes(permission))
  );
}
