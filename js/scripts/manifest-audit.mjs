import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';

if (process.argv.length !== 3 || !['--check', '--update'].includes(process.argv[2])) throw new Error('Use --check to audit live definitions or --update to explicitly replace the fixture.');

const base = 'https://www.bungie.net';
async function json(path) {
  const response = await fetch(base + path);
  if (!response.ok) throw new Error(`Definition request failed: ${response.status} ${path}`);
  return response.json();
}
const manifest = (await json('/Platform/Destiny2/Manifest/')).Response;
const paths = manifest.jsonWorldComponentContentPaths.en;
const tables = {
  nodes: 'DestinyPresentationNodeDefinition', records: 'DestinyRecordDefinition', objectives: 'DestinyObjectiveDefinition',
  collectibles: 'DestinyCollectibleDefinition', items: 'DestinyInventoryItemLiteDefinition', guardianRanks: 'DestinyGuardianRankDefinition',
};
const fields = {
  nodes: ['hash', 'displayProperties', 'completionRecordHash', 'children'],
  records: ['hash', 'displayProperties', 'scope', 'recordTypeName', 'objectiveHashes', 'intervalInfo', 'titleInfo', 'forTitleGilding'],
  objectives: ['hash', 'completionValue', 'progressDescription'],
  collectibles: ['hash', 'displayProperties', 'scope', 'itemHash', 'sourceString'],
  items: ['displayProperties', 'itemType', 'itemTypeDisplayName'],
  guardianRanks: ['hash', 'rankNumber', 'presentationNodeHash', 'displayProperties'],
};
const snapshot = { version: manifest.version, language: 'en' };
const tokenSamplesByTable = {};
function tokenSamples(value, path, found = new Map()) {
  if (typeof value === 'string') {
    for (const match of value.matchAll(/\[[^\[\]\n]+\]/g)) if (!found.has(match[0])) found.set(match[0], { token: match[0], path });
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) tokenSamples(child, `${path}.${key}`, found);
  }
  return [...found.values()];
}
const compactTables = await Promise.all(Object.entries(tables).map(async ([key, type]) => {
  const data = await json(paths[type]);
  // Items remain necessary for catalog coverage, but their token text and perk
  // definitions are outside the current token audit scope.
  tokenSamplesByTable[key] = key === 'items' ? [] : tokenSamples(data, key);
  const compact = Object.fromEntries(Object.entries(data).map(([hash, value]) => {
    const entry = Object.fromEntries(fields[key].filter(field => value[field] !== undefined).map(field => [field, value[field]]));
    if (entry.displayProperties) entry.displayProperties = { name: entry.displayProperties.name };
    if (key === 'nodes') entry.children = Object.fromEntries(['records', 'presentationNodes', 'collectibles'].filter(field => value.children[field]?.length).map(field => [field, value.children[field].map(child => {
      const id = { records: 'recordHash', presentationNodes: 'presentationNodeHash', collectibles: 'collectibleHash' }[field];
      return { [id]: child[id] };
    })]));
    if (key === 'records' && entry.titleInfo) entry.titleInfo = Object.fromEntries(['titlesByGender', 'gildingTrackingRecordHash'].filter(field => value.titleInfo[field] !== undefined).map(field => [field, value.titleInfo[field]]));
    return [hash, entry];
  }));
  return [key, compact];
}));
Object.assign(snapshot, Object.fromEntries(compactTables));
snapshot.tokenSamples = Object.keys(tables).flatMap(key => tokenSamplesByTable[key]);
const referencedItems = new Set(Object.values(snapshot.collectibles).map(item => String(item.itemHash)));
snapshot.items = Object.fromEntries(Object.entries(snapshot.items).filter(([hash]) => referencedItems.has(hash)));
const bytes = gzipSync(JSON.stringify(snapshot), { level: 9 });
if (process.argv.includes('--check')) {
  const directory = await mkdtemp(join(tmpdir(), 'tracker-audit-'));
  try {
    const target = join(directory, 'manifest.json.gz');
    await writeFile(target, bytes);
    const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--config', 'vitest.audit.config.ts'], {
      cwd: fileURLToPath(new URL('../', import.meta.url)), stdio: 'inherit', env: { ...process.env, TRACKER_AUDIT_SNAPSHOT: target },
    });
    process.exitCode = result.status ?? 1;
  } finally { await rm(directory, { recursive: true, force: true }); }
} else {
  await writeFile(new URL('../tests/fixtures/catalog-manifest.json.gz', import.meta.url), bytes);
  console.log(`Updated pinned manifest audit fixture: ${manifest.version} (${bytes.length} compressed bytes).`);
}
