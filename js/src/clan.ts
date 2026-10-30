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
