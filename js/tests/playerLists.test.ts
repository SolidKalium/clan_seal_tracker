import { expect, it, vi } from 'vitest';
import { combinePlayers, friendMembers } from '../src/playerLists';
import type { Member } from '../src/types';
const user = { membershipType: 3, membershipId: '123', displayName: 'Friend' };
const clan: Member = {
  destinyUserInfo: user,
  joinDate: '2020-01-01',
  memberType: 3,
};
it('combines overlapping friends once while preserving clan metadata and independent platform saves', () => {
  const friend: Member = {
    destinyUserInfo: user,
    isFriend: true,
    listSource: 'friend',
  };
  expect(combinePlayers([clan], [friend])).toEqual([
    { ...clan, isFriend: true },
  ]);
  expect(
    combinePlayers(
      [clan],
      [
        {
          ...friend,
          destinyUserInfo: { ...user, membershipType: 1, membershipId: '456' },
        },
      ],
    ),
  ).toHaveLength(2);
});
it('resolves public friend memberships to cross-save primary and treats generic online presence as unknown activity', async () => {
  const primary = {
    ...user,
    membershipType: 2,
    membershipId: '456',
    crossSaveOverride: 2,
  };
  const memberships = vi
    .fn()
    .mockResolvedValue([{ ...user, crossSaveOverride: 2 }, primary]);
  const result = await friendMembers(
    [
      {
        lastSeenAsMembershipId: '123',
        lastSeenAsBungieMembershipType: 3,
        onlineStatus: 1,
        onlineTitle: 0,
        bungieNetUser: { membershipId: '7' },
      },
    ],
    memberships,
  );
  expect(memberships).toHaveBeenCalledWith(
    expect.objectContaining({ membershipId: '123', membershipType: 3 }),
  );
  expect(result[0]).toMatchObject({
    destinyUserInfo: primary,
    isFriend: true,
    listSource: 'friend',
    isOnline: false,
  });
  expect(result[0]?.lastOnlineStatusChange).toBeUndefined();
  expect(result[0]?.joinDate).toBeUndefined();
});
it('preserves friends without a public Destiny membership as unavailable without inventing a game identity', async () => {
  const memberships = vi.fn().mockResolvedValue([]);
  const result = await friendMembers(
    [
      {
        bungieGlobalDisplayName: 'Friend',
        bungieNetUser: { membershipId: '7' },
      },
    ],
    memberships,
  );
  expect(result[0]?.profileUnavailable).toContain(
    'No public Destiny membership',
  );
  expect(result[0]?.destinyUserInfo.membershipType).toBe(254);
});
it('does not continue resolving friends after a list change', async () => {
  const memberships = vi.fn();
  expect(
    await friendMembers(
      [{ lastSeenAsMembershipId: '123', lastSeenAsBungieMembershipType: 3 }],
      memberships,
      () => false,
    ),
  ).toEqual([]);
  expect(memberships).not.toHaveBeenCalled();
});
