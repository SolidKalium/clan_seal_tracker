import { BungieTransport, type Transport } from './api';
import { CacheStore } from './storage';
import type { UserInfo } from './types';
import type { ClanChoice } from './clanSearch';

type SessionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const browserSession: SessionStorage = { getItem: key => window.sessionStorage.getItem(key), setItem: (key, value) => window.sessionStorage.setItem(key, value), removeItem: key => window.sessionStorage.removeItem(key) };
const SESSION_KEY = 'bungie-login:v1', PENDING_KEY = 'bungie-login-pending:v1';
interface Token { accessToken: string; expiresAt: number; membershipId: string; clientId: string }
interface Pending { state: string; createdAt: number; returnHash: string; redirectUri: string }
export interface PlayerAccount { name: string; nameCode?: string; membershipId: string; memberships: UserInfo[]; primary?: UserInfo }
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
  constructor(private config: { apiKey: string; oauthClientId?: string; oauthRedirectUri?: string }, private storage: SessionStorage = browserSession, private ended: (message: string) => void = () => {}) {
    this.transport = new BungieTransport(config.apiKey, undefined, path => this.authorization(path), () => this.end('Your login expired. Sign in again to access your private progression.'));
  }
  get configured() { return !!this.config.oauthClientId; }
  get expiresAt() { return this.token?.expiresAt; }
  private redirectUri() { return this.config.oauthRedirectUri || new URL(import.meta.env.BASE_URL, window.location.origin).href; }
  begin(): string {
    if (!this.config.oauthClientId) throw new Error('Login needs oauth_client_id in js/settings.json and a Public OAuth client registered with Bungie.');
    const redirectUri = this.redirectUri();
    if (new URL(redirectUri).origin !== window.location.origin) throw new Error('Open the site at the registered OAuth redirect origin before signing in.');
    const pending: Pending = { state: Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join(''), createdAt: Date.now(), returnHash: window.location.hash, redirectUri };
    try { this.storage.setItem(PENDING_KEY, JSON.stringify(pending)); } catch { throw new Error('Login requires browser session storage. Allow it for this site and try again.'); }
    const url = new URL('https://www.bungie.net/en/oauth/authorize');
    url.search = new URLSearchParams({ client_id: this.config.oauthClientId, response_type: 'code', state: pending.state, redirect_uri: redirectUri }).toString();
    return url.href;
  }
  async initialize(): Promise<boolean> {
    const url = new URL(window.location.href);
    const callback = url.searchParams.has('code') || url.searchParams.has('error');
    if (callback) {
      let pending: Pending | undefined;
      try { pending = JSON.parse(this.storage.getItem(PENDING_KEY) || 'null') ?? undefined; } catch { /* Invalid state is rejected below. */ }
      const code = url.searchParams.get('code'), state = url.searchParams.get('state'), denied = url.searchParams.has('error');
      for (const key of ['code', 'state', 'error', 'error_description']) url.searchParams.delete(key);
      // Remove credentials from the address/history even when validation fails.
      window.history.replaceState(null, '', url.pathname + url.search + (typeof pending?.returnHash === 'string' && pending.returnHash.startsWith('#/') ? pending.returnHash : url.hash));
      this.storage.removeItem(PENDING_KEY);
      if (!pending || !Number.isFinite(pending.createdAt) || !state || state !== pending.state || Date.now() - pending.createdAt > 10 * 60_000 || pending.createdAt > Date.now()) throw new Error('Login could not be verified. Please sign in again.');
      if (denied) throw new Error('Bungie login was cancelled. You can continue browsing public profiles.');
      if (!code || !this.config.oauthClientId || pending.redirectUri !== this.redirectUri()) throw new Error('Login configuration changed. Please sign in again.');
      this.end();
      let response: Response;
      try {
        response = await fetch('https://www.bungie.net/platform/app/oauth/token/', {
          method: 'POST', cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(25_000),
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: this.config.oauthClientId, redirect_uri: pending.redirectUri }),
        });
        const value = await response.json();
        if (!response.ok || typeof value.access_token !== 'string' || !value.access_token || !Number.isFinite(value.expires_in) || value.expires_in <= 0 || !/^\d+$/.test(value.membership_id) || value.token_type?.toLowerCase() !== 'bearer') throw new Error();
        this.token = { accessToken: value.access_token, expiresAt: Date.now() + value.expires_in * 1000, membershipId: value.membership_id, clientId: this.config.oauthClientId };
        this.storage.setItem(SESSION_KEY, JSON.stringify(this.token));
      } catch { this.end(); throw new Error('Bungie login could not finish. Check the Public client ID, redirect URL and browser origin, then sign in again.'); }
    } else {
      try {
        const saved = JSON.parse(this.storage.getItem(SESSION_KEY) || 'null') as Token | null;
        if (saved && saved.clientId === this.config.oauthClientId && typeof saved.accessToken === 'string' && /^\d+$/.test(saved.membershipId) && saved.expiresAt > Date.now()) this.token = saved;
        else this.storage.removeItem(SESSION_KEY);
      } catch { this.end(); }
    }
    if (this.token) {
      try {
        const data = await this.api<{ destinyMemberships: UserInfo[]; primaryMembershipId?: string; bungieNetUser: { membershipId: string; uniqueName?: string; displayName: string; cachedBungieGlobalDisplayName?: string; cachedBungieGlobalDisplayNameCode?: number } }>('/User/GetMembershipsForCurrentUser/');
        if (data.bungieNetUser?.membershipId !== this.token?.membershipId || !Array.isArray(data.destinyMemberships)) throw new Error();
        const memberships = data.destinyMemberships.filter(u => Number.isInteger(u.membershipType) && /^\d+$/.test(u.membershipId));
        const primary = memberships.find(u => u.membershipId === data.primaryMembershipId) ?? memberships.find(u => u.crossSaveOverride === u.membershipType) ?? memberships[0];
        const identity = data.bungieNetUser;
        const fullName = identity.cachedBungieGlobalDisplayName || identity.uniqueName || primary?.bungieGlobalDisplayName || identity.displayName;
        const suffix = /^(.*)#(\d{4})$/.exec(fullName);
        const code = identity.cachedBungieGlobalDisplayNameCode ?? primary?.bungieGlobalDisplayNameCode;
        const nameCode = Number.isInteger(code) && code! >= 0 && code! <= 9999 ? String(code).padStart(4, '0') : suffix?.[2];
        this.account = { name: suffix?.[1] ?? fullName, nameCode, membershipId: data.bungieNetUser.membershipId, memberships, primary };
      } catch { this.end(); throw new Error('Could not verify your Bungie account. Please sign in again.'); }
    }
    return callback && !!this.account;
  }
  primary(user: UserInfo): UserInfo | undefined {
    if (!this.token || this.token.expiresAt <= Date.now()) return undefined;
    if (!this.account?.memberships.some(u => u.membershipType === user.membershipType && u.membershipId === user.membershipId)) return undefined;
    return user.crossSaveOverride ? this.account.memberships.find(u => u.membershipType === user.crossSaveOverride) : this.account.memberships.find(u => u.membershipType === user.membershipType && u.membershipId === user.membershipId);
  }
  private authorization(path: string): string {
    if (!this.token || this.token.expiresAt <= Date.now()) { this.end('Your login expired. Sign in again to access your private progression.'); throw new Error('Login expired.'); }
    const match = /^\/Destiny2\/(\d+)\/Profile\/(\d+)\/\?components=[\d,]+$/.exec(path);
    if (path !== '/User/GetMembershipsForCurrentUser/' && path !== '/Social/Friends/' && (!match || !this.account?.memberships.some(u => u.membershipType === Number(match[1]) && u.membershipId === match[2]))) throw new Error('Authenticated requests are limited to your own profile and friend list.');
    return this.token.accessToken;
  }
  api<T>(path: string) { return this.transport.api<T>(path); }
  async clan(publicTransport: Transport): Promise<ClanChoice | undefined> {
    const user = this.account?.primary;
    if (!user) return;
    const result = await publicTransport.api<{ results: { group: { groupId: string; name: string; memberCount?: number } }[] }>(`/GroupV2/User/${user.membershipType}/${user.membershipId}/0/1/`);
    const group = result.results?.[0]?.group;
    if (group && /^[1-9]\d*$/.test(group.groupId) && group.name) return { id: group.groupId, name: group.name, memberCount: group.memberCount };
  }
  end(message = '') {
    this.token = undefined; this.account = undefined;
    try { this.storage.removeItem(SESSION_KEY); } catch { /* Memory state still clears. */ }
    void this.store.clearCache();
    if (message) this.ended(message);
  }
}
