import { expect, it } from 'vitest';
import { bestBadgeClass, buildSeal, headingCell, objectiveGoal, redundantSource } from '../src/domain';
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
