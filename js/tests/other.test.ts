import { expect, it } from 'vitest';
import { buildOtherPage, otherCell } from '../src/other';
import { buildSeal } from '../src/domain';
import type { Definitions, PageConfig, Profile } from '../src/types';
const page: PageConfig = { id: 'other', name: 'Other', category: 'Other', records: {} };
const defs: Definitions = { version: 'test', language: 'en', nodes: {}, records: {}, objectives: {} };
it('shows the three reported rank metrics without inventing seasonal history or completion goals', () => {
  const ranks = buildOtherPage({ ...page, kind: 'ranks' }, defs)!;
  expect(ranks.headings.map(h => h.metricKey)).toEqual(['currentGuardianRank', 'renewedGuardianRank', 'lifetimeHighestGuardianRank']);
  const p = { profile: { data: { currentGuardianRank: 5, renewedGuardianRank: 4, lifetimeHighestGuardianRank: 11 } } } as Profile;
  expect(ranks.headings.map(h => otherCell(p, h, ranks.headings)?.text)).toEqual(['5', '4', '11']);
  expect(ranks.headings.every(h => h.skip && !h.objectives.length)).toBe(true);
  expect(otherCell(undefined, ranks.headings[0]!, ranks.headings)).toMatchObject({ text: '—', missing: true });
});
it('discovers individual rank requirements recursively from current rank definitions', () => {
  const rankDefs: Definitions = { ...defs, guardianRanks: { '22': { hash: 22, rankNumber: 2, presentationNodeHash: 10, displayProperties: { name: 'Explorer' } } }, nodes: {
    '10': { hash: 10, completionRecordHash: 0, displayProperties: { name: 'Explorer' }, children: { presentationNodes: [{ presentationNodeHash: 11 }] } },
    '11': { hash: 11, completionRecordHash: 0, displayProperties: { name: 'Journey' }, children: { records: [{ recordHash: 42 }] } },
  }, records: { '42': { hash: 42, scope: 0, displayProperties: { name: 'Rank requirement' } } } };
  expect(buildSeal({ ...page, guardianRank: 2 }, rankDefs, 'triumphs').headings).toMatchObject([{ hash: '42', group: 'Journey' }]);
  expect(buildSeal({ ...page, guardianRank: 7 }, rankDefs).unavailable).toBeTruthy();
});
it('uses commendation names/colors, includes unlisted child cards, and preserves numeric zero versus missing', () => {
  const source: Definitions = { ...defs, commendationNodes: {
    '1062358355': { hash: 1062358355, displayProperties: { name: 'Root' }, childCommendationNodeHashes: [1] },
    '1': { hash: 1, displayProperties: { name: 'Ally' }, color: { red: 54, green: 163, blue: 137, alpha: 255 }, childCommendationHashes: [2] },
  }, commendations: { '2': { hash: 2, parentCommendationNodeHash: 1, displayProperties: { name: 'Selfless' }, displayActivities: [{ name: 'Raids' }] }, '3': { hash: 3, parentCommendationNodeHash: 1, displayProperties: { name: 'Patient' } } } };
  const seal = buildOtherPage({ ...page, kind: 'commendations' }, source)!;
  expect(seal.headings.map(h => h.name)).toEqual(['Total score', 'Given', 'Received', 'Ally', 'Selfless', 'Patient']);
  expect(seal.headings[3]).toMatchObject({ color: 'rgb(54 163 137)', skip: true });
  expect(seal.headings[4]?.description).toContain('Raids');
  const profile: Profile = { profileCommendations: { data: { totalScore: 400, scoreDetailValues: [0, 7], commendationNodeScoresByHash: { '1': 12 }, commendationNodePercentagesByHash: { '1': 25 }, commendationScoresByHash: { '2': 0 } } } };
  expect(seal.headings.map(h => otherCell(profile, h, seal.headings)?.text)).toEqual(['400', '0', '7', '12', '0', '—']);
  expect(otherCell(profile, seal.headings[3]!, seal.headings)?.detail).toContain('25%');
});
it('keeps checklist false distinct from absent data and selects a whole character without merging entries', () => {
  const source: Definitions = { ...defs, checklists: { '10': { hash: 10, scope: 1, displayProperties: { name: 'Checklist' }, entries: [1, 2, 3].map(hash => ({ hash, scope: 1, displayProperties: { name: String(hash) } })) } } };
  const checklist = buildOtherPage({ ...page, checklistHash: '10' }, source)!;
  const profile: Profile = { characterProgressions: { data: { a: { checklists: { '10': { '1': true, '2': false, '3': false } } }, b: { checklists: { '10': { '1': false, '2': true, '3': true } } } } } };
  expect(checklist.headings.map(h => otherCell(profile, h, checklist.headings)?.text)).toEqual(['·', '✓', '✓']);
  const account = { ...checklist.headings[0]!, scope: 0 };
  expect(otherCell({ profileProgression: { data: { checklists: { '10': { '1': false } } } } }, account, [account])).toMatchObject({ text: '·', missing: false });
  expect(otherCell(undefined, account, [account])).toMatchObject({ text: '—', missing: true });
});
