import { expect, it } from 'vitest';
import { bestBadgeClass, badgeOwnership, buildSeal, headingCell, objectiveGoal, redundantSource } from '../src/domain';
import type { Definitions, PageConfig, Profile } from '../src/types';
const page: PageConfig = { id: 'test', name: 'Test raid', category: 'Raids', sealNodeHash: '1', badgeNodeHash: '2', otherNodeHashes: ['3'], records: { '15': { suppress: true } } };
const record = (hash: number, description: string) => ({ hash, scope: 0, displayProperties: { name: `Triumph ${hash}`, description }, objectiveHashes: [100] });
const defs: Definitions = { version: '1', language: 'en', objectives: { '100': { hash: 100, completionValue: 1 } },
  nodes: {
    '1': { hash: 1, completionRecordHash: 99, displayProperties: { name: 'Seal' }, children: { records: [14, 12, 11, 13].map(recordHash => ({ recordHash })) } },
    '2': { hash: 2, completionRecordHash: 98, displayProperties: { name: 'Badge' }, children: { presentationNodes: [4, 5].map(presentationNodeHash => ({ presentationNodeHash })) } },
    '3': { hash: 3, completionRecordHash: 0, displayProperties: { name: 'Raid' }, children: { records: [16, 15, 11].map(recordHash => ({ recordHash })) } },
    '4': { hash: 4, completionRecordHash: 0, displayProperties: { name: 'Titan' }, children: { collectibles: [200, 201, 202].map(collectibleHash => ({ collectibleHash })) } },
    '5': { hash: 5, completionRecordHash: 0, displayProperties: { name: 'Hunter' }, children: { collectibles: [200, 203, 204].map(collectibleHash => ({ collectibleHash })) } },
  },
  records: { '11': record(11, 'Complete with a fireteam made entirely of Arc subclasses.'), '12': record(12, 'Complete with a fireteam made entirely of Void subclasses.'), '13': record(13, 'Complete with a fireteam made entirely of Solar subclasses.'), '14': record(14, 'Complete with a fireteam made entirely of Stasis subclasses.'), '15': record(15, 'Complete within the first 24 hours of release.'), '16': record(16, 'Complete with a fireteam made entirely of Strand subclasses.') },
  items: { '300': { displayProperties: { name: 'Weapon' }, itemType: 3, itemTypeDisplayName: 'Scout Rifle' }, '301': { displayProperties: { name: 'Armor' }, itemType: 2, itemTypeDisplayName: 'Helmet' } },
  perks: {},
  collectibles: Object.fromEntries([200, 201, 202, 203, 204].map(hash => [hash, { hash, scope: 1, itemHash: hash === 200 ? 300 : 301, displayProperties: { name: `Item ${hash}` } }])),
};
it('normalizes elements independently of API order, with Strand only in the full raid', () => {
  const seal = buildSeal(page, defs), raid = buildSeal(page, defs, 'raid');
  expect(seal.headings.filter(h => !h.skip).map(h => h.label)).toEqual(['Arc', 'Void', 'Solar', 'Stasis']);
  expect(raid.headings.filter(h => ['Arc', 'Void', 'Solar', 'Stasis', 'Strand'].includes(h.label)).map(h => h.label)).toEqual(['Arc', 'Void', 'Solar', 'Stasis', 'Strand']);
  expect(raid.headings.filter(h => h.hash === '11')).toHaveLength(1);
  for (const view of [seal, raid]) expect(view.headings.find(h => h.hash === '15')).toMatchObject({ label: 'Day one', skip: true });
});
it('scores one whole class set, never combining armor across classes', () => {
  const badge = buildSeal(page, defs, 'badge');
  expect(badge.headings).toHaveLength(3);
  const profile: Profile = { profileCollectibles: { data: { collectibles: { '200': { state: 0 }, '201': { state: 0 }, '202': { state: 1 }, '203': { state: 1 }, '204': { state: 0 } } } } };
  const piece = headingCell(profile, badge.headings[1]!, 0, badge.headings);
  expect(piece.variants).toEqual([
    { name: 'Titan', complete: true, missing: false, setComplete: false, setMissing: false },
    { name: 'Hunter', complete: false, missing: false, setComplete: false, setMissing: false },
  ]);
  const best = bestBadgeClass(profile, badge.headings);
  const cells = badge.headings.map(h => headingCell(profile, h, best));
  expect(cells.reduce((sum, c) => sum + c.fraction, 0)).toBe(2);
  expect(cells.every(c => c.complete)).toBe(false);
  profile.profileCollectibles!.data!.collectibles['203'] = { state: 0 };
  expect(bestBadgeClass(profile, badge.headings)).toBe(1);
  expect(headingCell(profile, badge.headings[1]!, 0, badge.headings).variants?.[1]).toMatchObject({ complete: true, setComplete: true });
  expect(badge.headings.map(h => headingCell(profile, h, 1)).every(c => c.complete)).toBe(true);
});
it('keeps missing or private collection data distinct from uncollected items', () => {
  const h = buildSeal(page, defs, 'badge').headings[0]!;
  expect(headingCell({}, h)).toMatchObject({ missing: true, complete: false, text: '—' });
  expect(headingCell({ characterCollectibles: { data: { x: { collectibles: { '200': { state: 1 } } } } } }, h)).toMatchObject({ missing: false, complete: false, text: '·' });
});

it('groups collection types and exposes mod perks without repeating the page source', () => {
  const extended: Definitions = { ...defs, collectibles: { ...defs.collectibles,
    '205': { hash: 205, scope: 0, itemHash: 302, displayProperties: { name: 'Augment mod' }, sourceString: 'Source: Test raid' },
    '206': { hash: 206, scope: 0, itemHash: 303, displayProperties: { name: 'Shader' }, sourceString: 'Source: A different activity' },
  }, items: { ...defs.items,
    '302': { displayProperties: { name: 'Augment mod' }, itemType: 19, itemTypeDisplayName: 'Raid Mod', perks: [{ perkHash: 400 }] },
    '303': { displayProperties: { name: 'Shader' }, itemTypeDisplayName: 'Shader' },
  }, perks: { '400': { displayProperties: { name: 'Augmentation', description: 'Improves the augment.' } } } };
  const raid = buildSeal({ ...page, collectibles: { '205': {}, '206': {} } }, extended, 'raid');
  expect(raid.headings.find(h => h.collectibleHashes?.includes('200'))).toMatchObject({ group: 'Weapons', itemType: 'Scout Rifle' });
  expect(raid.headings.find(h => h.collectibleHashes?.includes('205'))).toMatchObject({ group: 'Armor Mods', itemType: 'Armor mod', source: '', perks: [{ name: 'Augmentation', description: 'Improves the augment.' }] });
  expect(raid.headings.find(h => h.collectibleHashes?.includes('206'))).toMatchObject({ group: 'Cosmetics', itemType: 'Shader', source: 'Source: A different activity' });
  expect(redundantSource('Source: "Deep Stone Crypt" Raid', 'Deep Stone Crypt')).toBe(true);
  expect(redundantSource('Source: Complete a special challenge in Last Wish', 'Last Wish')).toBe(false);
});
it('uses acquisition and objective units without guessing unspecified units', () => {
  const h = buildSeal(page, defs).headings[0]!;
  expect(objectiveGoal({ ...h, collectibleHashes: ['200'] }, { completionValue: 1 })).toBe('Acquire');
  expect(objectiveGoal({ ...h, group: 'Weapon Patterns' }, { completionValue: 5 })).toBe('5 patterns');
  expect(objectiveGoal(h, { completionValue: 100, progressDescription: 'Kills' })).toBe('100 kills');
  expect(objectiveGoal(h, { completionValue: 1 })).toBe('At least once');
  expect(objectiveGoal(h, { completionValue: 4 })).toBe('4 required');
});

it('normalizes Prismatic after the other elements and before same-class requirements', () => {
  const extended: Definitions = { ...defs, records: { ...defs.records,
    '17': record(17, 'Complete with a full fireteam of Prismatic subclasses.'),
    '18': record(18, 'Complete with a full fireteam of the same Guardian class.'),
  }, nodes: { ...defs.nodes, '3': { ...defs.nodes['3']!, children: { records: [18, 17, 16, 15].map(recordHash => ({ recordHash })) } } } };
  const raid = buildSeal(page, extended, 'raid');
  expect(raid.headings.filter(h => ['Arc', 'Void', 'Solar', 'Stasis', 'Strand', 'Prismatic', 'Class'].includes(h.label)).map(h => h.label)).toEqual(['Arc', 'Void', 'Solar', 'Stasis', 'Strand', 'Prismatic', 'Class']);
});
it('keeps two armor sets separate in headings and tooltip set-completion status', () => {
  const titan = Array.from({ length: 10 }, (_, i) => 1000 + i), hunter = titan.map(h => h + 1000);
  const extended: Definitions = { ...defs, nodes: { ...defs.nodes,
    '4': { ...defs.nodes['4']!, children: { collectibles: [200, ...titan].map(collectibleHash => ({ collectibleHash })) } },
    '5': { ...defs.nodes['5']!, children: { collectibles: [200, ...hunter].map(collectibleHash => ({ collectibleHash })) } },
  }, collectibles: { ...defs.collectibles, ...Object.fromEntries([...titan, ...hunter].map(hash => [hash, { hash, scope: 1, itemHash: 301, displayProperties: { name: `${hash % 10 < 5 ? 'Collective Psyche' : 'Wayward Psyche'} ${['Helm', 'Arms', 'Chest', 'Legs', 'Mark'][hash % 5]}` } }])) } };
  const badge = buildSeal(page, extended, 'badge');
  const first = badge.headings.filter(h => h.armorSetName === 'Collective Psyche'), second = badge.headings.filter(h => h.armorSetName === 'Wayward Psyche');
  expect(first.map(h => h.label)).toEqual(['Helmet', 'Arms', 'Chest', 'Legs', 'Class item']);
  expect(second.map(h => h.label)).toEqual(['Helmet', 'Arms', 'Chest', 'Legs', 'Class item']);
  expect(first.every(h => h.group === 'Armor · Collective Psyche')).toBe(true);
  const profile: Profile = { profileCollectibles: { data: { collectibles: Object.fromEntries([200, ...titan, ...hunter].map(hash => [hash, { state: hash < 1005 ? 0 : 1 }])) } } };
  expect(headingCell(profile, first[0]!, 0, badge.headings).variants?.[0]).toMatchObject({ complete: true, setComplete: true });
  expect(headingCell(profile, second[0]!, 0, badge.headings).variants?.[0]).toMatchObject({ complete: false, setComplete: false });
});

it('builds activity triumphs without requiring a badge or mixing its collection into the percentage', () => {
  const activity = { ...page, category: 'Activities', badgeNodeHash: undefined };
  const view = buildSeal(activity, defs, 'triumphs');
  expect(view.unavailable).toBeUndefined();
  expect(view.headings.some(h => h.label === 'Strand')).toBe(true);
  expect(view.headings.every(h => !h.collectibleHashes)).toBe(true);
  expect(buildSeal({ ...activity, badgeNodeHash: page.badgeNodeHash }, defs, 'triumphs').headings.every(h => !h.collectibleHashes)).toBe(true);
});

it('walks nested expansion and episode sections, deduplicating shared records and cycles', () => {
  const expanded: Definitions = { ...defs, nodes: { ...defs.nodes,
    '3': { ...defs.nodes['3']!, children: { presentationNodes: [{ presentationNodeHash: 6 }, { presentationNodeHash: 7 }] } },
    '6': { ...defs.nodes['3']!, hash: 6, children: { records: [{ recordHash: 16 }], presentationNodes: [{ presentationNodeHash: 7 }] } },
    '7': { ...defs.nodes['3']!, hash: 7, children: { records: [{ recordHash: 16 }, { recordHash: 15 }], presentationNodes: [{ presentationNodeHash: 3 }] } },
  } };
  for (const category of ['Expansions', 'Seasons & Episodes']) {
    const config = { ...page, category };
    const full = buildSeal(config, expanded, 'triumphs');
    expect(full.unavailable).toBeUndefined();
    expect(full.headings.filter(h => h.hash === '16')).toHaveLength(1);
    expect(full.headings.find(h => h.hash === '15')).toMatchObject({ skip: true });
    expect(full.headings.every(h => !h.collectibleHashes)).toBe(true);
    expect(buildSeal(config, expanded).headings.some(h => h.hash === '16')).toBe(false);
    expect(buildSeal(config, expanded, 'badge').headings.some(h => h.collectibleHashes)).toBe(true);
  }
});

it('takes legacy status from the official Legacy Titles tree rather than the page category', () => {
  const root = { ...defs.nodes['3']!, hash: 1881970629, children: { presentationNodes: [{ presentationNodeHash: 8 }] } };
  const legacyDefs: Definitions = { ...defs, nodes: { ...defs.nodes,
    '1881970629': root,
    '8': { ...defs.nodes['3']!, hash: 8, children: { presentationNodes: [{ presentationNodeHash: 1 }] } },
  } };
  expect(buildSeal({ ...page, category: 'Seasons & Episodes' }, defs).legacy).toBe(false);
  expect(buildSeal({ ...page, category: 'Expansions' }, legacyDefs).legacy).toBe(true);
});

it('prefers the seal node description and falls back when it is blank', () => {
  const recordDescription = 'Complete all of the Triumphs for Renegades.';
  const nodeDescription = 'Complete all of the Triumphs for Invasions in Renegades.';
  const completion = record(99, recordDescription);
  for (const description of [nodeDescription, '', '   ', undefined]) {
    const source: Definitions = { ...defs, records: { ...defs.records, '99': completion }, nodes: { ...defs.nodes,
      '1': { ...defs.nodes['1']!, displayProperties: { name: 'Undertaker', description } },
    } };
    expect(buildSeal(page, source).description).toBe(description?.trim() || recordDescription);
  }
});

it('adds one unscored lifetime gilding count using the completion record tracking hash', () => {
  const source: Definitions = { ...defs, records: { ...defs.records,
    '99': { ...record(99, 'Seal'), titleInfo: { gildingTrackingRecordHash: 90 } },
    '90': record(90, 'Current gilding requirements'),
  }, nodes: { ...defs.nodes,
    '3': { ...defs.nodes['3']!, children: { records: [...defs.nodes['3']!.children.records!, { recordHash: 90 }] } },
  } };
  for (const mode of ['seal', 'triumphs'] as const) {
    const seal = buildSeal(page, source, mode);
    const metric = seal.headings.filter(h => h.metric);
    expect(metric).toHaveLength(1);
    expect(metric[0]).toMatchObject({ hash: '90', label: 'Times gilded', skip: true, gilding: false, objectives: [], intervals: [] });
    expect(seal.headings.filter(h => !h.skip).map(h => h.hash)).not.toContain('90');
  }
  expect(buildSeal(page, source, 'badge').headings.some(h => h.metric)).toBe(false);
  expect(buildSeal(page, defs).headings.some(h => h.metric)).toBe(false);
});

it('badge ownership requires a whole class collection and distinguishes all three classes', () => {
  const shared = { ...buildSeal(page, defs, 'badge').headings[0]!, classNames: ['Titan', 'Hunter', 'Warlock'], collectibleHashes: ['200', '200', '200'] };
  const headings = [shared, { ...shared, collectibleHashes: ['201', '203', '205'] }, { ...shared, collectibleHashes: ['202', '204', '206'] }];
  const profile = (owned: number[], absent: number[] = []): Profile => ({ profileCollectibles: { data: { collectibles: Object.fromEntries([200, 201, 202, 203, 204, 205, 206].filter(h => !absent.includes(h)).map(h => [h, { state: owned.includes(h) ? 0 : 1 }])) } } });
  expect(badgeOwnership(profile([200, 201, 202]), headings)).toEqual({ completeClasses: ['Titan'], allClasses: false });
  expect(badgeOwnership(profile([200, 201, 202, 203, 204, 205, 206]), headings)).toEqual({ completeClasses: ['Titan', 'Hunter', 'Warlock'], allClasses: true });
  expect(badgeOwnership(profile([200, 201, 203, 206]), headings)).toEqual({ completeClasses: [], allClasses: false });
  expect(badgeOwnership(profile([200, 201, 202, 203, 204, 206], [205]), headings)).toEqual({ completeClasses: ['Titan', 'Hunter'], allClasses: false });
  expect(badgeOwnership(undefined, headings)).toEqual({ completeClasses: [], allClasses: false });
});

it('places gilding requirements immediately after Times gilded while preserving order within each set', () => {
  const source: Definitions = { ...defs, records: { ...defs.records,
    '99': { ...record(99, 'Seal'), titleInfo: { gildingTrackingRecordHash: 90 } },
    '90': record(90, 'Tracking'),
    '12': { ...defs.records['12']!, forTitleGilding: true },
    '14': { ...defs.records['14']!, forTitleGilding: true },
  } };
  for (const mode of ['seal', 'triumphs'] as const) {
    const headings = buildSeal(page, source, mode).headings;
    expect(headings.slice(0, 3).map(h => h.hash)).toEqual(['90', '12', '14']);
    expect(headings.filter(h => !h.metric && !h.gilding).slice(0, 2).map(h => h.hash)).toEqual(['11', '13']);
  }
});

it('explains a white owned armor cell using the scored class and its actual armor percentage', () => {
  const base = buildSeal(page, defs, 'badge').headings[0]!;
  const headings = Array.from({ length: 5 }, (_, i) => ({ ...base, armorSetKey: 'set', classNames: ['Titan', 'Hunter', 'Warlock'], collectibleHashes: [String(201 + i), String(301 + i), String(401 + i)] }));
  const profile: Profile = { profileCollectibles: { data: { collectibles: Object.fromEntries(headings.flatMap(h => h.collectibleHashes).map(h => [h, { state: Number(h) > 301 && Number(h) <= 305 || h === '401' ? 0 : 1 }])) } } };
  const index = bestBadgeClass(profile, headings);
  expect(index).toBe(1);
  const cell = headingCell(profile, headings[0]!, index, headings, 'best');
  expect(cell).toMatchObject({ complete: false, missing: false, scoringClass: { name: 'Hunter', best: true, armorFraction: .8 } });
  expect(cell.variants?.filter(v => v.complete).map(v => v.name)).toEqual(['Warlock']);
  expect(headingCell(profile, headings[0]!, 0, headings, 'selected').scoringClass).toMatchObject({ name: 'Titan', best: false, armorFraction: 0 });
  delete profile.profileCollectibles!.data!.collectibles['305'];
  expect(headingCell(profile, headings[0]!, index, headings, 'best').scoringClass?.armorFraction).toBeUndefined();
});
