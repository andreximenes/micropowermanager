import type { z } from 'zod';

import { clearSession, loginResponseSchema, readSession, writeSession } from '@/auth/session';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
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

async function errorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object' && 'message' in body && typeof body.message === 'string') {
      return body.message;
    }
  } catch {
    // Non-JSON error body: fall through to the status text.
  }
  return response.statusText || `Request failed with status ${response.status}`;
}

/** Calls the MPM API and validates the response against `schema`. */
export async function apiRequest<T extends z.ZodType>(
  path: string,
  schema: T,
  options: RequestOptions = {},
): Promise<z.infer<T>> {
  let response = await send(path, options);
  if (response.status === 401 && (await refreshSession())) {
    response = await send(path, options);
  }
  if (!response.ok) {
    throw new ApiError(response.status, await errorMessage(response));
  }
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) {
    throw new ApiContractError(path, parsed.error.message);
  }
  return parsed.data;
}
