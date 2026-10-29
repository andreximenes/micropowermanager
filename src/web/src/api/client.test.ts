import { http, HttpResponse } from 'msw';
import { z } from 'zod';

import { ApiContractError, ApiError, apiRequest } from './client';

import { readSession } from '@/auth/session';
import { loginResponse, signIn } from '@/test/fixtures';
import { server } from '@/test/server';

const okSchema = z.object({ ok: z.boolean() });

describe('apiRequest', () => {
  it('prefixes /api, sends the bearer token and returns the parsed body', async () => {
    signIn();
    let seen: Request | undefined;
    server.use(
      http.get('/api/things', ({ request }) => {
        seen = request;
        return HttpResponse.json({ ok: true, extra: 'dropped' });
      }),
    );

    await expect(apiRequest('/things', okSchema)).resolves.toEqual({ ok: true });
    expect(seen?.headers.get('Authorization')).toBe('Bearer token-1');
    expect(seen?.headers.get('Accept')).toBe('application/json');
    expect(seen?.headers.get('Content-Type')).toBeNull();
  });

  it('sends no Authorization header without a session', async () => {
    let seen: Request | undefined;
    server.use(
      http.get('/api/things', ({ request }) => {
        seen = request;
        return HttpResponse.json({ ok: true });
      }),
    );

    await apiRequest('/things', okSchema);

    expect(seen?.headers.has('Authorization')).toBe(false);
  });

  it('encodes the query string and skips undefined values', async () => {
    let url: URL | undefined;
    server.use(
      http.get('/api/things', ({ request }) => {
        url = new URL(request.url);
        return HttpResponse.json({ ok: true });
      }),
    );

    await apiRequest('/things', okSchema, {
      query: { page: 2, unassigned: true, serial: undefined, name: 'a b' },
    });

    expect(url?.search).toBe('?page=2&unassigned=true&name=a+b');
  });

  it('sends a JSON body with the method given', async () => {
    let method: string | undefined;
    let contentType: string | null | undefined;
    let body: unknown;
    server.use(
      http.put('/api/things/1', async ({ request }) => {
        method = request.method;
        contentType = request.headers.get('Content-Type');
        body = await request.json();
        return HttpResponse.json({ ok: true });
      }),
    );

    await apiRequest('/things/1', okSchema, { method: 'PUT', body: { name: 'Lamp' } });

    expect(method).toBe('PUT');
    expect(contentType).toBe('application/json');
    expect(body).toEqual({ name: 'Lamp' });
  });

  it('reads a 200 response without a body as an empty body', async () => {
    server.use(http.post('/api/things', () => new HttpResponse(null, { status: 200 })));

    await expect(apiRequest('/things', z.undefined(), { method: 'POST' })).resolves.toBeUndefined();
  });

  it('reads a 204 No Content response as an empty body', async () => {
    server.use(http.delete('/api/things/1', () => new HttpResponse(null, { status: 204 })));

    await expect(
      apiRequest('/things/1', z.undefined(), { method: 'DELETE' }),
    ).resolves.toBeUndefined();
  });

  it('throws ApiContractError when the response does not match the schema', async () => {
    server.use(http.get('/api/things', () => HttpResponse.json({ ok: 'yes' })));

    const request = apiRequest('/things', okSchema);

    await expect(request).rejects.toBeInstanceOf(ApiContractError);
    await expect(request).rejects.toThrow('Unexpected response from /things');
  });

  describe('errors', () => {
    it('uses the message from a JSON error body', async () => {
      server.use(
        http.get('/api/things', () =>
          HttpResponse.json({ message: 'The serial is taken.' }, { status: 422 }),
        ),
      );

      const error = await apiRequest('/things', okSchema).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({
        status: 422,
        message: 'The serial is taken.',
        fieldErrors: {},
      });
    });

    it('keeps the per-field messages of a validation error', async () => {
      server.use(
        http.get('/api/things', () =>
          HttpResponse.json(
            { message: 'The name is too short.', errors: { name: ['The name is too short.'] } },
            { status: 422 },
          ),
        ),
      );

      await expect(apiRequest('/things', okSchema)).rejects.toMatchObject({
        message: 'The name is too short.',
        fieldErrors: { name: ['The name is too short.'] },
      });
    });

    it('falls back to the status text when the body has no message', async () => {
      server.use(
        http.get('/api/things', () =>
          HttpResponse.json({ errors: [] }, { status: 503, statusText: 'Service Unavailable' }),
        ),
      );

      await expect(apiRequest('/things', okSchema)).rejects.toMatchObject({
        status: 503,
        message: 'Service Unavailable',
      });
    });

    it('falls back to the status text when the body is not JSON', async () => {
      server.use(
        http.get(
          '/api/things',
          () =>
            new HttpResponse('<html>gateway</html>', { status: 502, statusText: 'Bad Gateway' }),
        ),
      );

      await expect(apiRequest('/things', okSchema)).rejects.toMatchObject({
        status: 502,
        message: 'Bad Gateway',
      });
    });
  });

  describe('expired token', () => {
    function refreshHandler(newToken: string) {
      const refresh = vi.fn<(authorization: string | null) => void>();
      server.use(
        http.post('/api/auth/refresh', ({ request }) => {
          refresh(request.headers.get('Authorization'));
          return HttpResponse.json(loginResponse({ access_token: newToken }));
        }),
      );
      return refresh;
    }

    function protectedHandler(validToken: string) {
      server.use(
        http.get('/api/things', ({ request }) =>
          request.headers.get('Authorization') === `Bearer ${validToken}`
            ? HttpResponse.json({ ok: true })
            : HttpResponse.json({ message: 'Unauthenticated.' }, { status: 401 }),
        ),
      );
    }

    it('refreshes the session once and retries with the new token', async () => {
      signIn({ access_token: 'expired' });
      const refresh = refreshHandler('fresh');
      protectedHandler('fresh');

      await expect(apiRequest('/things', okSchema)).resolves.toEqual({ ok: true });
      expect(refresh).toHaveBeenCalledExactlyOnceWith('Bearer expired');
      expect(readSession()?.token).toBe('fresh');
    });

    it('shares one refresh between requests that expire together', async () => {
      signIn({ access_token: 'expired' });
      const refresh = refreshHandler('fresh');
      protectedHandler('fresh');

      const results = await Promise.all([
        apiRequest('/things', okSchema),
        apiRequest('/things', okSchema),
        apiRequest('/things', okSchema),
      ]);

      expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    it('refreshes again on a later expiry', async () => {
      signIn({ access_token: 'expired' });
      const refresh = refreshHandler('fresh');
      protectedHandler('fresh');
      await apiRequest('/things', okSchema);

      signIn({ access_token: 'expired-again' });
      await apiRequest('/things', okSchema);

      expect(refresh).toHaveBeenCalledTimes(2);
    });

    it('clears the session and throws when the refresh is refused', async () => {
      signIn({ access_token: 'expired' });
      server.use(http.post('/api/auth/refresh', () => HttpResponse.json({}, { status: 401 })));
      protectedHandler('fresh');

      await expect(apiRequest('/things', okSchema)).rejects.toMatchObject({
        status: 401,
        message: 'Unauthenticated.',
      });
      expect(readSession()).toBeNull();
    });

    it('does not try to refresh without a session', async () => {
      const refresh = refreshHandler('fresh');
      protectedHandler('fresh');

      await expect(apiRequest('/things', okSchema)).rejects.toMatchObject({ status: 401 });
      expect(refresh).not.toHaveBeenCalled();
    });

    it('gives up after one retry when the new token is refused too', async () => {
      signIn({ access_token: 'expired' });
      const refresh = refreshHandler('also-rejected');
      protectedHandler('never-valid');

      await expect(apiRequest('/things', okSchema)).rejects.toMatchObject({ status: 401 });
      expect(refresh).toHaveBeenCalledTimes(1);
    });
  });
});
