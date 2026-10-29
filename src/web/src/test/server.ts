import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const emptyPage = { data: [], current_page: 1, last_page: 1, per_page: 15, total: 0, from: null, to: null };

/**
 * The app shell asks for these on every authenticated screen, and the customer list is the
 * home page. Tests override them with `server.use(...)`, which takes precedence over these defaults.
 */
export const shellHandlers = [
  http.get('/api/settings/main', () =>
    HttpResponse.json({ data: { company_name: 'Spark', currency: 'TZS' } }),
  ),
  http.get('/api/plugins', () => HttpResponse.json({ data: [] })),
  http.get('/api/people', () => HttpResponse.json(emptyPage)),
  http.get('/api/agents', () => HttpResponse.json(emptyPage)),
  http.get('/api/cities', () => HttpResponse.json(emptyPage)),
  http.get('/api/map-settings', () =>
    HttpResponse.json({ data: [{ id: 1, zoom: 7, latitude: 9.5, longitude: 8.3, provider: null }] }),
  ),
];

export const server = setupServer(...shellHandlers);
