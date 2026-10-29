import {
  can,
  clearSession,
  readSession,
  TOKEN_KEY,
  VUEX_KEY,
  writeLegacySettings,
  writeSession,
} from './session';

import { loginResponse } from '@/test/fixtures';

const vuex = () => JSON.parse(localStorage.getItem(VUEX_KEY) ?? 'null');

describe('writeSession', () => {
  it('stores the token and the legacy authenticateUser slice in the shape the Vue app reads', () => {
    const session = writeSession(loginResponse());

    expect(localStorage.getItem(TOKEN_KEY)).toBe('token-1');
    expect(vuex()).toEqual({
      auth: {
        authenticateUser: {
          id: 1,
          email: 'grace@example.com',
          token: 'token-1',
          remaining_time: 3600,
          name: 'Grace Admin',
          intervalId: 0,
          companyId: 4,
          roles: ['admin'],
          permissions: loginResponse().permissions,
        },
      },
    });
    expect(session).toEqual({
      token: 'token-1',
      user: { id: 1, name: 'Grace Admin', email: 'grace@example.com', companyId: 4 },
      roles: ['admin'],
      permissions: loginResponse().permissions,
    });
  });

  it('merges into the existing vuex blob without clobbering other slices', () => {
    localStorage.setItem(
      VUEX_KEY,
      JSON.stringify({ settings: { theme: 'dark' }, auth: { lastRoute: '/people' } }),
    );

    writeSession(loginResponse());

    expect(vuex()).toMatchObject({
      settings: { theme: 'dark' },
      auth: { lastRoute: '/people', authenticateUser: { token: 'token-1' } },
    });
  });

  it.each([
    ['is not JSON', '{oops'],
    ['is JSON null', 'null'],
  ])('starts a fresh blob when the stored vuex %s', (_, stored) => {
    localStorage.setItem(VUEX_KEY, stored);

    writeSession(loginResponse());

    expect(vuex()).toEqual({ auth: { authenticateUser: expect.objectContaining({ id: 1 }) } });
  });
});

describe('readSession', () => {
  it('reads back what writeSession stored', () => {
    const written = writeSession(loginResponse());

    expect(readSession()).toEqual(written);
  });

  it('returns null when nothing is stored', () => {
    expect(readSession()).toBeNull();
  });

  it('returns null when the token is missing', () => {
    writeSession(loginResponse());
    localStorage.removeItem(TOKEN_KEY);

    expect(readSession()).toBeNull();
  });

  it('returns null when the stored user is malformed', () => {
    localStorage.setItem(TOKEN_KEY, 'token-1');
    localStorage.setItem(
      VUEX_KEY,
      JSON.stringify({ auth: { authenticateUser: { id: '1', email: 'grace@example.com' } } }),
    );

    expect(readSession()).toBeNull();
  });

  it('returns null when the vuex blob is not JSON', () => {
    localStorage.setItem(TOKEN_KEY, 'token-1');
    localStorage.setItem(VUEX_KEY, 'not json');

    expect(readSession()).toBeNull();
  });

  it('reads from the storage it is given', () => {
    const storage = new Map<string, string>();
    const fakeStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
    } as Storage;

    writeSession(loginResponse(), fakeStorage);

    expect(readSession(fakeStorage)?.token).toBe('token-1');
    expect(readSession()).toBeNull();
  });
});

describe('clearSession', () => {
  it('removes the token and empties authenticateUser but keeps other slices', () => {
    localStorage.setItem(VUEX_KEY, JSON.stringify({ settings: { theme: 'dark' } }));
    writeSession(loginResponse());

    clearSession();

    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(vuex()).toEqual({ settings: { theme: 'dark' }, auth: { authenticateUser: {} } });
    expect(readSession()).toBeNull();
  });
});

describe('writeLegacySettings', () => {
  const mapSettings = { id: 1, zoom: 7, latitude: -6.8, longitude: 39.28, provider: null };

  it('stores camel-cased main settings and the map settings under vuex.settings', () => {
    writeLegacySettings(
      {
        company_name: 'Spark',
        currency: 'TZS',
        protected_page_password: 'secret',
        sidebar: [{ menu_item: 'Customers', usage_type: 'all' }],
      },
      mapSettings,
    );

    expect(vuex()).toEqual({
      settings: {
        mainSettings: {
          companyName: 'Spark',
          currency: 'TZS',
          protectedPagePassword: null,
          sidebar: [{ menuItem: 'Customers', usageType: 'all' }],
        },
        mapSettings,
      },
    });
  });

  it('keeps the session and existing settings, and the previous map settings when none arrive', () => {
    writeSession(loginResponse());
    localStorage.setItem(
      VUEX_KEY,
      JSON.stringify({ ...vuex(), settings: { mapSettings, ticketSettings: { id: 2 } } }),
    );

    writeLegacySettings({ currency: 'KES' }, null);

    expect(vuex()).toMatchObject({
      auth: { authenticateUser: { token: 'token-1' } },
      settings: {
        mainSettings: { currency: 'KES', protectedPagePassword: null },
        mapSettings,
        ticketSettings: { id: 2 },
      },
    });
  });
});

describe('can', () => {
  const session = writeSession(loginResponse({ permissions: ['customers', 'tickets'] }));

  it('requires every listed permission', () => {
    expect(can(session, 'customers')).toBe(true);
    expect(can(session, 'customers', 'tickets')).toBe(true);
    expect(can(session, 'customers', 'appliances')).toBe(false);
  });

  it('denies everything without a session', () => {
    expect(can(null, 'customers')).toBe(false);
  });
});
