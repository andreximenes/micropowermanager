import '@testing-library/jest-dom/vitest';

import { server } from './server';

// The router restores scroll on navigation; jsdom only logs that it cannot scroll.
window.scrollTo = () => undefined;

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
  vi.restoreAllMocks();
});
afterAll(() => server.close());
