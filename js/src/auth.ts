import { BungieTransport, type Transport } from './api';
import { CacheStore } from './storage';
import type { UserInfo } from './types';
import type { ClanChoice } from './clanSearch';

type SessionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const browserSession: SessionStorage = {
  getItem: (key) => window.sessionStorage.getItem(key),
  setItem: (key, value) => window.sessionStorage.setItem(key, value),
  removeItem: (key) => window.sessionStorage.removeItem(key),
};
const browserLocal: SessionStorage = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: (key) => window.localStorage.removeItem(key),
};
const SESSION_KEY = 'bungie-login:v1',
  PENDING_KEY = 'bungie-login-pending:v1',
  // Logins with a refresh token persist across tabs and restarts.
  PERSISTENT_KEY = 'bungie-login-persistent:v1',
  EXPIRED =
    'Your login expired. Sign in again to access your private progression.';
interface Token {
  accessToken: string;
  expiresAt: number;
  membershipId: string;
  clientId: string;
  refreshToken?: string;
  refreshExpiresAt?: number;
}
const validToken = (value: unknown): value is Token => {
  const token = value as Token | null;
  return (
    !!token &&
    typeof token.accessToken === 'string' &&
    Number.isFinite(token.expiresAt) &&
    /^\d+$/.test(token.membershipId) &&
    (token.refreshToken === undefined ||
      (typeof token.refreshToken === 'string' &&
        Number.isFinite(token.refreshExpiresAt)))
  );
};
interface Pending {
  state: string;
  createdAt: number;
  returnHash: string;
  redirectUri: string;
}
export interface PlayerAccount {
  name: string;
  nameCode?: string;
  membershipId: string;
  memberships: UserInfo[];
  primary?: UserInfo;
}
export interface SelfAccess {
  store: CacheStore;
  primary(user: UserInfo): UserInfo | undefined;
  api<T>(path: string): Promise<T>;
}
export class PlayerLogin implements SelfAccess {
  // Authenticated profile payloads never enter the persistent/public cache.
  readonly store = new CacheStore(undefined, false);
  account?: PlayerAccount;
  private token?: Token;
  private transport: BungieTransport;
  constructor(
    private config: {
      apiKey: string;
      oauthClientId?: string;
      oauthClientSecret?: string;
      oauthRedirectUri?: string;
    },
    private storage: SessionStorage = browserSession,
    private ended: (message: string) => void = () => {},
    private persistent: SessionStorage = browserLocal,
  ) {
    this.transport = new BungieTransport(
      config.apiKey,
      undefined,
      (path) => this.authorization(path),
      () => this.end(EXPIRED),
    );
  }
  get configured() {
    return !!this.config.oauthClientId;
  }
  /** When the login ends: the refresh token's expiry if there is one. */
  get expiresAt() {
    return this.token?.refreshToken
      ? this.token.refreshExpiresAt
      : this.token?.expiresAt;
  }
  private redirectUri() {
    return (
      this.config.oauthRedirectUri ||
      new URL(import.meta.env.BASE_URL, window.location.origin).href
    );
  }
  begin(): string {
    if (!this.config.oauthClientId)
      throw new Error(
        'Login needs oauth_client_id in js/settings.json and an OAuth client registered with Bungie.',
      );
    const redirectUri = this.redirectUri();
    if (new URL(redirectUri).origin !== window.location.origin)
      throw new Error(
        'Open the site at the registered OAuth redirect origin before signing in.',
      );
    const pending: Pending = {
      state: Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
        n.toString(16).padStart(2, '0'),
      ).join(''),
      createdAt: Date.now(),
      returnHash: window.location.hash,
      redirectUri,
    };
    try {
      this.storage.setItem(PENDING_KEY, JSON.stringify(pending));
    } catch {
      throw new Error(
        'Login requires browser session storage. Allow it for this site and try again.',
      );
    }
    const url = new URL('https://www.bungie.net/en/oauth/authorize');
    url.search = new URLSearchParams({
      client_id: this.config.oauthClientId,
      response_type: 'code',
      state: pending.state,
      redirect_uri: redirectUri,
    }).toString();
    return url.href;
  }
  async initialize(): Promise<boolean> {
    const url = new URL(window.location.href);
    const callback =
      url.searchParams.has('code') || url.searchParams.has('error');
    if (callback) {
      let pending: Pending | undefined;
      try {
        pending =
          JSON.parse(this.storage.getItem(PENDING_KEY) || 'null') ?? undefined;
      } catch {
        /* Invalid state is rejected below. */
      }
      const code = url.searchParams.get('code'),
        state = url.searchParams.get('state'),
        denied = url.searchParams.has('error');
      for (const key of ['code', 'state', 'error', 'error_description'])
        url.searchParams.delete(key);
      // Remove credentials from the address/history even when validation fails.
      window.history.replaceState(
        null,
        '',
        url.pathname +
          url.search +
          (typeof pending?.returnHash === 'string' &&
          pending.returnHash.startsWith('#/')
            ? pending.returnHash
            : url.hash),
      );
      this.storage.removeItem(PENDING_KEY);
      if (
        !pending ||
        !Number.isFinite(pending.createdAt) ||
        !state ||
        state !== pending.state ||
        Date.now() - pending.createdAt > 10 * 60_000 ||
        pending.createdAt > Date.now()
      )
        throw new Error('Login could not be verified. Please sign in again.');
      if (denied)
        throw new Error(
          'Bungie login was cancelled. You can continue browsing public profiles.',
        );
      if (
        !code ||
        !this.config.oauthClientId ||
        pending.redirectUri !== this.redirectUri()
      )
        throw new Error('Login configuration changed. Please sign in again.');
      this.end();
      try {
        this.save(
          await this.requestToken({
            grant_type: 'authorization_code',
            code,
            redirect_uri: pending.redirectUri,
          }),
        );
      } catch {
        this.end();
        throw new Error(
          'Bungie login could not finish. Check the OAuth client ID, secret, redirect URL and browser origin, then sign in again.',
        );
      }
    } else {
      const saved = this.stored();
      if (saved && saved.expiresAt > Date.now()) this.token = saved;
      else if (
        saved?.refreshToken &&
        saved.refreshExpiresAt! > Date.now() &&
        this.config.oauthClientSecret
      ) {
        this.token = saved;
        if (!(await this.refresh())) this.token = undefined;
      }
      if (!this.token) this.clearStored();
    }
    if (this.token) {
      try {
        const data = await this.api<{
          destinyMemberships: UserInfo[];
          primaryMembershipId?: string;
          bungieNetUser: {
            membershipId: string;
            uniqueName?: string;
            displayName: string;
            cachedBungieGlobalDisplayName?: string;
            cachedBungieGlobalDisplayNameCode?: number;
          };
        }>('/User/GetMembershipsForCurrentUser/');
        if (
          data.bungieNetUser?.membershipId !== this.token?.membershipId ||
          !Array.isArray(data.destinyMemberships)
        )
          throw new Error();
        const memberships = data.destinyMemberships.filter(
          (u) =>
            Number.isInteger(u.membershipType) && /^\d+$/.test(u.membershipId),
        );
        const primary =
          memberships.find(
            (u) => u.membershipId === data.primaryMembershipId,
          ) ??
          memberships.find((u) => u.crossSaveOverride === u.membershipType) ??
          memberships[0];
        const identity = data.bungieNetUser;
        const fullName =
          identity.cachedBungieGlobalDisplayName ||
          identity.uniqueName ||
          primary?.bungieGlobalDisplayName ||
          identity.displayName;
        const suffix = /^(.*)#(\d{4})$/.exec(fullName);
        const code =
          identity.cachedBungieGlobalDisplayNameCode ??
          primary?.bungieGlobalDisplayNameCode;
        const nameCode =
          Number.isInteger(code) && code! >= 0 && code! <= 9999
            ? String(code).padStart(4, '0')
            : suffix?.[2];
        this.account = {
          name: suffix?.[1] ?? fullName,
          nameCode,
          membershipId: data.bungieNetUser.membershipId,
          memberships,
          primary,
        };
      } catch {
        this.end();
        throw new Error(
          'Could not verify your Bungie account. Please sign in again.',
        );
      }
    }
    return callback && !!this.account;
  }
  primary(user: UserInfo): UserInfo | undefined {
    if (!this.token || this.token.expiresAt <= Date.now()) return undefined;
    if (
      !this.account?.memberships.some(
        (u) =>
          u.membershipType === user.membershipType &&
          u.membershipId === user.membershipId,
      )
    )
      return undefined;
    return user.crossSaveOverride
      ? this.account.memberships.find(
          (u) => u.membershipType === user.crossSaveOverride,
        )
      : this.account.memberships.find(
          (u) =>
            u.membershipType === user.membershipType &&
            u.membershipId === user.membershipId,
        );
  }
  private async authorization(path: string): Promise<string> {
    if (this.token && this.token.expiresAt <= Date.now()) await this.refresh();
    if (!this.token || this.token.expiresAt <= Date.now()) {
      if (this.token?.refreshToken && this.token.refreshExpiresAt! > Date.now())
        throw new Error('Cannot reach Bungie to renew your login.');
      this.end(EXPIRED);
      throw new Error('Login expired.');
    }
    const match =
      /^\/Destiny2\/(\d+)\/Profile\/(\d+)\/\?components=[\d,]+$/.exec(path);
    if (
      path !== '/User/GetMembershipsForCurrentUser/' &&
      path !== '/Social/Friends/' &&
      (!match ||
        !this.account?.memberships.some(
          (u) =>
            u.membershipType === Number(match[1]) &&
            u.membershipId === match[2],
        ))
    )
      throw new Error(
        'Authenticated requests are limited to your own profile and friend list.',
      );
    return this.token.accessToken;
  }
  api<T>(path: string) {
    return this.transport.api<T>(path);
  }
  async clan(publicTransport: Transport): Promise<ClanChoice | undefined> {
    const user = this.account?.primary;
    if (!user) return undefined;
    const result = await publicTransport.api<{
      results: {
        group: { groupId: string; name: string; memberCount?: number };
      }[];
    }>(`/GroupV2/User/${user.membershipType}/${user.membershipId}/0/1/`);
    const group = result.results?.[0]?.group;
    if (group && /^[1-9]\d*$/.test(group.groupId) && group.name)
      return {
        id: group.groupId,
        name: group.name,
        memberCount: group.memberCount,
      };
    return undefined;
  }
  end(message = '') {
    this.token = undefined;
    this.account = undefined;
    this.clearStored();
    void this.store.clearCache();
    if (message) this.ended(message);
  }
  private clearStored() {
    for (const [storage, key] of [
      [this.storage, SESSION_KEY],
      [this.persistent, PERSISTENT_KEY],
    ] as const)
      try {
        storage.removeItem(key);
      } catch {
        /* Memory state still clears. */
      }
  }
  /** The saved login for this client, from this tab or a persistent login. */
  private stored(): Token | undefined {
    for (const [storage, key] of [
      [this.storage, SESSION_KEY],
      [this.persistent, PERSISTENT_KEY],
    ] as const)
      try {
        const value: unknown = JSON.parse(storage.getItem(key) || 'null');
        if (validToken(value) && value.clientId === this.config.oauthClientId)
          return value;
      } catch {
        /* Unreadable storage is ignored. */
      }
    return undefined;
  }
  private save(token: Token) {
    this.token = token;
    try {
      if (token.refreshToken)
        this.persistent.setItem(PERSISTENT_KEY, JSON.stringify(token));
      else this.storage.setItem(SESSION_KEY, JSON.stringify(token));
    } catch {
      /* The login still works for this page. */
    }
  }
  /** Exchanges a code or refresh token. Confidential clients send their secret. */
  private async requestToken(
    params: Record<string, string>,
    previous?: Token,
  ): Promise<Token> {
    const clientId = this.config.oauthClientId!;
    const response = await fetch(
      'https://www.bungie.net/platform/app/oauth/token/',
      {
        method: 'POST',
        cache: 'no-store',
        credentials: 'omit',
        signal: AbortSignal.timeout(25_000),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          ...params,
          client_id: clientId,
          ...(this.config.oauthClientSecret
            ? { client_secret: this.config.oauthClientSecret }
            : {}),
        }),
      },
    );
    let value;
    try {
      value = await response.json();
    } catch {
      value = undefined;
    }
    if (
      !response.ok ||
      typeof value?.access_token !== 'string' ||
      !value.access_token ||
      !Number.isFinite(value.expires_in) ||
      value.expires_in <= 0 ||
      !/^\d+$/.test(value.membership_id) ||
      value.token_type?.toLowerCase() !== 'bearer' ||
      (previous && value.membership_id !== previous.membershipId)
    )
      throw new TokenRejected(response.status);
    const refreshed =
      typeof value.refresh_token === 'string' &&
      value.refresh_token &&
      Number.isFinite(value.refresh_expires_in) &&
      value.refresh_expires_in > 0;
    return {
      accessToken: value.access_token,
      expiresAt: Date.now() + value.expires_in * 1000,
      membershipId: value.membership_id,
      clientId,
      // Keep the previous refresh token if Bungie does not rotate it.
      ...(refreshed
        ? {
            refreshToken: value.refresh_token,
            refreshExpiresAt: Date.now() + value.refresh_expires_in * 1000,
          }
        : previous?.refreshToken
          ? {
              refreshToken: previous.refreshToken,
              refreshExpiresAt: previous.refreshExpiresAt,
            }
          : {}),
    };
  }
  private refreshing?: Promise<boolean>;
  /**
   * Renews an expired access token. Concurrent callers share one request. A
   * network failure keeps the login for a later retry; a rejection ends it.
   */
  refresh(): Promise<boolean> {
    this.refreshing ??= this.renew().finally(() => {
      this.refreshing = undefined;
    });
    return this.refreshing;
  }
  private async renew(): Promise<boolean> {
    const token = this.token;
    if (!token?.refreshToken || !this.config.oauthClientSecret) return false;
    // Another tab may have renewed already and rotated the refresh token.
    const latest = this.stored();
    if (
      latest &&
      latest.membershipId === token.membershipId &&
      latest.expiresAt > Date.now()
    ) {
      this.token = latest;
      return true;
    }
    if (token.refreshExpiresAt! <= Date.now()) {
      this.end(EXPIRED);
      return false;
    }
    try {
      const renewed = await this.requestToken(
        {
          grant_type: 'refresh_token',
          refresh_token: (latest ?? token).refreshToken!,
        },
        latest ?? token,
      );
      if (this.token !== token) return false;
      this.save(renewed);
      return true;
    } catch (error) {
      if (this.token === token && error instanceof TokenRejected)
        this.end(EXPIRED);
      return false;
    }
  }
}
/** Bungie answered a token request, but refused it. */
class TokenRejected extends Error {
  constructor(readonly status: number) {
    super('Bungie rejected the token request.');
  }
}
