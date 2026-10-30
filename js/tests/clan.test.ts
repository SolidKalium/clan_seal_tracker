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
