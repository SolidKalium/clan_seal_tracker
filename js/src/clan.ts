import type { Member } from './types';

export function clanJoinedAt(member: Member, now = Date.now()): number | undefined {
  if (!member.joinDate) return undefined;
  const time = Date.parse(member.joinDate);
  return Number.isFinite(time) && time > 0 && time <= now ? time : undefined;
}

// Earliest known join date first; missing/invalid dates last.
export function compareClanTenure(a: Member, b: Member): number {
  const left = clanJoinedAt(a), right = clanJoinedAt(b);
  if (left === right) return 0;
  if (left === undefined) return 1;
  if (right === undefined) return -1;
  return left - right;
}

// Bungie GroupsV2.RuntimeGroupMemberType. Keep unknown values explicit.
export function clanRankLabel(memberType?: number): string {
  const ranks: Record<number, string> = { 0: 'None', 1: 'Beginner', 2: 'Member', 3: 'Admin', 4: 'Acting Founder', 5: 'Founder' };
  return memberType === undefined ? 'Rank unavailable' : ranks[memberType] ?? 'Unknown rank';
}

// Only an account-wide cross-save override makes these roster memberships
// equivalent. Independent saves and unknown Bungie identities stay separate.
export function collapseCrossSaveMembers(players: import('./types').PlayerData[]): import('./types').PlayerData[] {
  const groups = new Map<string, import('./types').PlayerData[]>();
  for (const player of players) {
    const user = player.member.destinyUserInfo;
    const account = player.member.bungieNetUserInfo?.membershipId;
    const key = account && user.crossSaveOverride ? `account:${account}:${user.crossSaveOverride}` : `membership:${user.membershipType}:${user.membershipId}`;
    const group = groups.get(key) ?? [];
    group.push(player); groups.set(key, group);
  }
  return [...groups.values()].map(group => {
    if (group.length === 1) return group[0]!;
    const primary = group.find(p => p.member.destinyUserInfo.membershipType === p.member.destinyUserInfo.crossSaveOverride) ?? group[0]!;
    return { ...primary, otherClanMemberships: group.filter(p => p !== primary).map(p => p.member) };
  });
}
