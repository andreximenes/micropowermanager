import { can, clearSession, readSession, SESSION_KEY, writeSession } from './session';

import { loginResponse } from '@/test/fixtures';

const stored = () => JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null');

describe('writeSession', () => {
  it('stores the session under its own key and returns it', () => {
    const session = writeSession(loginResponse());

    expect(session).toEqual({
      token: 'token-1',
      expiresIn: 3600,
      user: { id: 1, name: 'Grace Admin', email: 'grace@example.com', companyId: 4 },
      roles: ['admin'],
      permissions: loginResponse().permissions,
    });
    expect(stored()).toEqual(session);
  });

  it('replaces the previous session', () => {
    writeSession(loginResponse());
    writeSession(loginResponse({ access_token: 'token-2' }));

    expect(stored().token).toBe('token-2');
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

  it('returns null when the stored session is malformed', () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ token: 'token-1', user: { id: '1' } }));

    expect(readSession()).toBeNull();
  });

  it('returns null when the stored token is empty', () => {
    writeSession(loginResponse());
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...stored(), token: '' }));

    expect(readSession()).toBeNull();
  });

  it('returns null when the stored value is not JSON', () => {
    localStorage.setItem(SESSION_KEY, 'not json');

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
  it('removes the stored session and leaves other keys alone', () => {
    localStorage.setItem('spark-theme', 'dark');
    writeSession(loginResponse());

    clearSession();

    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(readSession()).toBeNull();
    expect(localStorage.getItem('spark-theme')).toBe('dark');
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
