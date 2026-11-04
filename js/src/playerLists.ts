import type { BungieFriend } from './friends';
import type { Member, UserInfo } from './types';
import { eachLimited } from './repository';
export type PlayerList = 'clan' | 'friends' | 'combined';
const memberIdentity = (member: Member) =>
  `${member.destinyUserInfo.membershipType}_${member.destinyUserInfo.membershipId}`;
const sameSave = (a: Member, b: Member) =>
  memberIdentity(a) === memberIdentity(b) ||
  !!(
    a.bungieNetUserInfo?.membershipId &&
    a.bungieNetUserInfo.membershipId === b.bungieNetUserInfo?.membershipId &&
    a.destinyUserInfo.crossSaveOverride &&
    a.destinyUserInfo.crossSaveOverride === b.destinyUserInfo.crossSaveOverride
  );
export function combinePlayers(clan: Member[], friends: Member[]): Member[] {
  const result = [...clan];
  for (const friend of friends) {
    const existing = result.findIndex((member) => sameSave(member, friend));
    if (existing >= 0)
      result[existing] = { ...result[existing]!, isFriend: true };
    else result.push(friend);
  }
  return result;
}
export async function friendMembers(
  friends: BungieFriend[],
  memberships: (user: UserInfo) => Promise<UserInfo[]>,
  current = () => true,
): Promise<Member[]> {
  const result: Member[] = [];
  await eachLimited(friends, async (friend) => {
    if (!current()) return;
    const name =
      friend.bungieGlobalDisplayName ||
      friend.bungieNetUser?.displayName ||
      'Unnamed friend';
    const hasPlatform =
      [1, 2, 3, 5, 6].includes(friend.lastSeenAsBungieMembershipType ?? 0) &&
      /^\d+$/.test(friend.lastSeenAsMembershipId ?? '');
    const identity: UserInfo = {
      membershipType: hasPlatform
        ? friend.lastSeenAsBungieMembershipType!
        : 254,
      membershipId: hasPlatform
        ? friend.lastSeenAsMembershipId!
        : (friend.bungieNetUser?.membershipId ?? ''),
      displayName: name,
      bungieGlobalDisplayName: name,
    };
    let user: UserInfo | undefined;
    try {
      const linked = identity.membershipId ? await memberships(identity) : [];
      const seen = linked.find(
        (u) =>
          u.membershipType === identity.membershipType &&
          u.membershipId === identity.membershipId,
      );
      user =
        linked.find(
          (u) =>
            u.crossSaveOverride && u.crossSaveOverride === u.membershipType,
        ) ??
        seen ??
        linked.find((u) => [1, 2, 3, 5, 6].includes(u.membershipType));
    } catch {
      /* A known last-used Destiny membership can still be fetched publicly. */
    }
    if (!user && hasPlatform) user = identity;
    if (!current()) return;
    result.push({
      destinyUserInfo: user ?? identity,
      bungieNetUserInfo: friend.bungieNetUser?.membershipId
        ? {
            membershipType: 254,
            membershipId: friend.bungieNetUser.membershipId,
            displayName: name,
          }
        : undefined,
      isFriend: true,
      listSource: 'friend',
      isOnline: friend.onlineStatus === 1 && !!((friend.onlineTitle ?? 0) & 2),
      profileUnavailable: user
        ? undefined
        : 'No public Destiny membership is available for this friend.',
    });
  });
  return result.sort((a, b) =>
    a.destinyUserInfo.displayName.localeCompare(b.destinyUserInfo.displayName),
  );
}
