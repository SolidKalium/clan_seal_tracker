import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { compile, readJsonc } from '../scripts/compile-data.mjs';
it('parses comments and trailing commas without damaging URL strings', () => {
  expect(readJsonc('{"url":"https://example.com/a//b", // comment\n"value":1,}', 'test')).toEqual({ url: 'https://example.com/a//b', value: 1 });
  expect(() => readJsonc('{"a": }', 'broken')).toThrow('broken');
});
it('compiles strict JSON with only intentionally public settings', () => {
  const ids = ['last_wish', 'garden_of_salvation', 'dsc', 'vog', 'vow', 'kings_fall', 'root_of_nightmares'];
  const pages = ids.map(id => ({ id, name: id, sealNodeHash: 123, records: {} }));
  const result = compile({ secret_key: 'browser-key', group_id: 123, private_note: 'never export', override_profile_triumph_progress: { x: 1 } }, pages);
  expect(result.config).toEqual({ apiKey: 'browser-key', clanId: '123', language: 'en' });
  expect(JSON.stringify(result)).not.toContain('private_note');
  expect(JSON.parse(JSON.stringify(result)).catalog).toHaveLength(7);
});

it('validates catalog IDs/hashes and allows only supported page and rule fields', () => {
  const settings = { secret_key: 'browser-key', group_id: 1 };
  const page = { id: 'new_raid', name: 'New raid', sealNodeHash: 123, badgeNodeHash: '456', otherNodeHashes: [789], records: { '10': { column_name: 'Raid', private_note: 'hidden' } }, private_note: 'hidden' };
  const result = compile(settings, [page]);
  expect(result.catalog[0]).toMatchObject({ id: 'new_raid', sealNodeHash: '123', badgeNodeHash: '456', otherNodeHashes: ['789'], records: { '10': { column_name: 'Raid' } } });
  expect(JSON.stringify(result)).not.toContain('private_note');
  expect(() => compile(settings, [page, page])).toThrow('duplicate');
  expect(() => compile(settings, [{ ...page, sealNodeHash: 'not-a-hash' }])).toThrow('hash');
  expect(() => compile(settings, [{ ...page, records: { '10': { order: 'first' } } }])).toThrow('rule');
});

it('loads ten raids from the independent browser catalog', () => {
  const pages = readJsonc(readFileSync(new URL('../pages.jsonc', import.meta.url), 'utf8'), 'js/pages.jsonc');
  const result = compile({ secret_key: 'browser-key', group_id: 1 }, pages);
  expect(result.catalog.filter(p => p.category === 'Raid seals' && p.sealNodeHash)).toHaveLength(10);
  expect(result.catalog.filter(p => p.category === 'Activities' && !p.parentPageId).map(p => p.id)).toEqual(['crucible', 'iron_banner', 'gambit', 'trials', 'strikes', 'deadeye']);
  expect(result.catalog.filter(p => p.category === 'Raid seals' && p.sealNodeHash).slice(-3).map(p => [p.id, p.sealNodeHash, p.badgeNodeHash])).toEqual([
    ['crotas_end', '238107129', '48971793'], ['salvations_edge', '334829503', '988425963'], ['the_desert_perpetual', '3954661385', '4253860097'],
  ]);
});

it('includes expansion and seasonal pages through the newer manifest content', () => {
  const pages = readJsonc(readFileSync(new URL('../pages.jsonc', import.meta.url), 'utf8'), 'js/pages.jsonc');
  const { catalog } = compile({ secret_key: 'browser-key', group_id: 1 }, pages);
  expect(catalog.filter(p => p.category === 'Expansions')).toHaveLength(9);
  expect(catalog.filter(p => p.category === 'Seasons & Episodes')).toHaveLength(24);
  expect(catalog.filter(p => p.id.startsWith('episode_')).map(p => [p.id, p.sealNodeHash])).toEqual([
    ['episode_echoes', '1270675696'], ['episode_revenant', '1270675697'], ['episode_heresy', '1270675698'],
  ]);
  expect(catalog.find(p => p.id === 'renegades')).toMatchObject({ sealNodeHash: '2205068290', otherNodeHashes: ['1981882108'] });
  expect(catalog.find(p => p.id === 'the_edge_of_fate')).toMatchObject({ sealNodeHash: '3588958240' });
  expect(catalog.find(p => p.id === 'monument_of_triumph')).toMatchObject({ sealNodeHash: '1210906304', otherNodeHashes: ['4024048810'] });
  expect(catalog.every(p => !Object.hasOwn(p, 'legacy'))).toBe(true);
});

it('preserves canonical season numbers independently of catalog position', () => {
  const settings = { secret_key: 'browser-key', group_id: 1 };
  const pages = readJsonc(readFileSync(new URL('../pages.jsonc', import.meta.url), 'utf8'), 'js/pages.jsonc');
  const { catalog } = compile(settings, pages);
  expect(catalog.find(p => p.id === 'season_10').seasonNumber).toBe(10);
  expect(catalog.find(p => p.id === 'episode_echoes').seasonNumber).toBe(24);
  expect(catalog.find(p => p.id === 'monument_of_triumph')).toMatchObject({ category: 'Other seals', tabLabel: 'Monument' });
  for (const seasonNumber of [0, -1, 1.5, '10']) {
    expect(() => compile(settings, [{ id: 'test', name: 'Test', sealNodeHash: 1, seasonNumber }])).toThrow('season number');
  }
});

it('groups standalone destinations and events without duplicating expansion destinations', () => {
  const pages = readJsonc(readFileSync(new URL('../pages.jsonc', import.meta.url), 'utf8'), 'catalog');
  const { catalog } = compile({ secret_key: 'key', group_id: 1 }, pages);
  expect(catalog.filter(p => p.category === 'Destinations')).toHaveLength(7);
  expect(catalog.filter(p => p.category === 'Events' && !p.parentPageId)).toHaveLength(8);
  expect(catalog.find(p => p.id === 'dreaming_city').category).toBe('Destinations');
  expect(catalog.filter(p => p.id === 'dreaming_city')).toHaveLength(1);
  expect(catalog.find(p => p.id === 'nessus').sealNodeHash).toBeUndefined();
  expect(catalog.find(p => p.id === 'festival_of_the_lost_2021').unavailableReason).toContain('removed');
  const settings = { secret_key: 'key', group_id: 1 };
  expect(() => compile(settings, [{ id: 'test', name: 'Test', category: 'Expansions', records: {} }])).toThrow('Missing seal');
  expect(compile(settings, [{ id: 'test', name: 'Test', category: 'Events', otherNodeHashes: [123], records: {} }]).catalog[0].otherNodeHashes).toEqual(['123']);
});

it('keeps historical event editions attached to their event page', () => {
  const pages = readJsonc(readFileSync(new URL('../pages.jsonc', import.meta.url), 'utf8'), 'catalog');
  const { catalog } = compile({ secret_key: 'key', group_id: 1 }, pages);
  expect(catalog.find(p => p.id === 'guardian_games_2022_medals')).toMatchObject({ parentPageId: 'guardian_games', tabLabel: '2022 medals' });
  expect(catalog.find(p => p.id === 'festival_of_the_lost_2022').otherNodeHashes).toEqual(['2330977699']);
  expect(() => compile({ secret_key: 'key', group_id: 1 }, [{ id: 'orphan', name: 'Orphan', category: 'Events', parentPageId: 'missing', tabLabel: '2021' }])).toThrow('Invalid page tab');
});

it('groups historical activity seals and Leviathan content under their parent pages', () => {
  const pages = readJsonc(readFileSync(new URL('../pages.jsonc', import.meta.url), 'utf8'), 'catalog');
  const { catalog } = compile({ secret_key: 'key', group_id: 1 }, pages);
  expect(catalog.filter(p => p.parentPageId === 'strikes').map(p => p.id)).toEqual(['conqueror_12', 'conqueror_11', 'conqueror_10', 'strikes_legacy']);
  expect(catalog.filter(p => p.parentPageId === 'trials')).toHaveLength(3);
  expect(catalog.find(p => p.id === 'unbroken')).toMatchObject({ parentPageId: 'crucible', sealNodeHash: '2107507397' });
  expect(catalog.filter(p => p.parentPageId === 'leviathan').map(p => p.id)).toEqual(['crown', 'menagerie', 'tribute_hall']);
  expect(catalog.find(p => p.id === 'scourge_of_the_past').records).toHaveProperty('2925485370');
});

it('includes dungeon seals, newer collections, and exotic mission levels with their own categories', () => {
  const pages = readJsonc(readFileSync(new URL('../pages.jsonc', import.meta.url), 'utf8'), 'catalog');
  const { catalog } = compile({ secret_key: 'key', group_id: 1 }, pages);
  expect(catalog.filter(p => p.category === 'Dungeons')).toHaveLength(11);
  expect(catalog.filter(p => p.category === 'Exotic missions' && !p.parentPageId)).toHaveLength(16);
  expect(catalog.find(p => p.id === 'equilibrium')).toMatchObject({ sealNodeHash: '1504131436', badgeNodeHash: '1208791766', otherNodeHashes: ['3851744670'] });
  expect(catalog.find(p => p.id === 'pit_of_heresy')).toMatchObject({ otherNodeHashes: ['2828966211'] });
  expect(catalog.find(p => p.id === 'presage_legacy')).toMatchObject({ parentPageId: 'presage', category: 'Exotic missions', otherNodeHashes: ['3108806378'] });
  expect(catalog.find(p => p.id === 'oblation').records).toHaveProperty('1401561385');
  for (const category of ['Dungeons', 'Exotic missions']) {
    expect(compile({ secret_key: 'key', group_id: 1 }, [{ id: 'test', name: 'Test', category, otherNodeHashes: [1], records: {} }]).catalog[0].sealNodeHash).toBeUndefined();
  }
});

it('groups ranks and chronological checklists alongside the other Other pages', () => {
  const pages = readJsonc(readFileSync(new URL('../pages.jsonc', import.meta.url), 'utf8'), 'catalog');
  const { catalog } = compile({ secret_key: 'key', group_id: 1 }, pages);
  const other = catalog.filter(p => p.category === 'Other');
  expect(other.filter(p => !p.parentPageId).map(p => p.id)).toEqual(['lifetime', 'guardian_ranks', 'checklists', 'catalysts', 'patterns', 'exotic_weapons', 'exotic_armor', 'mods']);
  expect(other.filter(p => p.guardianRank).map(p => p.guardianRank)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  expect(other.find(p => p.kind === 'commendations').parentPageId).toBe('guardian_ranks');
  const checklists = other.filter(p => p.checklistHash);
  expect(checklists).toHaveLength(22);
  expect(checklists[0].tabLabel).toBe('Region Chests');
  expect(checklists.findIndex(p => p.tabLabel === 'Lucent Moths')).toBeLessThan(checklists.findIndex(p => p.tabLabel === 'Apogee Repeaters'));
  expect(checklists.at(-1).tabLabel).toBe('Renegades Tapes');
});


it('uses current collection and pattern roots for the five additional Other pages', () => {
  const pages = readJsonc(readFileSync(new URL('../pages.jsonc', import.meta.url), 'utf8'), 'catalog');
  const { catalog } = compile({ secret_key: 'key', group_id: 1 }, pages);
  const roots = { catalysts: ['2744330515'], patterns: ['127506319', '3289524180', '1464475380'], exotic_weapons: ['2214408526'], exotic_armor: ['1789205056'], mods: ['3509235358'] };
  for (const [id, otherNodeHashes] of Object.entries(roots)) expect(catalog.find(p => p.id === id)).toMatchObject({ category: 'Other', groupByNode: true, otherNodeHashes });
  expect(() => compile({ secret_key: 'key', group_id: 1 }, [{ id: 'bad', name: 'Bad', category: 'Other', groupByNode: 'true' }])).toThrow('node grouping');
});

it('groups all Moments editions under Other seals and puts miscellaneous badges and seals in their own categories', () => {
  const pages = readJsonc(readFileSync(new URL('../pages.jsonc', import.meta.url), 'utf8'), 'catalog');
  const { catalog } = compile({ secret_key: 'key', group_id: 1 }, pages);
  expect(catalog.filter(p => p.category === 'Other badges')).toHaveLength(7);
  expect(catalog.filter(p => p.category === 'Other seals' && !p.parentPageId).map(p => p.id)).toEqual(['monument_of_triumph', 'chronicler', 'wayfarer', 'legend', 'pantheon']);
  expect(catalog.find(p => p.id === 'pantheon_godslayer')).toMatchObject({ parentPageId: 'pantheon', tabLabel: 'Godslayer' });
  expect(catalog.filter(p => p.parentPageId === 'monument_of_triumph').map(p => p.tabLabel)).toEqual(['2024', '2023', '2022', '2021', '2020', '2019']);
  expect(catalog.filter(p => p.sealNodeHash === '1210906304')).toHaveLength(1);
  expect(catalog.find(p => p.id === 'monument_of_triumph').category).toBe('Other seals');
});


it('places Lifetime first in Other with the complete current tree and section tabs', () => {
  const pages = readJsonc(readFileSync(new URL('../pages.jsonc', import.meta.url), 'utf8'), 'catalog');
  const { catalog } = compile({ secret_key: 'key', group_id: 1 }, pages);
  expect(catalog.find(p => p.category === 'Other' && !p.parentPageId)).toMatchObject({ id: 'lifetime', otherNodeHashes: ['2956802394'], groupByNode: true });
  expect(catalog.filter(p => p.parentPageId === 'lifetime').map(p => p.tabLabel)).toEqual(['New Light', 'Titan', 'Hunter', 'Warlock', 'Social', 'Cooperative', 'Competitive']);
});
