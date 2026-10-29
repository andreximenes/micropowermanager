import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

import { server } from './server';

// The first render of a file loads the router, Leaflet and the forms, which can take more than
// the default second when the suite runs on every core.
configure({ asyncUtilTimeout: 3000 });

// The router restores scroll on navigation; jsdom only logs that it cannot scroll.
window.scrollTo = () => undefined;

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
  vi.restoreAllMocks();
});
afterAll(() => server.close());
