import type { Transport } from './api';
import type { ClanChoice } from './clanSearch';
import { eachLimited } from './repository';
export interface BungieFriend {
  lastSeenAsMembershipId?: string;
  lastSeenAsBungieMembershipType?: number;
  bungieGlobalDisplayName?: string;
  onlineStatus?: number;
  onlineTitle?: number;
  relationship?: number;
  bungieNetUser?: { membershipId: string; displayName?: string };
}
export interface FriendClan extends ClanChoice {
  friends: string[];
  online: number;
}
export interface FriendSuggestions {
  friends: BungieFriend[];
  clans: FriendClan[];
  failed: number;
  checkedAt: number;
}
/** Private social data lives only in this login's memory. Clan lookups are public. */
export class FriendDirectory {
  private cached?: FriendSuggestions;
  private list?: { friends: BungieFriend[]; checkedAt: number };
  private listPending?: Promise<BungieFriend[]>;
  private pending?: Promise<FriendSuggestions>;
  private generation = 0;
  private clans = new Map<string, { value: ClanChoice[]; checkedAt: number }>();
  constructor(
    private self: Pick<Transport, 'api'>,
    private publicTransport: Pick<Transport, 'api'>,
  ) {}
  clear() {
    this.generation++;
    this.cached = undefined;
    this.list = undefined;
    this.listPending = undefined;
    this.pending = undefined;
    this.clans.clear();
  }
  load(force = false): Promise<FriendSuggestions> {
    if (this.pending) return this.pending;
    if (
      !force &&
      this.cached &&
      Date.now() - this.cached.checkedAt < 5 * 60_000
    )
      return Promise.resolve(this.cached);
    const generation = this.generation;
    const task = this.fetch(force, generation)
      .then((value) => {
        if (generation === this.generation) this.cached = value;
        return value;
      })
      .finally(() => {
        if (this.pending === task) this.pending = undefined;
      });
    this.pending = task;
    return task;
  }
  get friendCheckedAt() {
    return this.list?.checkedAt;
  }
  friendList(force = false): Promise<BungieFriend[]> {
    if (this.listPending) return this.listPending;
    if (!force && this.list && Date.now() - this.list.checkedAt < 5 * 60_000)
      return Promise.resolve(this.list.friends);
    const generation = this.generation;
    const task = this.self
      .api<{ friends: BungieFriend[] }>('/Social/Friends/')
      .then((response) => {
        if (!Array.isArray(response.friends))
          throw new Error('Bungie returned an invalid friend list.');
        const seen = new Set<string>();
        const friends = response.friends.filter((friend) => {
          if (friend.relationship !== 1) return false;
          const id =
            friend.bungieNetUser?.membershipId ??
            `${friend.lastSeenAsBungieMembershipType}:${friend.lastSeenAsMembershipId}`;
          return !seen.has(id) && !!seen.add(id);
        });
        if (generation === this.generation)
          this.list = { friends, checkedAt: Date.now() };
        return friends;
      })
      .finally(() => {
        if (this.listPending === task) this.listPending = undefined;
      });
    this.listPending = task;
    return task;
  }
  private async fetch(
    force: boolean,
    generation: number,
  ): Promise<FriendSuggestions> {
    const friends = await this.friendList(force);
    const groups = new Map<string, FriendClan>();
    let failed = 0;
    await eachLimited(friends, async (friend) => {
      if (generation !== this.generation) return;
      const platform = friend.lastSeenAsBungieMembershipType;
      const usePlatform =
        [1, 2, 3, 5, 6].includes(platform ?? 0) &&
        /^\d+$/.test(friend.lastSeenAsMembershipId ?? '');
      const id = usePlatform
        ? friend.lastSeenAsMembershipId
        : friend.bungieNetUser?.membershipId;
      if (!id || !/^\d+$/.test(id)) return;
      const key = `${usePlatform ? platform : 254}/${id}`;
      try {
        let cached = this.clans.get(key);
        if (force || !cached || Date.now() - cached.checkedAt > 15 * 60_000) {
          const result = await this.publicTransport.api<{
            results: {
              group: {
                groupId: string;
                name: string;
                groupType: number;
                memberCount?: number;
              };
            }[];
          }>(`/GroupV2/User/${key}/0/1/`);
          if (!Array.isArray(result.results))
            throw new Error('Invalid clan response.');
          const value = result.results
            .filter(
              (entry) =>
                entry.group?.groupType === 1 &&
                /^[1-9]\d{0,19}$/.test(String(entry.group.groupId)) &&
                !!entry.group.name,
            )
            .map(({ group }) => ({
              id: String(group.groupId),
              name: group.name,
              memberCount: group.memberCount,
            }));
          cached = { value, checkedAt: Date.now() };
          if (generation === this.generation) this.clans.set(key, cached);
        }
        for (const clan of cached.value) {
          const entry = groups.get(clan.id) ?? {
            ...clan,
            friends: [],
            online: 0,
          };
          const name =
            friend.bungieGlobalDisplayName ||
            friend.bungieNetUser?.displayName ||
            'Unnamed friend';
          entry.friends.push(name);
          if (friend.onlineStatus === 1) entry.online++;
          groups.set(clan.id, entry);
        }
      } catch {
        failed++;
      }
    });
    return {
      friends,
      clans: [...groups.values()].sort(
        (a, b) =>
          b.friends.length - a.friends.length ||
          b.online - a.online ||
          a.name.localeCompare(b.name),
      ),
      failed,
      checkedAt: Date.now(),
    };
  }
}
export function friendReason(clan: FriendClan): string {
  const entries =
    clan.friends.length > 3
      ? [...clan.friends.slice(0, 2), `${clan.friends.length - 2} more`]
      : clan.friends;
  return `Friends: ${new Intl.ListFormat('en', { style: 'long', type: 'conjunction' }).format(entries)}`;
}
