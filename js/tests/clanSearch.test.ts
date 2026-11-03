import { expect, it, vi } from 'vitest';
import { ClanDirectory, clanSuggestions, readClanSelection, recentClans } from '../src/clanSearch';
import type { Transport } from '../src/api';
const fallback = { id: '1', name: 'Default clan' };
it('searches only clans and omits the filters forbidden by Bungie, preserving pagination tokens', async () => {
  const transport: Transport = { api: vi.fn().mockResolvedValue({ results: [{ groupId: '123', name: 'Result', groupType: 1, memberCount: 10 }, { groupId: '456', name: 'Group', groupType: 0 }], hasMore: true, replacementContinuationToken: 'next' }), resource: vi.fn() };
  const found = await new ClanDirectory(transport).search('  Result  ', 2, 'previous');
  expect(found).toEqual({ clans: [{ id: '123', name: 'Result', memberCount: 10 }], hasMore: true, continuation: 'next' });
  expect(transport.api).toHaveBeenCalledWith('/GroupV2/Search/', { name: 'Result', groupType: 1, creationDate: 0, sortBy: 0, itemsPerPage: 20, currentPage: 2, requestContinuationToken: 'previous' });
});
it('looks up a numeric clan ID or Bungie clan link and rejects non-clan results', async () => {
  const transport: Transport = { api: vi.fn().mockResolvedValue({ detail: { groupId: '123', name: 'Result', groupType: 1 } }), resource: vi.fn() };
  const directory = new ClanDirectory(transport);
  expect((await directory.search('123')).clans[0]?.id).toBe('123');
  await directory.search('https://www.bungie.net/7/en/Clan/Profile/123');
  expect(transport.api).toHaveBeenLastCalledWith('/GroupV2/123/');
  vi.mocked(transport.api).mockResolvedValue({ detail: { groupId: '123', name: 'Old group', groupType: 0 } });
  await expect(directory.search('123')).rejects.toThrow('invalid clan');
});
it('bounds and deduplicates recent clans, with one suggestion reason per clan', () => {
  const recent = Array.from({ length: 12 }, (_, i) => ({ id: String(i + 1), name: `Clan ${i}`, viewedAt: i }));
  const next = recentClans(recent, fallback, 100);
  expect(next).toHaveLength(7); expect(next.filter(c => c.id === '1')).toHaveLength(1);
  expect(next[0]?.viewedAt).toBe(100);
  expect(readClanSelection({ recent }, fallback).recent).toHaveLength(7);
  const suggestions = clanSuggestions(fallback, next, fallback);
  expect(suggestions.filter(s => s.clan.id === '1')).toHaveLength(1);
  expect(suggestions[0]?.reason).toBe('Selected clan');
  expect(readClanSelection({ selected: { id: '../wrong', name: 'Invalid' }, recent: [null, ...next] }, fallback)).toEqual({ selected: fallback, recent: next });
});
