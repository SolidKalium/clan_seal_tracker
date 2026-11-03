import type { PlayerData, UserInfo } from './types';
export interface MemberEntitlements {
  seasons: Record<string, { displayProperties?: { name?: string }; seasonNumber?: number; startDate?: string }>;
}
export const platforms: Record<number, string> = { 1: 'Xbox', 2: 'PlayStation', 3: 'Steam', 4: 'Battle.net', 5: 'Stadia', 6: 'Epic Games' };
// Bungie DestinyGameVersions flags, including the post-PHP expansions.
export const gameVersions: [number, string][] = [[1, 'Destiny 2'], [2, 'Curse of Osiris'], [4, 'Warmind'], [8, 'Forsaken'], [16, 'Year 2 Annual Pass'], [32, 'Shadowkeep'], [64, 'Beyond Light'], [128, '30th Anniversary'], [256, 'The Witch Queen'], [512, 'Lightfall'], [1024, 'The Final Shape'], [2048, 'The Edge of Fate'], [4096, 'Renegades']];
export function memberName(player: PlayerData): string {
  const user = player.profile?.profile?.data?.userInfo ?? player.member.destinyUserInfo;
  const code = user.bungieGlobalDisplayNameCode;
  return (user.bungieGlobalDisplayName || user.displayName) + (code === undefined ? '' : `#${String(code).padStart(4, '0')}`);
}
export function primarySave(player: PlayerData): string {
  const user = player.profile?.profile?.data?.userInfo ?? player.member.destinyUserInfo;
  const type = user.crossSaveOverride || player.member.destinyUserInfo.crossSaveOverride;
  return type ? platforms[type] ?? `Platform ${type}` : '—';
}
export function ownership(player: PlayerData, kind: 'version' | 'season', id: number): boolean | undefined {
  const data = player.profile?.profile?.data;
  if (!data) return;
  if (kind === 'version') return data.versionsOwned === undefined ? undefined : !!(data.versionsOwned & id);
  const hashes = data.seasonHashes;
  return hashes === undefined ? undefined : hashes.some(hash => String(hash) === String(id));
}
export function platformName(memberships: UserInfo[] | undefined, type: number): string {
  return memberships?.find(m => m.membershipType === type)?.displayName ?? '';
}
export function membersCsv(rows: string[][]): string {
  return rows.map(row => row.map(value => {
    // Names come from remote accounts; keep spreadsheet formulas inert.
    const safe = /^[\s]*[=+@-]/.test(value) ? `'${value}` : value;
    return `"${safe.replaceAll('"', '""')}"`;
  }).join(',')).join('\r\n') + '\r\n';
}
