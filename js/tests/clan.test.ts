import { expect, it } from 'vitest';
import { clanJoinedAt, clanRankLabel, compareClanTenure } from '../src/clan';
import type { Member } from '../src/types';
const member = (joinDate?: string): Member => ({ joinDate, destinyUserInfo: { membershipType: 3, membershipId: '1', displayName: 'Guardian' } });
it('sorts oldest clan join dates first, with missing/invalid dates last', () => {
  const old = member('2018-01-01T00:00:00Z'), recent = member('2024-01-01T00:00:00Z'), unknown = member(), invalid = member('not-a-date');
  expect([recent, unknown, old].sort(compareClanTenure)).toEqual([old, recent, unknown]);
  expect(compareClanTenure(unknown, invalid)).toBe(0);
  expect(compareClanTenure(old, old)).toBe(0);
  expect(clanJoinedAt(member('0001-01-01T00:00:00Z'))).toBeUndefined();
  expect(clanJoinedAt(member('2100-01-01T00:00:00Z'), Date.UTC(2026, 0, 1))).toBeUndefined();
});
it('labels all Bungie runtime clan ranks and handles unknown data', () => {
  expect([1, 2, 3, 4, 5].map(clanRankLabel)).toEqual(['Beginner', 'Member', 'Admin', 'Acting Founder', 'Founder']);
  expect(clanRankLabel()).toBe('Rank unavailable');
  expect(clanRankLabel(99)).toBe('Unknown rank');
});

it('combines only memberships of the same Bungie account with the same nonzero override, preferring its primary membership', async () => {
  const { collapseCrossSaveMembers } = await import('../src/clan');
  const player = (type: number, override: number, account = '7'): import('../src/types').PlayerData => ({ status: 'fresh', member: { destinyUserInfo: { membershipId: String(type), membershipType: type, displayName: 'Same name', crossSaveOverride: override }, bungieNetUserInfo: { membershipId: account, membershipType: 254, displayName: 'Same name' } } });
  const xbox = player(1, 3), steam = player(3, 3);
  const result = collapseCrossSaveMembers([xbox, steam]);
  expect(result).toHaveLength(1);
  expect(result[0]?.member).toBe(steam.member);
  expect(result[0]?.otherClanMemberships).toEqual([xbox.member]);
  expect(collapseCrossSaveMembers([player(1, 0), player(3, 0)])).toHaveLength(2);
  expect(collapseCrossSaveMembers([player(1, 1), player(3, 3)])).toHaveLength(2);
  expect(collapseCrossSaveMembers([player(1, 3), player(3, 3, '8')])).toHaveLength(2);
  expect(collapseCrossSaveMembers([{ ...xbox, member: { ...xbox.member, bungieNetUserInfo: undefined } }, steam])).toHaveLength(2);
});
