import { friendReason, type FriendClan } from './friends';
import type { Transport } from './api';
export interface ClanChoice { id: string; name: string; memberCount?: number }
export interface RecentClan extends ClanChoice { viewedAt: number }
export interface ClanSelection { selected: ClanChoice; recent: RecentClan[] }
export const RECENT_CLAN_LIMIT = 7;
export const validClanId = (value: unknown): value is string => typeof value === 'string' && /^[1-9]\d{0,19}$/.test(value);
export function recentClans(recent: RecentClan[], clan: ClanChoice, now = Date.now()): RecentClan[] {
  return [{ ...clan, viewedAt: now }, ...recent.filter(entry => entry.id !== clan.id)].slice(0, RECENT_CLAN_LIMIT);
}
export function clanSuggestions(selected: ClanChoice, recent: RecentClan[], fallback: ClanChoice, own?: ClanChoice, friends: FriendClan[] = []) {
  const seen = new Set<string>();
  const selectedFriends = friends.find(clan => clan.id === selected.id);
  return [...(own ? [{ clan: own, reason: 'Your clan', viewedAt: undefined }] : []), { clan: selected, reason: selectedFriends ? `Selected clan · ${friendReason(selectedFriends)}` : 'Selected clan', viewedAt: undefined },
    ...friends.map(clan => ({ clan, reason: friendReason(clan), viewedAt: undefined })),
    ...recent.map(clan => ({ clan, reason: 'Recently viewed', viewedAt: clan.viewedAt })),
    { clan: fallback, reason: 'Suggested default', viewedAt: undefined },
  ].filter(entry => !seen.has(entry.clan.id) && !!seen.add(entry.clan.id));
}
export function readClanSelection(value: unknown, fallback: ClanChoice): ClanSelection {
  const state = value as Partial<ClanSelection> | undefined;
  const valid = (clan: unknown): clan is ClanChoice => !!clan && typeof clan === 'object' && validClanId((clan as ClanChoice).id) && typeof (clan as ClanChoice).name === 'string';
  return { selected: valid(state?.selected) ? state.selected : fallback,
    recent: Array.isArray(state?.recent) ? state.recent.filter(entry => valid(entry) && Number.isFinite(entry.viewedAt)).filter((entry, i, list) => list.findIndex(other => other.id === entry.id) === i).slice(0, RECENT_CLAN_LIMIT) : [] };
}
interface ClanCard { groupId: string | number; name: string; groupType: number; memberCount?: number }
export class ClanDirectory {
  constructor(private transport: Transport) {}
  async search(query: string, page = 1, continuation?: string): Promise<{ clans: ClanChoice[]; hasMore: boolean; continuation?: string }> {
    query = query.trim();
    if (!query) return { clans: [], hasMore: false };
    const id = /^\d+$/.test(query) ? query : /bungie\.net\/.*(?:Clan\/Profile\/|[?&]groupid=)(\d+)/i.exec(query)?.[1];
    const choice = (card: ClanCard): ClanChoice => {
      if (!card || card.groupType !== 1 || !validClanId(String(card.groupId)) || !card.name) throw new Error('Bungie returned invalid clan information.');
      return { id: String(card.groupId), name: card.name, memberCount: card.memberCount };
    };
    if (id) {
      if (!validClanId(id)) throw new Error('Enter a valid clan ID.');
      const response = await this.transport.api<{ detail: ClanCard }>(`/GroupV2/${id}/`);
      return { clans: [choice(response.detail)], hasMore: false };
    }
    // GroupQuery explicitly forbids locale/tag/member-count filters for clans.
    const response = await this.transport.api<{ results: ClanCard[]; hasMore: boolean; replacementContinuationToken?: string }>('/GroupV2/Search/', {
      name: query, groupType: 1, creationDate: 0, sortBy: 0, itemsPerPage: 20, currentPage: page,
      ...(continuation ? { requestContinuationToken: continuation } : {}),
    });
    if (!Array.isArray(response.results)) throw new Error('Bungie returned an invalid clan search response.');
    return { clans: response.results.filter(card => card.groupType === 1).map(choice), hasMore: !!response.hasMore, continuation: response.replacementContinuationToken };
  }
}
