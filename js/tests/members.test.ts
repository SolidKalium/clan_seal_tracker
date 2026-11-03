import { expect, it } from 'vitest';
import { memberName, membersCsv, ownership, primarySave } from '../src/members';
import type { PlayerData } from '../src/types';
const player: PlayerData = { status: 'fresh', member: { destinyUserInfo: { membershipType: 3, membershipId: '1', displayName: 'Name', bungieGlobalDisplayName: 'Guardian', bungieGlobalDisplayNameCode: 7, crossSaveOverride: 2 } }, profile: { profile: { data: { userInfo: { membershipType: 2, membershipId: '2', displayName: 'PSN' }, versionsOwned: 1025, seasonHashes: [10], eventCardHashesOwned: [20] } } } };
it('uses roster primary save and keeps unknown entitlements distinct from unowned', () => {
  expect(primarySave(player)).toBe('PlayStation');
  expect(memberName({ ...player, profile: undefined })).toBe('Guardian#0007');
  expect(ownership(player, 'version', 1024)).toBe(true);
  expect(ownership(player, 'version', 512)).toBe(false);
  expect(ownership(player, 'season', 10)).toBe(true);
  expect(ownership({ ...player, profile: undefined }, 'version', 1)).toBeUndefined();
});
it('quotes CSV fields and neutralizes formula-like account names', () => {
  expect(membersCsv([['Name', 'Platform'], ['A,"B', '=1+1']])).toBe('"Name","Platform"\r\n"A,""B","\'=1+1"\r\n');
});
