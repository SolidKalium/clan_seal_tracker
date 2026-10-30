import type { Transport } from './api';
import { CacheStore } from './storage';
import { fresh, MINUTE, profileFresh, PROFILE_COMPONENTS } from './policy';
import type { Cached, Definitions, LoadResult, Manifest, Member, Profile, Roster, UserInfo } from './types';

type CachedCallback<T> = (result: LoadResult<T>) => void;
const message = (e: unknown) => e instanceof Error ? e.message : 'Request failed';
export class TrackerRepository {
  private pending = new Map<string, Promise<unknown>>();
  constructor(readonly store: CacheStore, private transport: Transport, readonly clanId: string, private language = 'en') {}
  private once<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const existing = this.pending.get(key);
    if (existing) return existing as Promise<T>;
    const promise = operation().finally(() => this.pending.delete(key));
    this.pending.set(key, promise);
    return promise;
  }
  definitions(onCached: CachedCallback<Definitions>, force = false): Promise<LoadResult<Definitions>> {
    return this.once('definitions', async () => {
      const key = `definitions:${this.language}`;
      const cached = await this.store.get<Definitions>(key);
      if (cached) onCached({ entry: cached, status: fresh(cached, 5 * MINUTE) ? 'cached' : 'stale' });
      if (!force && fresh(cached, 5 * MINUTE)) return { entry: cached, status: 'cached' };
      try {
        const manifest = await this.transport.api<Manifest>('/Destiny2/Manifest/');
        if (typeof manifest.version !== 'string') throw new Error('Manifest version is missing.');
        let value = cached?.value;
        if (!value || value.version !== manifest.version) {
          const paths = manifest.jsonWorldComponentContentPaths[this.language];
          if (!paths) throw new Error('Manifest language is unavailable.');
          const [nodes, records, objectives] = await Promise.all([
            this.transport.resource<Definitions['nodes']>(paths.DestinyPresentationNodeDefinition!),
            this.transport.resource<Definitions['records']>(paths.DestinyRecordDefinition!),
            this.transport.resource<Definitions['objectives']>(paths.DestinyObjectiveDefinition!),
          ]);
          if (![nodes, records, objectives].every(table => table && typeof table === 'object' && !Array.isArray(table) && Object.keys(table).length)) throw new Error('Definition download was incomplete.');
          value = { version: manifest.version, language: this.language, nodes, records, objectives };
        }
        // One complete snapshot, one atomic IndexedDB put. Never expose half a manifest.
        const entry: Cached<Definitions> = { key, value, fetchedAt: Date.now(), lastAttemptAt: Date.now() };
        await this.store.put(entry);
        return { entry, status: 'fresh' };
      } catch (e) { return this.failed(cached, e); }
    });
  }
  roster(onCached: CachedCallback<Roster>, force = false): Promise<LoadResult<Roster>> {
    return this.once('roster', async () => {
      const key = `roster:${this.clanId}`, cached = await this.store.get<Roster>(key);
      if (cached) onCached({ entry: cached, status: fresh(cached, 3 * MINUTE) ? 'cached' : 'stale' });
      if (!force && fresh(cached, 3 * MINUTE)) return { entry: cached, status: 'cached' };
      try {
        const members: Member[] = [];
        for (let page = 1; ; page++) {
          if (page > 10) throw new Error('Clan roster pagination exceeded the expected limit.');
          const response = await this.transport.api<{ results: Member[]; hasMore: boolean }>(`/GroupV2/${this.clanId}/Members/?currentPage=${page}`);
          if (!Array.isArray(response.results) || response.results.some(m => !m.destinyUserInfo?.membershipId)) throw new Error('Invalid clan roster.');
          members.push(...response.results);
          if (!response.hasMore) break;
        }
        let name = cached?.value.name ?? `Clan ${this.clanId}`;
        try { name = (await this.transport.api<{ detail: { name: string } }>(`/GroupV2/${this.clanId}/`)).detail.name || name; } catch { /* Name is optional; roster remains usable. */ }
        const entry: Cached<Roster> = { key, value: { name, members }, fetchedAt: Date.now(), lastAttemptAt: Date.now() };
        await this.store.put(entry);
        return { entry, status: 'fresh' };
      } catch (e) { return this.failed(cached, e); }
    });
  }
  profile(member: Member, onCached: CachedCallback<Profile>, force = false): Promise<LoadResult<Profile>> {
    const user = member.destinyUserInfo;
    const identity = `${user.membershipType}_${user.membershipId}`;
    return this.once(`profile:${identity}`, async () => {
      const key = `profile:${identity}`, cached = await this.store.get<Profile>(key);
      if (cached) onCached({ entry: cached, status: cached.private ? 'private' : profileFresh(cached, member) ? 'cached' : 'stale', error: cached.error });
      if (!force && profileFresh(cached, member)) return { entry: cached, status: 'cached' };
      // Avoid repeatedly refetching private/error profiles on every page navigation.
      if (!force && cached?.lastAttemptAt && (cached.private || cached.error) && Date.now() - cached.lastAttemptAt < MINUTE) return { entry: cached, status: cached.private ? 'private' : 'stale', error: cached.error };
      try {
        let primary: UserInfo = user;
        if (user.crossSaveOverride && user.crossSaveOverride !== user.membershipType) {
          const resolutionKey = `membership:${identity}`;
          let resolution = await this.store.get<UserInfo>(resolutionKey);
          if (!fresh(resolution, 24 * 60 * MINUTE)) {
            const memberships = await this.transport.api<{ destinyMemberships: UserInfo[] }>(`/User/GetMembershipsById/${user.membershipId}/${user.membershipType}/`);
            const value = memberships.destinyMemberships.find(m => m.membershipType === user.crossSaveOverride);
            if (!value) throw new Error('Could not resolve the active cross-save membership.');
            resolution = { key: resolutionKey, value, fetchedAt: Date.now() };
            await this.store.put(resolution);
          }
          primary = resolution!.value;
        }
        const value = await this.transport.api<Profile>(`/Destiny2/${primary.membershipType}/Profile/${primary.membershipId}/?components=${PROFILE_COMPONENTS.join(',')}`);
        if (!value || typeof value !== 'object' || !value.profileRecords || !value.profile) throw new Error('Incomplete profile response.');
        if (!value.profileRecords.data?.records) {
          if (value.profileRecords.privacy !== 2 && value.profile?.privacy !== 2) throw new Error('Profile records are unavailable.');
          const entry: Cached<Profile> = { key, value: cached?.value ?? value, fetchedAt: cached?.fetchedAt ?? 0, components: cached?.components, private: true, lastAttemptAt: Date.now() };
          await this.store.put(entry);
          return { entry, status: 'private', error: cached?.value.profileRecords?.data ? 'Profile is now private; showing previously public data.' : 'Profile records are private.' };
        }
        const entry: Cached<Profile> = { key, value, fetchedAt: Date.now(), lastAttemptAt: Date.now(), components: PROFILE_COMPONENTS };
        await this.store.put(entry);
        return { entry, status: 'fresh' };
      } catch (e) {
        const error = message(e);
        if (cached) await this.store.put({ ...cached, lastAttemptAt: Date.now(), error });
        return { entry: cached, status: cached ? 'stale' : 'unavailable', error };
      }
    });
  }
  private async failed<T>(cached: Cached<T> | undefined, e: unknown): Promise<LoadResult<T>> {
    const error = message(e);
    if (cached) await this.store.put({ ...cached, lastAttemptAt: Date.now(), error });
    return { entry: cached, status: cached ? 'stale' : 'unavailable', error };
  }
}

export async function eachLimited<T>(items: T[], operation: (item: T) => Promise<void>, concurrency = 3) {
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) await operation(items[index++]!);
  }));
}
