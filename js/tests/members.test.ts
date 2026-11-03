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

it('keeps duplicate-class guardians and distinguishes missing classes from unavailable information', async () => {
  const { accountGuardians, guardianPower } = await import('../src/members');
  const profile = { characters: { data: {
    'titan-2': { classType: 0, light: 1980 },
    'titan-1': { classType: 0, light: 2005 },
    'hunter': { classType: 1, light: 0 },
  } } };
  expect(accountGuardians(profile)?.map(c => c.id)).toEqual(['titan-1', 'titan-2', 'hunter']);
  expect(guardianPower(profile, 0)).toBe('2005');
  expect(guardianPower(profile, 0, 'all')).toBe('2005 / 1980');
  expect(guardianPower(profile, 1)).toBe('0');
  expect(guardianPower(profile, 2)).toBe('·');
  expect(accountGuardians({ characters: { data: {} } })).toEqual([]);
  expect(accountGuardians({ characters: { privacy: 2 } })).toBeUndefined();
  expect(guardianPower(undefined, 0)).toBe('—');
});

it('labels independent multi-platform memberships but leaves single-platform and cross-save-primary rows unlabelled', async () => {
  const { clanMembershipPlatform } = await import('../src/members');
  const member = { destinyUserInfo: { membershipType: 3, membershipId: '1', displayName: 'Name', crossSaveOverride: 0 } };
  const linked = [member.destinyUserInfo, { membershipType: 1, membershipId: '2', displayName: 'Xbox' }];
  expect(clanMembershipPlatform(member, linked)).toBe('Steam');
  expect(clanMembershipPlatform(member, [member.destinyUserInfo])).toBeUndefined();
  expect(clanMembershipPlatform(member)).toBeUndefined();
  expect(clanMembershipPlatform({ destinyUserInfo: { ...member.destinyUserInfo, crossSaveOverride: 3 } }, linked)).toBeUndefined();
  expect(clanMembershipPlatform({ destinyUserInfo: { ...member.destinyUserInfo, crossSaveOverride: 1 } }, linked)).toBe('Steam');
});
