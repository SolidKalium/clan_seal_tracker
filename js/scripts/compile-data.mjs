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
    if (p.category !== undefined && !['Raid seals', 'Activities', 'Expansions', 'Seasons & Episodes', 'Destinations', 'Events', 'Dungeons', 'Exotic missions', 'Other', 'Other badges', 'Other seals'].includes(p.category)) throw new Error(`Invalid page category ${p.id}`);
    if (p.category === 'Other badges' && p.badgeNodeHash === undefined) throw new Error(`Missing badge hash ${p.id}`);
    if (p.groupByNode !== undefined && (typeof p.groupByNode !== 'boolean' || p.category !== 'Other')) throw new Error(`Invalid node grouping ${p.id}`);
    if (p.kind !== undefined && (!['ranks', 'commendations', 'seals'].includes(p.kind) || p.category !== 'Other')) throw new Error(`Invalid Other view ${p.id}`);
    if (p.guardianRank !== undefined && (p.category !== 'Other' || !Number.isInteger(p.guardianRank) || p.guardianRank < 1 || p.guardianRank > 11)) throw new Error(`Invalid Guardian Rank ${p.id}`);
    if (p.seasonNumber !== undefined && (!Number.isInteger(p.seasonNumber) || p.seasonNumber < 1)) throw new Error(`Invalid season number ${p.id}`);
    if (p.sealNodeHash === undefined && !['Destinations', 'Events', 'Dungeons', 'Exotic missions', 'Other', 'Other badges', 'Activities', 'Raid seals'].includes(p.category)) throw new Error(`Missing seal hash ${p.id}`);
    if (p.unavailableReason !== undefined && (typeof p.unavailableReason !== 'string' || !p.unavailableReason.trim())) throw new Error(`Invalid unavailable reason ${p.id}`);
    if (p.tabLabel !== undefined && (typeof p.tabLabel !== 'string' || !p.tabLabel.trim())) throw new Error(`Invalid tab label ${p.id}`);
    if (p.parentPageId !== undefined && (!pages.some(parent => parent.id === p.parentPageId && parent.category === p.category && !parent.parentPageId) || typeof p.tabLabel !== 'string' || !p.tabLabel.trim())) throw new Error(`Invalid page tab ${p.id}`);
    return { groupByNode: p.groupByNode, kind: p.kind, guardianRank: p.guardianRank, checklistHash: p.checklistHash === undefined ? undefined : hash(p.checklistHash, p.id), parentPageId: p.parentPageId, tabLabel: p.tabLabel, id: p.id, name: p.name, category: p.category ?? 'Raid seals', seasonNumber: p.seasonNumber, unavailableReason: p.unavailableReason,
      sealNodeHash: p.sealNodeHash === undefined ? undefined : hash(p.sealNodeHash, p.id), badgeNodeHash: p.badgeNodeHash === undefined ? undefined : hash(p.badgeNodeHash, p.id),
      otherNodeHashes: (p.otherNodeHashes ?? []).map(h => hash(h, p.id)),
      collectibles: rules(p.collectibles, 'collectible'), records: rules(p.records, 'record') };
  });
  if (settings.oauth_client_id && !/^\d+$/.test(String(settings.oauth_client_id))) throw new Error('oauth_client_id must be numeric');
  if (settings.oauth_redirect_uri) {
    const redirect = new URL(settings.oauth_redirect_uri);
    if (!['http:', 'https:'].includes(redirect.protocol) || redirect.hash || redirect.search || redirect.username || redirect.password) throw new Error('Invalid OAuth redirect URL');
  }
  return { config: { apiKey: settings.secret_key, clanId, language: 'en', ...(settings.oauth_client_id ? { oauthClientId: String(settings.oauth_client_id) } : {}), ...(settings.oauth_redirect_uri ? { oauthRedirectUri: settings.oauth_redirect_uri } : {}) }, catalog };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const settings = readJsonc(await readFile(new URL('../settings.json', import.meta.url), 'utf8'), 'js/settings.json');
  const pages = readJsonc(await readFile(new URL('../pages.jsonc', import.meta.url), 'utf8'), 'js/pages.jsonc');
  const output = new URL('../.generated/', import.meta.url);
  await mkdir(output, { recursive: true });
  const result = compile(settings, pages);
  await Promise.all(Object.entries(result).map(async ([name, value]) => {
    const path = new URL(`${name}.json`, output);
    const contents = JSON.stringify(value);
    let previous;
    try { previous = await readFile(path, 'utf8'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (previous !== contents) await writeFile(path, contents);
  }));
  console.log(`Compiled browser configuration and ${result.catalog.length} tracker pages (values omitted).`);
}
