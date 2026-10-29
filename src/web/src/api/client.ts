import { z } from 'zod';

import { clearSession, loginResponseSchema, readSession, writeSession } from '@/auth/session';

export class ApiError extends Error {
  readonly status: number;
  /** Laravel's per-field validation messages from a 422 response, keyed by request field. */
  readonly fieldErrors: Record<string, string[]>;

  constructor(status: number, message: string, fieldErrors: Record<string, string[]> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

/** Raised when a response does not match the shape the screen relies on. */
export class ApiContractError extends Error {
  constructor(path: string, issues: string) {
    super(`Unexpected response from ${path}: ${issues}`);
    this.name = 'ApiContractError';
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
};

let pendingRefresh: Promise<boolean> | null = null;

// Several requests can expire at once; they all wait on one refresh.
function refreshSession(): Promise<boolean> {
  pendingRefresh ??= (async () => {
    const session = readSession();
    if (!session) {
      return false;
    }
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { Accept: 'application/json', Authorization: `Bearer ${session.token}` },
    });
    if (!response.ok) {
      clearSession();
      return false;
    }
    writeSession(loginResponseSchema.parse(await response.json()));
    return true;
  })().finally(() => {
    pendingRefresh = null;
  });
  return pendingRefresh;
}

function buildUrl(path: string, query: RequestOptions['query']): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }
  const search = params.toString();
  return `/api${path}${search ? `?${search}` : ''}`;
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const token = readSession()?.token;
  return fetch(buildUrl(path, options.query), {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

const errorBodySchema = z.object({
  message: z.string().optional().catch(undefined),
  errors: z.record(z.string(), z.array(z.string())).optional().catch(undefined),
});

async function toApiError(response: Response): Promise<ApiError> {
  const fallback = response.statusText || `Request failed with status ${response.status}`;
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    // Non-JSON error body: fall through to the status text.
  }
  const parsed = errorBodySchema.safeParse(body);
  if (!parsed.success) {
    return new ApiError(response.status, fallback);
  }
  return new ApiError(response.status, parsed.data.message ?? fallback, parsed.data.errors);
}

/** Sends the request, refreshing an expired session once, and throws on an error status. */
async function authorizedFetch(path: string, options: RequestOptions): Promise<Response> {
  let response = await send(path, options);
  if (response.status === 401 && (await refreshSession())) {
    response = await send(path, options);
  }
  if (!response.ok) {
    throw await toApiError(response);
  }
  return response;
}

/** Calls the MPM API and validates the response against `schema`. */
export async function apiRequest<T extends z.ZodType>(
  path: string,
  schema: T,
  options: RequestOptions = {},
): Promise<z.infer<T>> {
  const response = await authorizedFetch(path, options);
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) {
    throw new ApiContractError(path, parsed.error.message);
  }
  return parsed.data;
}

function decodedFilename(filename: string): string {
  try {
    return decodeURIComponent(filename);
  } catch {
    // A lone `%` is not valid percent-encoding; keep the name as sent.
    return filename;
  }
}

/** Downloads a file the API sends as an attachment, named as the server names it. */
export async function apiDownload(
  path: string,
  query?: RequestOptions['query'],
): Promise<{ blob: Blob; filename: string }> {
  const response = await authorizedFetch(path, { query });
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const filename = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)?.[1];
  return { blob: await response.blob(), filename: filename ? decodedFilename(filename) : 'export' };
}
