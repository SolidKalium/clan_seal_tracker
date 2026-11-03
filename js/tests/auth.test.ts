import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PlayerLogin } from '../src/auth';
import { BungieTransport } from '../src/api';
import { CacheStore } from '../src/storage';
import { TrackerRepository } from '../src/repository';
import type { Member, Profile } from '../src/types';
const user = { membershipType: 3, membershipId: '123', displayName: 'Player' };
const member: Member = { destinyUserInfo: user, isOnline: true };
const profile: Profile = {
  profile: { data: { userInfo: user } },
  profileRecords: { data: { records: { '1': { state: 1 } } } },
};
let items: Map<string, string>,
  storage: Storage,
  location: { href: string; origin: string; hash: string },
  replace: ReturnType<typeof vi.fn>;
const config = {
  apiKey: 'test-key',
  oauthClientId: '36319',
  oauthRedirectUri: 'https://localhost:5173/js/',
};
beforeEach(() => {
  items = new Map();
  storage = {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
    removeItem: (key) => {
      items.delete(key);
    },
    clear: () => items.clear(),
    key: (i) => [...items.keys()][i] ?? null,
    get length() {
      return items.size;
    },
  };
  location = {
    href: 'https://localhost:5173/js/#/members',
    origin: 'https://localhost:5173',
    hash: '#/members',
  };
  replace = vi.fn();
  vi.stubGlobal('window', { location, history: { replaceState: replace } });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function fetcher() {
  return vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith('/oauth/token/'))
      return new Response(
        JSON.stringify({
          access_token: 'private-token',
          token_type: 'Bearer',
          expires_in: 3600,
          membership_id: '7',
        }),
      );
    if (url.includes('GetMembershipsForCurrentUser'))
      return new Response(
        JSON.stringify({
          ErrorCode: 1,
          Response: {
            destinyMemberships: [user],
            bungieNetUser: { membershipId: '7', displayName: 'Player' },
          },
        }),
      );
    if (
      options?.headers &&
      (options.headers as Record<string, string>).Authorization
    )
      return new Response(JSON.stringify({ ErrorCode: 1, Response: profile }));
    return new Response(
      JSON.stringify({
        ErrorCode: 1,
        Response: { profile: { privacy: 2 }, profileRecords: { privacy: 2 } },
      }),
    );
  });
}
async function signedIn() {
  const login = new PlayerLogin(config, storage);
  const url = new URL(login.begin());
  location.href = `${config.oauthRedirectUri}?code=secret-code&state=${url.searchParams.get('state')}`;
  await login.initialize();
  return login;
}
it('uses a Public code exchange, verifies state, restores the view and does not retain the code', async () => {
  const fetch = fetcher();
  vi.stubGlobal('fetch', fetch);
  const login = await signedIn();
  expect(login.account?.name).toBe('Player');
  expect(replace).toHaveBeenCalledWith(null, '', '/js/#/members');
  const request = fetch.mock.calls[0]![1]!;
  const body = request.body as URLSearchParams;
  expect(Object.fromEntries(body)).toEqual({
    grant_type: 'authorization_code',
    code: 'secret-code',
    client_id: '36319',
    redirect_uri: config.oauthRedirectUri,
  });
  expect([...items.values()].join()).not.toContain('secret-code');
  expect(items.has('bungie-login-pending:v1')).toBe(false);
});
it('rejects missing, mismatched, expired and replayed states before exchanging credentials', async () => {
  const fetch = fetcher();
  vi.stubGlobal('fetch', fetch);
  for (const mode of ['missing', 'mismatch', 'expired', 'replay']) {
    const login = new PlayerLogin(config, storage),
      url = new URL(login.begin());
    const state = url.searchParams.get('state');
    if (mode === 'missing' || mode === 'replay')
      items.delete('bungie-login-pending:v1');
    if (mode === 'expired') {
      const saved = JSON.parse(items.get('bungie-login-pending:v1')!);
      saved.createdAt -= 11 * 60_000;
      items.set('bungie-login-pending:v1', JSON.stringify(saved));
    }
    location.href = `${config.oauthRedirectUri}?code=secret&state=${mode === 'mismatch' ? 'wrong' : state}`;
    await expect(login.initialize()).rejects.toThrow('verified');
  }
  expect(fetch).not.toHaveBeenCalled();
  expect(replace).toHaveBeenCalledTimes(4);
});
it('limits Bearer requests to verified self profiles; keeps private responses out of public IndexedDB', async () => {
  const fetch = fetcher();
  vi.stubGlobal('fetch', fetch);
  const login = await signedIn(),
    store = new CacheStore(`auth-test-${crypto.randomUUID()}`);
  try {
    const repo = new TrackerRepository(
      store,
      new BungieTransport('test-key'),
      '1',
      'en',
      login,
    );
    const own = await repo.profile(member, () => {});
    expect(own.status).toBe('fresh');
    expect(await store.get('profile:3_123')).toBeUndefined();
    expect((await repo.cachedProfile(member))?.value).toEqual(profile);
    const other: Member = {
      ...member,
      destinyUserInfo: { ...user, membershipId: '456' },
    };
    expect((await repo.profile(other, () => {})).status).toBe('private');
    const profileCalls = fetch.mock.calls.filter(([url]) =>
      url.includes('/Profile/'),
    );
    expect(
      profileCalls.map(
        ([, options]) =>
          (options?.headers as Record<string, string>).Authorization,
      ),
    ).toEqual(['Bearer private-token', undefined]);
    await expect(
      login.api('/Destiny2/3/Profile/456/?components=900'),
    ).rejects.toThrow('limited');
    await expect(login.api('/GroupV2/Search/')).rejects.toThrow('limited');
    login.end();
    expect(await repo.cachedProfile(member)).toBeUndefined();
    expect(items.has('bungie-login:v1')).toBe(false);
    expect(await login.store.get('profile:3_123')).toBeUndefined();
  } finally {
    await store.db.delete();
  }
});
it('expires on HTTP 401 and never logs or stores authenticated error bodies', async () => {
  vi.stubGlobal('fetch', fetcher());
  const ended = vi.fn(),
    login = new PlayerLogin(config, storage, ended);
  const url = new URL(login.begin());
  location.href = `${config.oauthRedirectUri}?code=code&state=${url.searchParams.get('state')}`;
  await login.initialize();
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response('private-token sensitive profile details', {
        status: 401,
      }),
    ),
  );
  await expect(
    login.api('/Destiny2/3/Profile/123/?components=900'),
  ).rejects.toThrow('expired');
  expect(ended).toHaveBeenCalledOnce();
  expect(login.account).toBeUndefined();
  expect(items.size).toBe(0);
  expect(warn).not.toHaveBeenCalled();
});
it('does not restore an expired token or a session for another client', async () => {
  const fetch = fetcher();
  vi.stubGlobal('fetch', fetch);
  for (const saved of [
    { expiresAt: Date.now() - 1, clientId: '36319' },
    { expiresAt: Date.now() + 60_000, clientId: 'other' },
  ]) {
    items.set(
      'bungie-login:v1',
      JSON.stringify({ ...saved, accessToken: 'token', membershipId: '7' }),
    );
    expect(await new PlayerLogin(config, storage).initialize()).toBe(false);
    expect(items.size).toBe(0);
  }
  expect(fetch).not.toHaveBeenCalled();
});
it('uses the verified cross-save membership without resolving another player through authenticated requests', async () => {
  const fetch = fetcher(),
    primary = {
      membershipType: 2,
      membershipId: '234',
      displayName: 'Primary',
      crossSaveOverride: 2,
    };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, options?: RequestInit) =>
      url.includes('GetMembershipsForCurrentUser')
        ? new Response(
            JSON.stringify({
              ErrorCode: 1,
              Response: {
                destinyMemberships: [
                  { ...user, crossSaveOverride: 2 },
                  primary,
                ],
                primaryMembershipId: '234',
                bungieNetUser: { membershipId: '7', displayName: 'Player' },
              },
            }),
          )
        : fetch(url, options),
    ),
  );
  const login = await signedIn();
  expect(login.account?.primary).toEqual(primary);
  expect(login.primary({ ...user, crossSaveOverride: 2 })).toEqual(primary);
  expect(
    login.primary({ ...user, membershipId: '999', crossSaveOverride: 2 }),
  ).toBeUndefined();
  const store = new CacheStore(`auth-cross-save-${crypto.randomUUID()}`);
  try {
    await new TrackerRepository(
      store,
      new BungieTransport('key'),
      '1',
      'en',
      login,
    ).profile(
      { ...member, destinyUserInfo: { ...user, crossSaveOverride: 2 } },
      () => {},
    );
    expect(fetch.mock.calls.at(-1)?.[0]).toContain('/Destiny2/2/Profile/234/');
    expect(await store.db.entries.count()).toBe(0);
  } finally {
    await store.db.delete();
  }
});
it('clears private data when the access token expires', async () => {
  vi.stubGlobal('fetch', fetcher());
  const login = await signedIn();
  await login.store.put({
    key: 'profile:3_123',
    value: profile,
    fetchedAt: Date.now(),
  });
  vi.spyOn(Date, 'now').mockReturnValue(login.expiresAt! + 1);
  expect(login.primary(user)).toBeUndefined();
  await expect(
    login.api('/Destiny2/3/Profile/123/?components=900'),
  ).rejects.toThrow('expired');
  expect(await login.store.get('profile:3_123')).toBeUndefined();
  expect(login.account).toBeUndefined();
  expect(items.size).toBe(0);
});
