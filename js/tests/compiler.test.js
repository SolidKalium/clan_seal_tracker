import { expect, it } from 'vitest';
import { compile, readJsonc } from '../scripts/compile-data.mjs';
it('parses comments and trailing commas without damaging URL strings', () => {
  expect(readJsonc('{"url":"https://example.com/a//b", // comment\n"value":1,}', 'test')).toEqual({ url: 'https://example.com/a//b', value: 1 });
  expect(() => readJsonc('{"a": }', 'broken')).toThrow('broken');
});
it('compiles strict JSON with only intentionally public settings', () => {
  const ids = ['last_wish', 'garden_of_salvation', 'dsc', 'vog', 'vow', 'kings_fall', 'root_of_nightmares'];
  const pages = Object.fromEntries(ids.map(id => [id, { name: id, seal_node_hash: 123, records: {} }]));
  const result = compile({ secret_key: 'browser-key', group_id: 123, private_note: 'never export', override_profile_triumph_progress: { x: 1 } }, pages);
  expect(result.config).toEqual({ apiKey: 'browser-key', clanId: '123', language: 'en' });
  expect(JSON.stringify(result)).not.toContain('private_note');
  expect(JSON.parse(JSON.stringify(result)).catalog).toHaveLength(7);
});
