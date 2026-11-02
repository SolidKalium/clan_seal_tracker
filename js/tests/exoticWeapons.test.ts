import { expect, it } from 'vitest';
import { buildSeal, headingCell } from '../src/domain';
import type { Definitions, PageConfig, Profile } from '../src/types';
const page: PageConfig = { id: 'exotic_weapons', name: 'Exotic weapons', category: 'Other', groupByNode: true, otherNodeHashes: ['10'], records: {} };
const defs: Definitions = { version: 'v', language: 'en', nodes: { '10': { hash: 10, completionRecordHash: 0, displayProperties: { name: 'Kinetic' }, children: { collectibles: [1, 2, 3].map(collectibleHash => ({ collectibleHash })) } } }, records: { '20': { hash: 20, scope: 0, recordTypeName: 'Weapon Pattern', displayProperties: { name: 'Wish-Keeper' } } }, objectives: {}, collectibles: {
  '1': { hash: 1, scope: 0, itemHash: 100, displayProperties: { name: 'Wish-Keeper' } },
  '2': { hash: 2, scope: 0, itemHash: 100, displayProperties: { name: 'Wish-Keeper' } },
  '3': { hash: 3, scope: 0, itemHash: 101, displayProperties: { name: 'Wish-Keeper' } },
}, items: { '100': { displayProperties: { name: 'Wish-Keeper' }, itemType: 3 }, '101': { displayProperties: { name: 'Different item' }, itemType: 3 } } };
const profile = (states: Record<string, { state: number }>, pattern?: number): Profile => ({ profileCollectibles: { data: { collectibles: states } }, profileRecords: { data: { records: pattern === undefined ? {} : { '20': { state: pattern } } } } });
it('merges by item identity, retains all identifiers, and leaves different items with the same name separate', () => {
  const seal = buildSeal(page, defs, 'triumphs');
  expect(seal.headings).toHaveLength(2);
  expect(seal.headings[0]).toMatchObject({ alternativeCollectibleHashes: ['1', '2'], collectibleHashes: ['1'], pattern: { hash: '20', scope: 0 } });
  expect(seal.headings[1]?.alternativeCollectibleHashes).toBeUndefined();
});
it('counts either version once, with no armor class variants and independent pattern status', () => {
  const heading = buildSeal(page, defs, 'triumphs').headings[0]!;
  for (const owned of ['1', '2']) {
    const cell = headingCell(profile({ '1': { state: owned === '1' ? 0 : 1 }, '2': { state: owned === '2' ? 0 : 1 } }, 4), heading);
    expect(cell).toMatchObject({ complete: true, fraction: 1, missing: false, patternUnlocked: false });
    expect(cell.variants).toBeUndefined();
  }
  expect(headingCell(profile({ '1': { state: 1 }, '2': { state: 1 } }, 1), heading)).toMatchObject({ complete: false, missing: false, patternUnlocked: true });
});
it('retains unknown ownership when an unowned entry has a missing alternative', () => {
  const heading = buildSeal(page, defs, 'triumphs').headings[0]!;
  expect(headingCell(profile({ '1': { state: 1 } }), heading)).toMatchObject({ missing: true, text: '—', patternUnlocked: undefined });
  expect(headingCell(profile({ '2': { state: 0 } }), heading)).toMatchObject({ complete: true, missing: false });
});
