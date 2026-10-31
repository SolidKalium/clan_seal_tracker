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
  if (!Array.isArray(pages) || !pages.length) throw new Error('Page catalog must be a nonempty array');
  const ids = new Set();
  const hash = (value, label) => {
    const result = String(value ?? '');
    if (!/^\d+$/.test(result) || Number(result) <= 0 || Number(result) > 0xffffffff) throw new Error(`Invalid manifest hash: ${label}`);
    return result;
  };
  const rules = (value, kind) => Object.fromEntries(Object.entries(value ?? {}).map(([key, rule]) => {
    hash(key, `${kind} rule`);
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) throw new Error(`Invalid ${kind} rule ${key}`);
    const result = {};
    for (const field of ['column_name', 'suppress', 'skip_for_completion', 'order']) if (rule[field] !== undefined) {
      const expected = field === 'column_name' ? 'string' : field === 'order' ? 'number' : 'boolean';
      if (typeof rule[field] !== expected || (field === 'order' && !Number.isFinite(rule[field]))) throw new Error(`Invalid ${kind} rule ${key}.${field}`);
      result[field] = rule[field];
    }
    return [key, result];
  }));
  const catalog = pages.map(p => {
    if (!p || typeof p.id !== 'string' || !/^[a-z0-9_]+$/.test(p.id) || ids.has(p.id) || typeof p.name !== 'string' || !p.name.trim()) throw new Error('Invalid or duplicate page');
    ids.add(p.id);
    if (p.otherNodeHashes !== undefined && !Array.isArray(p.otherNodeHashes)) throw new Error(`Invalid extra nodes for ${p.id}`);
    // Explicit allowlist: never send historical user overrides or private settings.
    if (p.category !== undefined && !['Raid seals', 'Activities', 'Expansions', 'Seasons & Episodes'].includes(p.category)) throw new Error(`Invalid page category ${p.id}`);
    return { id: p.id, name: p.name, category: p.category ?? 'Raid seals',
      sealNodeHash: hash(p.sealNodeHash, p.id), badgeNodeHash: p.badgeNodeHash === undefined ? undefined : hash(p.badgeNodeHash, p.id),
      otherNodeHashes: (p.otherNodeHashes ?? []).map(h => hash(h, p.id)),
      collectibles: rules(p.collectibles, 'collectible'), records: rules(p.records, 'record') };
  });
  return { config: { apiKey: settings.secret_key, clanId, language: 'en' }, catalog };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = new URL('../../', import.meta.url);
  const settings = readJsonc(await readFile(new URL('settings.json', root), 'utf8'), 'settings.json');
  const pages = readJsonc(await readFile(new URL('../pages.jsonc', import.meta.url), 'utf8'), 'js/pages.jsonc');
  const output = new URL('../.generated/', import.meta.url);
  await mkdir(output, { recursive: true });
  const result = compile(settings, pages);
  await Promise.all(Object.entries(result).map(([name, value]) => writeFile(new URL(`${name}.json`, output), JSON.stringify(value))));
  console.log(`Compiled browser configuration and ${result.catalog.length} tracker pages (values omitted).`);
}
