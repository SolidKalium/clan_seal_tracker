import { expect, it } from 'vitest';
import { fresh, MINUTE, profileFresh, PROFILE_COMPONENTS } from '../src/policy';
import type { Cached, Member } from '../src/types';
const now = 1_900_000_000_000;
const member: Member = { destinyUserInfo: { membershipType: 3, membershipId: '4611686018485645582', displayName: 'Example' }, lastOnlineStatusChange: String((now - 60 * MINUTE) / 1000) };
const entry: Cached<unknown> = { key: 'test', value: {}, fetchedAt: now - MINUTE, components: PROFILE_COMPONENTS };
it('uses older inactive-player data but refreshes active players after five minutes', () => {
  expect(profileFresh(entry, member, now)).toBe(true);
  expect(profileFresh({ ...entry, fetchedAt: now - 6 * MINUTE }, { ...member, isOnline: true }, now)).toBe(false);
});
it('refreshes changed activity, missing components, old data, and errors', () => {
  expect(profileFresh(entry, { ...member, lastOnlineStatusChange: String((now + MINUTE) / 1000) }, now)).toBe(false);
  expect(profileFresh({ ...entry, components: [100] }, member, now)).toBe(false);
  expect(profileFresh({ ...entry, components: [100, 800, 900] }, member, now)).toBe(false);
  expect(profileFresh({ ...entry, fetchedAt: now - 8 * 24 * 60 * MINUTE }, member, now)).toBe(false);
  expect(profileFresh({ ...entry, error: 'network failed' }, member, now)).toBe(false);
  expect(profileFresh({ ...entry, private: true }, member, now)).toBe(false);
});
it('applies a short fallback TTL when activity is unknown and rejects future timestamps', () => {
  expect(profileFresh(entry, { ...member, lastOnlineStatusChange: undefined }, now)).toBe(true);
  expect(fresh({ ...entry, fetchedAt: now + MINUTE }, 5 * MINUTE, now)).toBe(false);
});
