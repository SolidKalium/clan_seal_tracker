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
  expect(result.catalog.filter(p => p.category === 'Raid seals')).toHaveLength(10);
  expect(result.catalog.filter(p => p.category === 'Activities').map(p => p.id)).toEqual(['crucible', 'iron_banner', 'gambit', 'trials', 'strikes', 'deadeye']);
  expect(result.catalog.filter(p => p.category === 'Raid seals').slice(-3).map(p => [p.id, p.sealNodeHash, p.badgeNodeHash])).toEqual([
    ['crotas_end', '238107129', '48971793'], ['salvations_edge', '334829503', '988425963'], ['the_desert_perpetual', '3954661385', '4253860097'],
  ]);
});

it('includes expansion and seasonal pages through the newer manifest content', () => {
  const pages = readJsonc(readFileSync(new URL('../pages.jsonc', import.meta.url), 'utf8'), 'js/pages.jsonc');
  const { catalog } = compile({ secret_key: 'browser-key', group_id: 1 }, pages);
  expect(catalog.filter(p => p.category === 'Expansions')).toHaveLength(10);
  expect(catalog.filter(p => p.category === 'Seasons & Episodes')).toHaveLength(25);
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
  expect(catalog.find(p => p.id === 'monument_of_triumph').seasonNumber).toBe(28);
  for (const seasonNumber of [0, -1, 1.5, '10']) {
    expect(() => compile(settings, [{ id: 'test', name: 'Test', sealNodeHash: 1, seasonNumber }])).toThrow('season number');
  }
});
