import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parse, printParseErrorCode } from 'jsonc-parser';

export function readJsonc(text, name) {
  const errors = [];
  const value = parse(text, errors, { allowTrailingComma: true });
  if (errors.length) throw new Error(`${name}: ${errors.map(e => `${printParseErrorCode(e.error)} at ${e.offset}`).join(', ')}`);
  return value;
}
export function compile(settings, pages) {
  if (typeof settings.secret_key !== 'string' || !settings.secret_key.trim()) throw new Error('settings.json needs secret_key');
  const clanId = String(settings.group_id ?? '');
  if (!/^\d+$/.test(clanId)) throw new Error('settings.json needs a numeric group_id');
  const initial = ['last_wish', 'garden_of_salvation', 'dsc', 'vog', 'vow', 'kings_fall', 'root_of_nightmares'];
  const catalog = initial.map(id => {
    const p = pages[id];
    if (!p || typeof p.name !== 'string' || !Number.isInteger(p.seal_node_hash)) throw new Error(`Invalid page ${id}`);
    // Explicit allowlist: no historical overrides, unrelated page modes, or settings.
    return { id, name: p.name, category: 'Raid seals', sealNodeHash: String(p.seal_node_hash), records: p.records ?? {} };
  });
  return { config: { apiKey: settings.secret_key, clanId, language: 'en' }, catalog };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = new URL('../../', import.meta.url);
  const settings = readJsonc(await readFile(new URL('settings.json', root), 'utf8'), 'settings.json');
  const pages = readJsonc(await readFile(new URL('pages.json', root), 'utf8'), 'pages.json');
  const output = new URL('../.generated/', import.meta.url);
  await mkdir(output, { recursive: true });
  const result = compile(settings, pages);
  await Promise.all(Object.entries(result).map(([name, value]) => writeFile(new URL(`${name}.json`, output), JSON.stringify(value))));
  console.log(`Compiled browser configuration and ${result.catalog.length} seal pages (values omitted).`);
}
