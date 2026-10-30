import type { Cached, Member } from './types';
export const MINUTE = 60_000;
export const PROFILE_COMPONENTS = [100, 800, 900];
export function profileFresh(entry: Cached<unknown> | undefined, member: Member, now = Date.now()): boolean {
  if (!entry || entry.private || entry.error || PROFILE_COMPONENTS.some(c => !entry.components?.includes(c))) return false;
  const age = now - entry.fetchedAt;
  if (age < 0 || age > 7 * 24 * 60 * MINUTE) return false;
  const lastSeen = member.isOnline ? now : Number(member.lastOnlineStatusChange) * 1000;
  if (lastSeen > now) return false;
  if (!Number.isFinite(lastSeen) || !lastSeen) return age < 5 * MINUTE;
  return lastSeen < entry.fetchedAt || (now - lastSeen < 5 * MINUTE && lastSeen < entry.fetchedAt + 5 * MINUTE);
}
export function fresh(entry: Cached<unknown> | undefined, ttl: number, now = Date.now()) { return !!entry && now - entry.fetchedAt >= 0 && now - entry.fetchedAt < ttl && !entry.error; }
