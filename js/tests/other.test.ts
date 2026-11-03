import { expect, it } from 'vitest';
import { buildOtherPage, otherCell } from '../src/other';
import { buildSeal } from '../src/domain';
import type { Definitions, PageConfig, Profile } from '../src/types';
const page: PageConfig = {
  id: 'other',
  name: 'Other',
  category: 'Other',
  records: {},
};
const defs: Definitions = {
  version: 'test',
  language: 'en',
  nodes: {},
  records: {},
  objectives: {},
};
it('shows the three reported rank metrics without inventing seasonal history or completion goals', () => {
  const ranks = buildOtherPage({ ...page, kind: 'ranks' }, defs)!;
  expect(ranks.headings.map((h) => h.metricKey)).toEqual([
    'currentGuardianRank',
    'renewedGuardianRank',
    'lifetimeHighestGuardianRank',
  ]);
  const p = {
    profile: {
      data: {
        currentGuardianRank: 5,
        renewedGuardianRank: 4,
        lifetimeHighestGuardianRank: 11,
      },
    },
  } as Profile;
  expect(
    ranks.headings.map((h) => otherCell(p, h, ranks.headings)?.text),
  ).toEqual(['5', '4', '11']);
  expect(ranks.headings.every((h) => h.skip && !h.objectives.length)).toBe(
    true,
  );
  expect(
    otherCell(undefined, ranks.headings[0]!, ranks.headings),
  ).toMatchObject({ text: '—', missing: true });
});
it('discovers individual rank requirements recursively from current rank definitions', () => {
  const rankDefs: Definitions = {
    ...defs,
    guardianRanks: {
      '22': {
        hash: 22,
        rankNumber: 2,
        presentationNodeHash: 10,
        displayProperties: { name: 'Explorer' },
      },
    },
    nodes: {
      '10': {
        hash: 10,
        completionRecordHash: 0,
        displayProperties: { name: 'Explorer' },
        children: { presentationNodes: [{ presentationNodeHash: 11 }] },
      },
      '11': {
        hash: 11,
        completionRecordHash: 0,
        displayProperties: { name: 'Journey' },
        children: { records: [{ recordHash: 42 }] },
      },
    },
    records: {
      '42': {
        hash: 42,
        scope: 0,
        displayProperties: { name: 'Rank requirement' },
      },
    },
  };
  expect(
    buildSeal({ ...page, guardianRank: 2 }, rankDefs, 'triumphs').headings,
  ).toMatchObject([{ hash: '42', group: 'Journey' }]);
  expect(
    buildSeal({ ...page, guardianRank: 7 }, rankDefs).unavailable,
  ).toBeTruthy();
});
it('uses commendation names/colors, includes unlisted child cards, and preserves numeric zero versus missing', () => {
  const source: Definitions = {
    ...defs,
    commendationNodes: {
      '1062358355': {
        hash: 1062358355,
        displayProperties: { name: 'Root' },
        childCommendationNodeHashes: [1],
      },
      '1': {
        hash: 1,
        displayProperties: { name: 'Ally' },
        color: { red: 54, green: 163, blue: 137, alpha: 255 },
        childCommendationHashes: [2],
      },
    },
    commendations: {
      '2': {
        hash: 2,
        parentCommendationNodeHash: 1,
        displayProperties: { name: 'Selfless' },
        displayActivities: [{ name: 'Raids' }],
      },
      '3': {
        hash: 3,
        parentCommendationNodeHash: 1,
        displayProperties: { name: 'Patient' },
      },
    },
  };
  const seal = buildOtherPage({ ...page, kind: 'commendations' }, source)!;
  expect(seal.headings.map((h) => h.name)).toEqual([
    'Total score',
    'Given',
    'Received',
    'Ally',
    'Selfless',
    'Patient',
  ]);
  expect(seal.headings[3]).toMatchObject({
    color: 'rgb(54 163 137)',
    skip: true,
  });
  expect(seal.headings[4]?.description).toContain('Raids');
  const profile: Profile = {
    profileCommendations: {
      data: {
        totalScore: 400,
        scoreDetailValues: [0, 7],
        commendationNodeScoresByHash: { '1': 12 },
        commendationNodePercentagesByHash: { '1': 25 },
        commendationScoresByHash: { '2': 0 },
      },
    },
  };
  expect(
    seal.headings.map((h) => otherCell(profile, h, seal.headings)?.text),
  ).toEqual(['400', '0', '7', '12', '0', '—']);
  expect(
    otherCell(profile, seal.headings[3]!, seal.headings)?.detail,
  ).toContain('25%');
});
it('keeps checklist false distinct from absent data and selects a whole character without merging entries', () => {
  const source: Definitions = {
    ...defs,
    checklists: {
      '10': {
        hash: 10,
        scope: 1,
        displayProperties: { name: 'Checklist' },
        entries: [1, 2, 3].map((hash) => ({
          hash,
          scope: 1,
          displayProperties: { name: String(hash) },
        })),
      },
    },
  };
  const checklist = buildOtherPage({ ...page, checklistHash: '10' }, source)!;
  const profile: Profile = {
    characterProgressions: {
      data: {
        a: { checklists: { '10': { '1': true, '2': false, '3': false } } },
        b: { checklists: { '10': { '1': false, '2': true, '3': true } } },
      },
    },
  };
  expect(
    checklist.headings.map(
      (h) => otherCell(profile, h, checklist.headings)?.text,
    ),
  ).toEqual(['·', '✓', '✓']);
  const account = { ...checklist.headings[0]!, scope: 0 };
  expect(
    otherCell(
      {
        profileProgression: { data: { checklists: { '10': { '1': false } } } },
      },
      account,
      [account],
    ),
  ).toMatchObject({ text: '·', missing: false });
  expect(otherCell(undefined, account, [account])).toMatchObject({
    text: '—',
    missing: true,
  });
});

it('keeps native collection groups separate without turning class armor into parallel badge sets', () => {
  const node = (hash: number, name: string, hashes: number[]) => ({
    hash,
    completionRecordHash: 0,
    displayProperties: { name },
    children: {
      collectibles: hashes.map((collectibleHash) => ({ collectibleHash })),
    },
  });
  const source: Definitions = {
    ...defs,
    nodes: { '10': node(10, 'Titan', [1]), '11': node(11, 'Hunter', [2]) },
    collectibles: {
      '1': {
        hash: 1,
        scope: 0,
        itemHash: 100,
        displayProperties: { name: 'Titan exotic' },
      },
      '2': {
        hash: 2,
        scope: 0,
        itemHash: 100,
        displayProperties: { name: 'Hunter exotic' },
      },
    },
    items: {
      '100': {
        displayProperties: { name: 'Helmet' },
        itemType: 2,
        itemTypeDisplayName: 'Helmet',
      },
    },
  };
  const seal = buildSeal(
    { ...page, groupByNode: true, otherNodeHashes: ['10', '11', '10'] },
    source,
    'triumphs',
  );
  expect(
    seal.headings.map((h) => [h.name, h.group, h.collectibleHashes]),
  ).toEqual([
    ['Titan exotic', 'Titan', ['1']],
    ['Hunter exotic', 'Hunter', ['2']],
  ]);
  expect(seal.headings.every((h) => !h.skip && !h.classNames?.length)).toBe(
    true,
  );
});
it('preserves pattern units when the visible group is a weapon type and distinguishes weapon mods', async () => {
  const { objectiveGoal } = await import('../src/domain');
  const source: Definitions = {
    ...defs,
    nodes: {
      '10': {
        hash: 10,
        completionRecordHash: 0,
        displayProperties: { name: 'Auto Rifles' },
        children: {
          records: [{ recordHash: 1 }],
          collectibles: [{ collectibleHash: 2 }],
        },
      },
    },
    records: {
      '1': {
        hash: 1,
        scope: 0,
        recordTypeName: 'Weapon Pattern',
        displayProperties: { name: 'New pattern' },
        objectiveHashes: [3],
      },
    },
    objectives: { '3': { hash: 3, completionValue: 5 } },
    collectibles: {
      '2': {
        hash: 2,
        scope: 0,
        itemHash: 4,
        displayProperties: { name: 'Weapon mod' },
      },
    },
    items: {
      '4': {
        displayProperties: { name: 'Weapon mod' },
        itemType: 19,
        itemTypeDisplayName: 'Weapon Mod',
        perks: [{ perkHash: 5 }],
      },
    },
    perks: {
      '5': {
        displayProperties: {
          name: 'Stability',
          description: 'Improves stability.',
        },
      },
    },
  };
  const seal = buildSeal(
    { ...page, groupByNode: true, otherNodeHashes: ['10'] },
    source,
    'triumphs',
  );
  expect(seal.headings[0]).toMatchObject({
    group: 'Auto Rifles',
    recordType: 'Weapon Pattern',
  });
  expect(objectiveGoal(seal.headings[0]!, source.objectives['3']!)).toBe(
    '5 patterns',
  );
  expect(seal.headings[1]).toMatchObject({
    group: 'Auto Rifles',
    itemType: 'Weapon Mod',
    perks: [{ name: 'Stability' }],
  });
});

it('hides catalyst insertion only from display, preserving its original objective position and completion weight', async () => {
  const { displayObjectives } = await import('../src/displayObjectives');
  const { headingCell } = await import('../src/domain');
  const source: Definitions = {
    ...defs,
    nodes: {
      '10': {
        hash: 10,
        completionRecordHash: 0,
        displayProperties: { name: 'Kinetic Weapons' },
        children: { records: [{ recordHash: 1 }] },
      },
    },
    records: {
      '1': {
        hash: 1,
        scope: 0,
        recordTypeName: 'Exotic Catalysts',
        displayProperties: { name: 'Catalyst' },
        objectiveHashes: [2, 3, 4],
      },
    },
    objectives: {
      '2': {
        hash: 2,
        completionValue: 2,
        progressDescription: 'Insert the Catalyst',
      },
      '3': { hash: 3, completionValue: 500, progressDescription: 'Kills' },
      '4': {
        hash: 4,
        completionValue: 50,
        progressDescription: 'Precision kills',
      },
    },
  };
  const heading = buildSeal(
    { ...page, otherNodeHashes: ['10'] },
    source,
    'triumphs',
  ).headings[0]!;
  expect(heading.objectives.map((o) => o.hash)).toEqual([2, 3, 4]);
  expect(
    displayObjectives(heading, heading.objectives).map(
      (o) => heading.objectives.indexOf(o) + 1,
    ),
  ).toEqual([2, 3]);
  const cell = headingCell(
    {
      profileRecords: {
        data: {
          records: {
            '1': {
              state: 4,
              objectives: [
                {
                  objectiveHash: 2,
                  progress: 0,
                  completionValue: 2,
                  complete: false,
                },
                {
                  objectiveHash: 3,
                  progress: 500,
                  completionValue: 500,
                  complete: true,
                },
                {
                  objectiveHash: 4,
                  progress: 50,
                  completionValue: 50,
                  complete: true,
                },
              ],
            },
          },
        },
      },
    },
    heading,
  );
  expect(cell.fraction).toBeCloseTo(2 / 3);
  expect(cell.complete).toBe(false);
  expect(cell.objectives).toHaveLength(3);
  expect(
    displayObjectives(heading, cell.objectives).map((o) => o.hash),
  ).toEqual(['3', '4']);
});

it('builds a standalone miscellaneous badge without a seal or an explicit badge route', () => {
  const source: Definitions = {
    ...defs,
    nodes: {
      '10': {
        hash: 10,
        completionRecordHash: 0,
        displayProperties: {
          name: 'Standalone badge',
          description: 'A collection.',
        },
        children: { presentationNodes: [{ presentationNodeHash: 11 }] },
      },
      '11': {
        hash: 11,
        completionRecordHash: 0,
        displayProperties: { name: 'Titan' },
        children: { collectibles: [{ collectibleHash: 12 }] },
      },
    },
    collectibles: {
      '12': { hash: 12, scope: 0, displayProperties: { name: 'Item' } },
    },
  };
  const badge = buildSeal(
    {
      id: 'test_badge',
      name: 'Standalone badge',
      category: 'Other badges',
      badgeNodeHash: '10',
      records: {},
    },
    source,
  );
  expect(badge.unavailable).toBeUndefined();
  expect(badge.description).toBe('A collection.');
  expect(badge.headings[0]).toMatchObject({
    collectibleHashes: ['12'],
    classNames: ['Titan'],
  });
});
