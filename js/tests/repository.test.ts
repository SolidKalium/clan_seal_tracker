import 'fake-indexeddb/auto';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { CacheStore } from '../src/storage';
import { TrackerRepository } from '../src/repository';
import type { Transport } from '../src/api';
import type { Cached, Definitions, Member, Profile } from '../src/types';
let store: CacheStore;
beforeEach(() => { store = new CacheStore(`test-${crypto.randomUUID()}`); });
afterEach(async () => { await store.db.delete(); });
const member: Member = { destinyUserInfo: { membershipType: 3, membershipId: '4611686018485645582', displayName: 'Guardian' }, isOnline: true };
const good: Profile = { profile: { data: { userInfo: member.destinyUserInfo } }, profileRecords: { data: { records: { '1': { state: 1 } } } } };
const snapshot: Definitions = { version: 'old', language: 'en', nodes: { '1': { hash: 1, displayProperties: { name: 'Test' }, completionRecordHash: 1, children: { records: [] } } }, records: { '1': { hash: 1, displayProperties: { name: 'Test' }, scope: 0 } }, objectives: { '1': { hash: 1, completionValue: 1 } } };
const noop = () => {};
function transport(apiValue: unknown): Transport { return { api: vi.fn().mockResolvedValue(apiValue), resource: vi.fn().mockRejectedValue(new Error('download interrupted')) }; }
it('retains known-good profile data and its timestamp on refresh failure', async () => {
  const entry: Cached<Profile> = { key: 'profile:3_4611686018485645582', value: good, fetchedAt: 123 };
  await store.put(entry);
  const t = transport({}); vi.mocked(t.api).mockRejectedValue(new Error('offline'));
  const result = await new TrackerRepository(store, t, '1').profile(member, noop, true);
  expect(result.status).toBe('stale'); expect(result.entry?.fetchedAt).toBe(123); expect(result.entry?.value).toEqual(good);
  expect((await store.get(entry.key))?.error).toBe('offline');
});
it('retains public data when a profile becomes private and backs off', async () => {
  await store.put({ key: 'profile:3_4611686018485645582', value: good, fetchedAt: 123 });
  const t = transport({ profile: { privacy: 2 }, profileRecords: { privacy: 2 } });
  const repository = new TrackerRepository(store, t, '1');
  const result = await repository.profile(member, noop, true);
  expect(result.status).toBe('private'); expect(result.entry?.value).toEqual(good); expect(result.entry?.fetchedAt).toBe(123);
  await repository.profile(member, noop);
  expect(t.api).toHaveBeenCalledTimes(1);
});
it('deduplicates concurrent profile refreshes', async () => {
  const t = transport(good), repository = new TrackerRepository(store, t, '1');
  await Promise.all([repository.profile(member, noop, true), repository.profile(member, noop, true)]);
  expect(t.api).toHaveBeenCalledTimes(1);
});
it('does not replace a complete manifest with a partial download', async () => {
  await store.put({ key: 'definitions:en', value: snapshot, fetchedAt: 123 });
  const t = transport({ version: 'new', jsonWorldComponentContentPaths: { en: { DestinyPresentationNodeDefinition: '/common/destiny2_content/nodes.json', DestinyRecordDefinition: '/common/destiny2_content/records.json', DestinyObjectiveDefinition: '/common/destiny2_content/objectives.json' } } });
  const result = await new TrackerRepository(store, t, '1').definitions(noop, true);
  expect(result.status).toBe('stale'); expect((await store.get<Definitions>('definitions:en'))?.value.version).toBe('old');
});
it('persists across store instances and clears API cache without deleting preferences', async () => {
  await store.setPreference('table', { sort: 'name' }); await store.put({ key: 'x', value: 42, fetchedAt: 123 });
  const other = new CacheStore(store.db.name);
  expect((await other.get<number>('x'))?.value).toBe(42);
  await other.clearCache();
  expect(await other.preference('table', {})).toEqual({ sort: 'name' });
  expect(await other.get('x')).toBeUndefined(); other.db.close();
});

it('deduplicates and caches linked platform names, retaining them during an outage', async () => {
  const names = [{ ...member.destinyUserInfo, displayName: 'Steam name' }];
  const t = transport({ destinyMemberships: names }), repository = new TrackerRepository(store, t, '1');
  const results = await Promise.all([repository.memberships(member.destinyUserInfo), repository.memberships(member.destinyUserInfo)]);
  expect(results).toEqual([names, names]); expect(t.api).toHaveBeenCalledTimes(1);
  await repository.memberships(member.destinyUserInfo); expect(t.api).toHaveBeenCalledTimes(1);
  await store.put({ key: 'memberships:3_4611686018485645582', value: names, fetchedAt: 0 });
  vi.mocked(t.api).mockRejectedValue(new Error('offline'));
  expect(await repository.memberships(member.destinyUserInfo)).toEqual(names);
});

it('upgrades a fresh record-only manifest even when its Bungie version has not changed', async () => {
  await store.put({ key: 'definitions:en', value: snapshot, fetchedAt: Date.now() });
  const t: Transport = {
    api: vi.fn().mockResolvedValue({ version: 'old', jsonWorldComponentContentPaths: { en: { DestinyPresentationNodeDefinition: 'nodes', DestinyRecordDefinition: 'records', DestinyObjectiveDefinition: 'objectives', DestinyCollectibleDefinition: 'collectibles', DestinyInventoryItemLiteDefinition: 'items', DestinySandboxPerkDefinition: 'perks' } } }),
    resource: vi.fn().mockImplementation(async path => path === 'items' ? { '300': { displayProperties: { name: 'Weapon' }, itemType: 3 } } : path === 'perks' ? { '400': { displayProperties: { name: 'Perk' } } } : path === 'collectibles' ? { '200': { hash: 200, scope: 0, displayProperties: { name: 'Weapon' } } } : snapshot[path as 'nodes' | 'records' | 'objectives']),
  };
  const result = await new TrackerRepository(store, t, '1').definitions(noop);
  expect(result.status).toBe('fresh');
  expect(result.entry?.value.collectibles?.['200']?.displayProperties.name).toBe('Weapon');
  expect(t.resource).toHaveBeenCalledTimes(6);
});

it('upgrades an old roster cache and retains its emblem when banner lookup fails', async () => {
  const emblem = { backgroundColor: 'rgba(0, 0, 0, 1)', layers: [{ path: '/common/destiny2_content/icons/old.png', color: 'rgba(255, 255, 255, 1)' }] };
  await store.put({ key: 'roster:1', value: { name: 'Old clan', members: [member], emblem }, fetchedAt: Date.now() });
  const t: Transport = { resource: vi.fn(), api: vi.fn().mockImplementation(async path => {
    if (path.includes('/Members/')) return { results: [member], hasMore: false };
    if (path.includes('/ClanBannerDictionary/')) throw new Error('banner service unavailable');
    return { detail: { name: 'Updated clan', clanInfo: { clanBannerData: { decalId: 1, decalColorId: 2, decalBackgroundColorId: 3, gonfalonId: 4, gonfalonColorId: 5, gonfalonDetailId: 6, gonfalonDetailColorId: 7 } } } };
  }) };
  const repo = new TrackerRepository(store, t, '1');
  const result = await repo.roster(noop);
  expect(result.status).toBe('fresh');
  expect(result.entry?.value).toMatchObject({ name: 'Updated clan', members: [member], emblem });
  const calls = vi.mocked(t.api).mock.calls.length;
  await repo.roster(noop);
  expect(t.api).toHaveBeenCalledTimes(calls);
});
