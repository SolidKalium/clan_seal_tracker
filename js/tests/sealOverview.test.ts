import { expect, it } from 'vitest';
import { buildSeal, headingCell } from '../src/domain';
import type { Definitions, PageConfig, Profile } from '../src/types';
const page: PageConfig = {
  id: 'seal_overview',
  name: 'Seal overview',
  category: 'Other',
  kind: 'seals',
  records: {},
};
const node = (
  hash: number,
  name: string,
  completionRecordHash: number,
  children: object = {},
) => ({ hash, displayProperties: { name }, completionRecordHash, children });
const defs: Definitions = {
  version: 'test',
  language: 'en',
  nodes: {
    '616318467': node(616318467, 'Titles', 0, {
      presentationNodes: [
        { presentationNodeHash: 1 },
        { presentationNodeHash: 2 },
        { presentationNodeHash: 3 },
      ],
    }),
    '1': node(1, 'Raid', 10, {
      presentationNodes: [{ presentationNodeHash: 616318467 }],
    }),
    '2': node(2, 'Same seal referenced twice', 10),
    '3': node(3, 'Redacted', 30),
    '1881970629': node(1881970629, 'Legacy Titles', 0, {
      presentationNodes: [{ presentationNodeHash: 4 }],
    }),
    '4': node(4, 'Old raid', 40),
  },
  records: {
    '10': {
      hash: 10,
      scope: 0,
      displayProperties: { name: 'Complete raid seal' },
      titleInfo: {
        titlesByGender: { Male: 'Raider' },
        gildingTrackingRecordHash: 11,
      },
      objectiveHashes: [100],
    },
    '11': { hash: 11, scope: 1, displayProperties: { name: 'Gilding' } },
    '30': { hash: 30, scope: 0, displayProperties: { name: 'Hidden' } },
    '40': {
      hash: 40,
      scope: 0,
      displayProperties: { name: 'Complete legacy seal' },
      titleInfo: { titlesByGender: { Male: 'Old Raider' } },
    },
  },
  objectives: {
    '100': {
      hash: 100,
      completionValue: 5,
      progressDescription: 'Triumphs completed',
    },
  },
};
it('discovers current and legacy seal completion records without requiring individual page configuration', () => {
  const current = buildSeal(page, defs);
  expect(current.headings.map((h) => h.label)).toEqual(['Raider']);
  expect(current.headings[0]?.objectives[0]?.completionValue).toBe(5);
  expect(current.headings[0]?.sealSummary?.nodeHash).toBe('1');
  const legacy = buildSeal({ ...page, id: 'seal_overview_legacy' }, defs);
  expect(legacy.headings.map((h) => h.label)).toEqual(['Old Raider']);
  expect(legacy.headings[0]?.sealSummary?.legacy).toBe(true);
});
it('uses completion-record progress and keeps lifetime gilding separate from completion', () => {
  const heading = buildSeal(page, defs).headings[0]!;
  const profile: Profile = {
    profileRecords: {
      data: {
        records: {
          '10': {
            state: 4,
            objectives: [
              {
                objectiveHash: 100,
                completionValue: 5,
                progress: 2,
                complete: false,
              },
            ],
          },
        },
      },
    },
    characterRecords: {
      data: {
        a: { records: { '11': { state: 1, completedCount: 2 } } },
        b: { records: { '11': { state: 1, completedCount: 5 } } },
      },
    },
  };
  expect(headingCell(profile, heading)).toMatchObject({
    fraction: 0.4,
    complete: false,
    sealGildings: 5,
  });
  expect(headingCell(undefined, heading)).toMatchObject({ missing: true });
});
