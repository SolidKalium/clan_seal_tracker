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
