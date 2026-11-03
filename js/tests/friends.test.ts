import { expect, it, vi } from 'vitest';
import { FriendDirectory } from '../src/friends';
import { clanSuggestions } from '../src/clanSearch';
const friend = (id: string, name: string, onlineStatus = 0) => ({
  relationship: 1,
  bungieGlobalDisplayName: name,
  onlineStatus,
  lastSeenAsMembershipId: id,
  lastSeenAsBungieMembershipType: 3,
  bungieNetUser: { membershipId: id },
});
const group = (id: string, name: string) => ({
  group: { groupId: id, name, groupType: 1, memberCount: 20 },
});
it('loads only accepted friends, deduplicates relationships, groups public clans, and limits reasons to three names', async () => {
  const friends = [
    friend('1', 'Ada', 1),
    friend('2', 'Banshee'),
    friend('3', 'Crow'),
    friend('4', 'Drifter'),
    friend('1', 'Ada'),
    { ...friend('5', 'Pending'), relationship: 2 },
  ];
  const self = { api: vi.fn().mockResolvedValue({ friends }) },
    publicApi = {
      api: vi.fn().mockResolvedValue({ results: [group('10', 'Friend clan')] }),
    };
  const directory = new FriendDirectory(self, publicApi);
  const result = await directory.load();
  expect(self.api).toHaveBeenCalledWith('/Social/Friends/');
  expect(publicApi.api).toHaveBeenCalledTimes(4);
  expect(result.friends).toHaveLength(4);
  expect(result.clans).toEqual([
    {
      id: '10',
      name: 'Friend clan',
      memberCount: 20,
      friends: ['Ada', 'Banshee', 'Crow', 'Drifter'],
      online: 1,
    },
  ]);
  const own = { id: '20', name: 'Own clan' };
  const suggestions = clanSuggestions(
    own,
    [{ id: '10', name: 'Friend clan', viewedAt: 1 }],
    own,
    own,
    result.clans,
  );
  expect(suggestions.map((s) => s.reason)).toEqual([
    'Your clan',
    'Friends: Ada, Banshee, and 2 more',
  ]);
  await directory.load();
  expect(self.api).toHaveBeenCalledTimes(1);
  await directory.load(true);
  expect(self.api).toHaveBeenCalledTimes(2);
});
it('uses Bungie membership when the last platform is unknown and retains partial results on lookup failure', async () => {
  const self = {
    api: vi.fn().mockResolvedValue({
      friends: [
        friend('1', 'Ada'),
        { ...friend('2', 'Banshee'), lastSeenAsBungieMembershipType: 0 },
      ],
    }),
  };
  const publicApi = {
    api: vi.fn().mockImplementation(async (path: string) => {
      if (path.includes('/3/1/')) throw new Error('offline');
      return { results: [group('10', 'Available clan')] };
    }),
  };
  const result = await new FriendDirectory(self, publicApi).load();
  expect(publicApi.api).toHaveBeenCalledWith('/GroupV2/User/254/2/0/1/');
  expect(result.failed).toBe(1);
  expect(result.clans[0]?.name).toBe('Available clan');
});
it('bounds clan requests to three concurrent lookups', async () => {
  let active = 0,
    maximum = 0;
  const self = {
    api: vi.fn().mockResolvedValue({
      friends: Array.from({ length: 10 }, (_, i) =>
        friend(String(i + 1), `Friend ${i}`),
      ),
    }),
  };
  const publicApi = {
    api: vi.fn().mockImplementation(async () => {
      maximum = Math.max(maximum, ++active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active--;
      return { results: [] };
    }),
  };
  await new FriendDirectory(self, publicApi).load();
  expect(maximum).toBe(3);
});
it('clears private relationships and ignores cache writes from an older login', async () => {
  let release!: (value: unknown) => void;
  const self = {
    api: vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      )
      .mockResolvedValue({ friends: [] }),
  };
  const publicApi = { api: vi.fn() },
    directory = new FriendDirectory(self, publicApi);
  const old = directory.load();
  directory.clear();
  release({ friends: [friend('1', 'Old friend')] });
  await old;
  expect(publicApi.api).not.toHaveBeenCalled();
  expect((await directory.load()).friends).toEqual([]);
  expect(self.api).toHaveBeenCalledTimes(2);
});
