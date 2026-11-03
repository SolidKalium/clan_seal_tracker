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

it('manual sync reuses inactive profiles, refreshes changed activity, and retries private or failed profiles', async () => {
  const key = 'profile:3_4611686018485645582';
  const inactive = { ...member, isOnline: false, lastOnlineStatusChange: '1' };
  const cached = { key, value: good, fetchedAt: Date.now(), components: [100, 104, 202, 800, 900, 1200, 1400], lastAttemptAt: Date.now() };
  await store.put(cached);
  const t = transport(good), repo = new TrackerRepository(store, t, '1');
  expect((await repo.profile(inactive, noop, false, true)).status).toBe('cached');
  expect(t.api).not.toHaveBeenCalled();
  await repo.profile({ ...inactive, lastOnlineStatusChange: String((Date.now() + 1000) / 1000) }, noop, false, true);
  expect(t.api).toHaveBeenCalledTimes(1);
  for (const failure of [{ private: true }, { error: 'offline' }]) {
    await store.put({ ...cached, ...failure });
    await repo.profile(inactive, noop, false, true);
  }
  expect(t.api).toHaveBeenCalledTimes(3);
  await repo.profile(inactive, noop, true);
  expect(t.api).toHaveBeenCalledTimes(4);
});
it('does not replace a complete manifest with a partial download', async () => {
  await store.put({ key: 'definitions:en', value: snapshot, fetchedAt: 123 });
  const t = transport({ version: 'new', jsonWorldComponentContentPaths: { en: { DestinyPresentationNodeDefinition: '/common/destiny2_content/nodes.json', DestinyRecordDefinition: '/common/destiny2_content/records.json', DestinyObjectiveDefinition: '/common/destiny2_content/objectives.json' } } });
  const result = await new TrackerRepository(store, t, '1').definitions(noop, true);
  expect(result.status).toBe('stale'); expect((await store.get<Definitions>('definitions:en'))?.value.version).toBe('old');
});

it('checks unchanged manifest versions without downloading or rewriting the snapshot', async () => {
  const value: Definitions = { ...snapshot, collectibles: {}, items: {}, perks: {}, otherDefinitionsVersion: 1 };
  await store.put({ key: 'definitions:en', value, fetchedAt: 123 });
  const writes = vi.spyOn(store, 'put');
  const t = transport({ version: 'old' });
  const repo = new TrackerRepository(store, t, '1');
  const result = await repo.definitions(noop, true);
  expect(result.entry?.value).toBe(value);
  expect(t.resource).not.toHaveBeenCalled();
  expect(writes.mock.calls.map(([entry]) => entry.key)).toEqual(['definitions:en:checked']);
  const reopened = new CacheStore(store.db.name);
  try {
    const cached = await new TrackerRepository(reopened, t, '1').definitions(noop);
    expect(cached.status).toBe('cached');
    expect(t.api).toHaveBeenCalledTimes(1);
    expect(cached.entry?.fetchedAt).toBe(result.entry?.fetchedAt);
  } finally { reopened.db.close(); }
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

it('upgrades a complete pre-Other cache at the same manifest version and rejects partial new tables atomically', async () => {
  const old = { ...snapshot, collectibles: { '1': { hash: 1, scope: 0, displayProperties: { name: 'Item' } } }, items: { '1': { displayProperties: { name: 'Item' } } }, perks: { '1': { displayProperties: { name: 'Perk' } } } };
  await store.put({ key: 'definitions:en', value: old, fetchedAt: Date.now() });
  const paths = Object.fromEntries(['DestinyPresentationNodeDefinition', 'DestinyRecordDefinition', 'DestinyObjectiveDefinition', 'DestinyCollectibleDefinition', 'DestinyInventoryItemLiteDefinition', 'DestinySandboxPerkDefinition', 'DestinyGuardianRankDefinition', 'DestinyChecklistDefinition', 'DestinySocialCommendationDefinition', 'DestinySocialCommendationNodeDefinition'].map((p, i) => [p, String(i)]));
  const tables = [old.nodes, old.records, old.objectives, old.collectibles, old.items, old.perks, { '1': { hash: 1, rankNumber: 1, presentationNodeHash: 1, displayProperties: { name: 'New Light' } } }, { '1': { hash: 1, scope: 0, displayProperties: { name: 'Chest' }, entries: [] } }, { '1': { hash: 1, displayProperties: { name: 'Card' } } }, { '1': { hash: 1, displayProperties: { name: 'Ally' } } }];
  const t: Transport = { api: vi.fn().mockResolvedValue({ version: 'old', jsonWorldComponentContentPaths: { en: paths } }), resource: vi.fn().mockImplementation(async path => tables[Number(path)]) };
  const repo = new TrackerRepository(store, t, '1');
  expect((await repo.definitions(noop)).entry?.value).toMatchObject({ otherDefinitionsVersion: 1, guardianRanks: tables[6], checklists: tables[7], commendations: tables[8], commendationNodes: tables[9] });
  expect(t.resource).toHaveBeenCalledTimes(10);
  await repo.definitions(noop);
  expect(t.resource).toHaveBeenCalledTimes(10);
  vi.mocked(t.api).mockResolvedValue({ version: 'new', jsonWorldComponentContentPaths: { en: paths } });
  tables[7] = {};
  expect((await repo.definitions(noop, true)).status).toBe('stale');
  expect((await store.get<Definitions>('definitions:en'))?.value).toMatchObject({ version: 'old', checklists: { '1': { hash: 1 } } });
});

it('saves API diagnostics with cached errors and retains history after successful retry', async () => {
  const { BungieTransport } = await import('../src/api');
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const key = 'profile:3_4611686018485645582';
  await store.put({ key, value: good, fetchedAt: 123 });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('<html>Gateway error</html>', { status: 502, headers: { 'Content-Type': 'text/html' } })).mockResolvedValueOnce(Response.json({ ErrorCode: 1, Response: good })));
  try {
    const repo = new TrackerRepository(store, new BungieTransport('test-key', d => store.recordDiagnostic(d)), '1');
    expect((await repo.profile(member, noop, true)).status).toBe('stale');
    expect(await store.get(key)).toMatchObject({ fetchedAt: 123, value: good, errorInfo: { status: 502, contentType: 'text/html', bodyExcerpt: '<html>Gateway error</html>' } });
    expect((await repo.profile(member, noop, true)).status).toBe('fresh');
    expect((await store.get(key))?.errorInfo).toBeUndefined();
    const reopened = new CacheStore(store.db.name);
    const history = await reopened.db.entries.where('key').startsWith('diagnostic:').toArray();
    expect(history).toHaveLength(1);
    expect(history[0]?.value).toMatchObject({ status: 502 });
    reopened.db.close();
  } finally { vi.unstubAllGlobals(); warn.mockRestore(); }
});
it('retains a bounded diagnostic history even without an existing profile cache', async () => {
  const { BungieTransport } = await import('../src/api');
  const { DIAGNOSTIC_LIMIT } = await import('../src/diagnostics');
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Unreadable', { status: 503 })));
  try {
    const repo = new TrackerRepository(store, new BungieTransport('test-key', d => store.recordDiagnostic(d)), '1');
    expect((await repo.profile(member, noop, true)).status).toBe('unavailable');
    expect(await store.get('profile:3_4611686018485645582')).toBeUndefined();
    expect(await store.db.entries.where('key').startsWith('diagnostic:').count()).toBe(1);
    await Promise.all(Array.from({ length: DIAGNOSTIC_LIMIT + 2 }, (_, i) => store.recordDiagnostic({ timestamp: Date.now() + i, attempt: 1, durationMs: 1, message: `Failure ${i}`, url: '/test' })));
    expect(await store.db.entries.where('key').startsWith('diagnostic:').count()).toBe(DIAGNOSTIC_LIMIT);
    await store.clearCache();
    expect(await store.db.entries.where('key').startsWith('diagnostic:').count()).toBe(0);
  } finally { vi.unstubAllGlobals(); warn.mockRestore(); }
});
