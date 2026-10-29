import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

/**
 * The app shell asks for these on every authenticated screen. Tests override them with
 * `server.use(...)`, which takes precedence over these defaults.
 */
export const shellHandlers = [
  http.get('/api/settings/main', () =>
    HttpResponse.json({ data: { company_name: 'Spark', currency: 'TZS' } }),
  ),
  http.get('/api/plugins', () => HttpResponse.json({ data: [] })),
];

export const server = setupServer(...shellHandlers);
