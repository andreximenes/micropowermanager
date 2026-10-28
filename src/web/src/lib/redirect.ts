/**
 * Only same-origin paths are followed after login, so a crafted `?redirect=` link can
 * never send a signed-in user to another site.
 */
export function safeRedirect(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return undefined;
  }
  return value;
}
