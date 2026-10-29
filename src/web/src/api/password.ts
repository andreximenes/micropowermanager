import { z } from 'zod';

import { apiRequest } from './client';
import { dataOf } from './schemas';

/**
 * Asks for a reset link. The answer is the same whether or not the e-mail has an account;
 * a 422 means the server could not send mail at all.
 */
export const requestPasswordReset = (email: string) =>
  apiRequest('/users/password', dataOf(z.object({ message: z.string() })), {
    method: 'POST',
    body: { email },
  });

export const validateResetToken = async (token: string) =>
  (
    await apiRequest(
      `/users/password/validate/${encodeURIComponent(token)}`,
      dataOf(z.object({ valid: z.boolean(), email: z.string().nullable() })),
    )
  ).data;

/** Sets the new password. The server answers 200 even when it refuses, with the outcome in `status_code`. */
export async function resetPassword(token: string, password: string): Promise<void> {
  const { data } = await apiRequest(
    '/users/password/confirm',
    dataOf(z.object({ message: z.string(), status_code: z.number() })),
    { method: 'POST', body: { token, password, password_confirmation: password } },
  );
  if (data.status_code !== 200) {
    throw new Error(data.message);
  }
}
