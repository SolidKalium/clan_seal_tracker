import { expect, it } from 'vitest';
import { buildSeal, headingCell, recordCell } from '../src/domain';
import type { Definitions, Heading, PageConfig, Profile } from '../src/types';
const node = (hash: number, name: string, children: object) => ({ hash, completionRecordHash: 99, displayProperties: { name }, children });
const page: PageConfig = { id: 'monument_of_triumph', name: 'Moments of Triumph', category: 'Other', sealNodeHash: '1', otherNodeHashes: ['2'], records: {} };
const defs: Definitions = { version: 'v', language: 'en', nodes: {
  '1': node(1, 'Monument of Triumph', { records: [{ recordHash: 10 }] }),
  '2': node(2, 'Monument of Triumph', { presentationNodes: [{ presentationNodeHash: 3 }] }),
  '3': node(3, 'Worlds', { presentationNodes: [{ presentationNodeHash: 4 }, { presentationNodeHash: 5 }] }),
  '4': node(4, 'Vistas', { records: [{ recordHash: 11 }, { recordHash: 12 }] }),
  '5': node(5, 'Patrol', { records: [{ recordHash: 13 }] }),
}, records: Object.fromEntries([10, 11, 12, 13, 98, 99].map(hash => [String(hash), { hash, scope: hash === 98 ? 1 : 0, displayProperties: { name: String(hash) }, ...(hash === 99 ? { titleInfo: { gildingTrackingRecordHash: 98 } } : {}) }])), objectives: {} };
it('uses a non-scored gilded status and groups the underlying categories under shared headers', () => {
  const seal = buildSeal(page, defs);
  expect(seal.headings[0]).toMatchObject({ name: 'Gilded', metric: 'gilded', skip: true });
  expect(seal.headings).toHaveLength(2);
  const full = buildSeal(page, defs, 'triumphs');
  expect(full.headings.map(h => h.group)).toEqual(['Seal requirements', 'Seal requirements', 'Worlds: Vistas', 'Worlds: Vistas', 'Worlds: Patrol']);
});
it('distinguishes yes, no, and unavailable, including character-scoped completion without a lifetime counter', () => {
  const heading = buildSeal(page, defs).headings[0]!;
  expect(recordCell(undefined, heading)).toMatchObject({ text: '—', missing: true });
  expect(recordCell({ state: 4, completedCount: 0 }, heading)).toMatchObject({ text: '·', complete: false });
  expect(recordCell({ state: 4, completedCount: 1 }, heading)).toMatchObject({ text: '✓', complete: true, fraction: 0 });
  const profile: Profile = { characterRecords: { data: { a: { records: { '98': { state: 4, completedCount: 0 } } }, b: { records: { '98': { state: 1, completedCount: 0 } } } } } };
  expect(headingCell(profile, heading)).toMatchObject({ text: '✓', missing: false });
  const count: Heading = { ...heading, metric: 'gildingCount' };
  expect(recordCell({ state: 4, completedCount: 3 }, count).text).toBe('3');
});
