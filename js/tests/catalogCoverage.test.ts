import { expect, it } from 'vitest';
import { catalogCoverage } from '../src/catalogCoverage';
import type { Definitions, PageConfig } from '../src/types';

// Detector regressions use tiny synthetic definitions. Real manifest content
// checks live separately in audits/manifest.audit.ts.
const node = (hash: number, name: string, children: object, completionRecordHash = 0) => ({ hash, displayProperties: { name }, children, completionRecordHash });
const tiny: Definitions = { version: 'test', language: 'en', nodes: {
  '1': node(1, 'Triumphs', { records: [{ recordHash: 10 }] }),
  '2': node(2, 'Titles', { presentationNodes: [{ presentationNodeHash: 3 }] }),
  '3': node(3, 'A seal', { records: [{ recordHash: 10 }] }, 11),
  '4': node(4, 'Badges', { presentationNodes: [{ presentationNodeHash: 5 }] }),
  '5': node(5, 'A badge', { presentationNodes: [{ presentationNodeHash: 6 }] }),
  '6': node(6, 'Titan', { collectibles: [{ collectibleHash: 20 }] }),
}, records: {
  '10': { hash: 10, scope: 0, displayProperties: { name: 'A triumph' } },
  '11': { hash: 11, scope: 0, displayProperties: { name: 'A seal' }, titleInfo: { titlesByGender: { Male: 'A title' } } },
}, objectives: {}, collectibles: { '20': { hash: 20, scope: 0, displayProperties: { name: 'A collectible' } } } };
const roots = { triumphs: ['1', '2'], seals: ['2'], badges: ['4'] };
const pages: PageConfig[] = [
  { id: 'seal', name: 'A seal', category: 'Other seals', sealNodeHash: '3', records: {} },
  { id: 'badge', name: 'A badge', category: 'Other badges', badgeNodeHash: '5', records: {} },
];
it('detects removed pages and newly introduced triumphs, with names and tree paths', () => {
  const complete = catalogCoverage(tiny, pages, roots);
  expect(complete.missingTriumphs).toEqual([]);
  expect(complete.missingBadges).toEqual([]);
  expect(complete.missingSeals).toEqual([]);
  const removed = catalogCoverage(tiny, [], roots);
  expect(removed.missingTriumphs).toMatchObject([{ hash: '10', name: 'A triumph', paths: ['Triumphs', 'Titles / A seal'] }]);
  expect(removed.missingSeals).toMatchObject([{ hash: '3' }]);
  expect(removed.missingBadges).toMatchObject([{ hash: '5' }]);
  const added: Definitions = { ...tiny, nodes: { ...tiny.nodes, '1': node(1, 'Triumphs', { records: [{ recordHash: 10 }, { recordHash: 12 }] }) }, records: { ...tiny.records, '12': { hash: 12, scope: 0, displayProperties: { name: 'New triumph' } } } };
  expect(catalogCoverage(added, pages, roots).missingTriumphs).toMatchObject([{ hash: '12', name: 'New triumph' }]);
});
it('requires usable rendered views rather than only configured node references', () => {
  const incomplete = { ...tiny, collectibles: {} };
  const result = catalogCoverage(incomplete, pages, roots);
  expect(result.missingBadges).toMatchObject([{ hash: '5' }]);
  expect(result.unavailable).toMatchObject([{ page: 'badge', mode: 'badge' }]);
  expect(() => catalogCoverage(tiny, pages, { ...roots, triumphs: ['missing'] })).toThrow('Coverage root or child node is missing');
});
