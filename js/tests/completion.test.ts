import { expect, it } from 'vitest';
import { completionCounts, sealRequirements } from '../src/completion';
import type { Cell, Definitions, Heading } from '../src/types';
const record = (hash: number, extra = {}) => ({ hash, scope: 0, displayProperties: { name: String(hash) }, ...extra });
const defs: Definitions = { version: 'test', language: 'en', nodes: {}, objectives: {
  '100': { hash: 100, completionValue: 1 }, '101': { hash: 101, completionValue: 3 },
}, records: { '1': record(1), '2': record(2), '3': record(3, { forTitleGilding: true }),
  '99': record(99, { objectiveHashes: [100], titleInfo: { gildingTrackingRecordHash: 90 } }),
  '90': record(90, { objectiveHashes: [101] }),
} };
const node = { hash: 4, completionRecordHash: 99, displayProperties: { name: 'Seal' }, children: { records: [1, 2, 3].map(recordHash => ({ recordHash })) } };
it('separates base seal thresholds from the additional gilding requirements', () => {
  expect(sealRequirements(node, defs)).toEqual({ seal: { required: 1, total: 2 }, gilding: { required: 1, total: 1, requiresSeal: true } });
});
it('supports a higher gilding threshold on the same set and avoids inventing missing thresholds', () => {
  const source = { ...defs, records: { ...defs.records, '3': record(3) } };
  expect(sealRequirements(node, source)).toEqual({ seal: { required: 1, total: 3 }, gilding: { required: 3, total: 3, requiresSeal: false } });
  const unknown = { ...defs, records: { ...defs.records, '99': record(99) } };
  expect(sealRequirements(node, unknown)?.seal).toEqual({ total: 2, required: undefined });
});
it('counts complete and partial triumphs separately from collections, missing data, and excluded columns', () => {
  const heading: Heading = { hash: '1', label: 'Test', name: 'Test', description: '', scope: 0, gilding: false, skip: false, order: 0, objectives: [], intervals: [] };
  const cell: Cell = { objectives: [], fraction: 0, complete: false, missing: false, text: '·', detail: '', unowned: false };
  const headings = [heading, heading, heading, heading, { ...heading, skip: true }, { ...heading, metric: 'gildingCount' as const }, { ...heading, collectibleHashes: ['10'] }];
  const cells = [{ ...cell, complete: true, fraction: 1 }, { ...cell, fraction: .5 }, cell, { ...cell, missing: true }, { ...cell, complete: true, fraction: 1 }, { ...cell, fraction: 20 }, { ...cell, complete: true, fraction: 1 }];
  expect(completionCounts(headings, cells)).toEqual({ triumphs: { total: 4, complete: 1, partial: 1, missing: 1 }, collections: { total: 1, complete: 1, partial: 0, missing: 0 } });
});
