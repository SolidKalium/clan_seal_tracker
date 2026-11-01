import { sealRequirements } from './completion';
import { recordConditions } from './recordState';
import type { Cell, Definitions, Heading, PageConfig, Profile, RecordProgress, Seal } from './types';

const isDayOne = (record: Definitions['records'][string] | undefined) => !!record && /first (?:24|48) hours|contest mode|contest difficulty/i.test(record.displayProperties.description + ' ' + record.displayProperties.name);
export type PageMode = 'seal' | 'badge' | 'raid' | 'triumphs';
// Walk the manifest hierarchy rather than assuming every configured node is a leaf.
// Shared children and malformed cycles must not duplicate requirements or loop forever.
export function presentationTree(defs: Definitions, roots: string[]): Definitions['nodes'][string][] {
  const seen = new Set<string>(), result: Definitions['nodes'][string][] = [];
  function visit(hash: string) {
    if (seen.has(hash)) return;
    seen.add(hash);
    const node = defs.nodes[hash];
    if (!node) return;
    result.push(node);
    for (const child of node.children.presentationNodes ?? []) visit(String(child.presentationNodeHash));
  }
  roots.forEach(visit);
  return result;
}

export function buildSeal(page: PageConfig, defs: Definitions, mode: PageMode = 'seal'): Seal {
  const node = defs.nodes[page.sealNodeHash];
  const completion = node && defs.records[String(node.completionRecordHash)];
  const base: Seal = { page, requirements: sealRequirements(node, defs), legacy: presentationTree(defs, ['1881970629']).some(n => String(n.hash) === page.sealNodeHash), title: completion?.titleInfo?.titlesByGender ? Object.values(completion.titleInfo.titlesByGender)[0] ?? page.name : page.name, description: node?.displayProperties.description?.trim() || completion?.displayProperties.description || '', icon: node?.displayProperties.icon, completionHash: String(node?.completionRecordHash ?? ''), completionScope: completion?.scope ?? 0, headings: [] };
  if (!node?.children.records?.length) return { ...base, unavailable: 'This seal is not available in the current manifest.' };
  if (mode === 'badge') return buildBadge(page, defs, base);
  const full = mode === 'raid' || mode === 'triumphs';
  let nextOrder = 100;
  const hashes = new Set(node.children.records.map(r => String(r.recordHash)));
  const extraNodes = presentationTree(defs, page.otherNodeHashes ?? []);
  // Historical day-one achievements stay visible in either triumph view, never scored.
  for (const extra of extraNodes) for (const r of extra.children.records ?? []) if (isDayOne(defs.records[String(r.recordHash)])) hashes.add(String(r.recordHash));
  if (full) {
    for (const extra of extraNodes) for (const r of extra.children.records ?? []) hashes.add(String(r.recordHash));
    for (const hash of Object.keys(page.records)) if (defs.records[hash]) hashes.add(hash);
  }
  for (const recordHash of hashes) {
    const id = String(recordHash), rule = page.records[id];
    const record = defs.records[id];
    // Full raid pages include genuine raid records even when legacy seal views hid them.
    if (rule?.suppress && !full && !isDayOne(record)) continue;
    if (!record || ![0, 1].includes(record.scope)) return { ...base, unavailable: 'A required record is missing or has an unsupported scope.' };
    const objectiveHashes = record.objectiveHashes ?? [];
    const intervalHashes = (record.intervalInfo?.intervalObjectives ?? []).map(i => i.intervalObjectiveHash).filter(Boolean);
    if ([...objectiveHashes, ...intervalHashes].some(hash => !defs.objectives[String(hash)])) return { ...base, unavailable: 'A required objective is missing from this manifest.' };
    const description = record.displayProperties.description ?? '';
    const element = /(?:fireteam|team).*?\b(Arc|Void|Solar|Stasis|Strand|Prismatic)\b.*?subclass/i.exec(description)?.[1];
    const elementIndex = ['arc', 'void', 'solar', 'stasis', 'strand', 'prismatic'].indexOf(element?.toLowerCase() ?? '');
    const sameClass = /same (?:Guardian )?class/i.test(description);
    const dayOne = isDayOne(record);
    const badgeDisplay = defs.nodes[page.badgeNodeHash ?? '']?.displayProperties;
    const badgeRequirement = !!badgeDisplay && record.displayProperties.name === badgeDisplay.name && (description === (badgeDisplay.description ?? '') || /associated badge on the Collections screen/i.test(description));
    base.headings.push({ badgeRequirement, group: record.recordTypeName === 'Weapon Pattern' ? 'Weapon Patterns' : 'Triumphs', hash: id, name: record.displayProperties.name, label: element ? element[0]!.toUpperCase() + element.slice(1).toLowerCase() : sameClass ? 'Class' : dayOne ? (/Epic raid/i.test(description) ? 'Day one · Epic' : 'Day one') : rule?.column_name ?? record.displayProperties.name,
      description: record.displayProperties.description ?? '', scope: record.scope, gilding: !!record.forTitleGilding,
      skip: dayOne || !!rule?.skip_for_completion, order: dayOne ? -100 : elementIndex >= 0 ? 4 + elementIndex / 10 : sameClass ? 4.6 : rule?.order ?? nextOrder++,
      objectives: objectiveHashes.map(h => defs.objectives[String(h)]!), intervals: intervalHashes.map(h => defs.objectives[String(h)]!),
    });
  }
  // Match PHP's positive/default columns first and negative-order extras last.
  const group = (n: number) => n === 0 ? 0 : n > 0 ? 1 : 3;
  base.headings.sort((a, b) => group(a.order) - group(b.order) || a.order - b.order);
  if (full) {
    if (page.badgeNodeHash && mode === 'raid') {
      const badge = buildBadge(page, defs, base);
      if (badge.unavailable) return badge;
      base.headings.push(...badge.headings);
    }
    const extras = new Set(Object.keys(page.collectibles ?? {}));
    for (const extra of extraNodes) for (const c of extra.children.collectibles ?? []) extras.add(String(c.collectibleHash));
    const included = new Set(base.headings.flatMap(h => h.collectibleHashes ?? []));
    for (const hash of extras) if (!included.has(hash) && !page.collectibles?.[hash]?.suppress) {
      const heading = collectibleHeading([hash], [], defs, page.name);
      if (heading) { heading.label = page.collectibles?.[hash]?.column_name ?? heading.label; heading.skip = !!page.collectibles?.[hash]?.skip_for_completion; base.headings.push(heading); }
    }
  }
  // Keep gilding requirements together ahead of base/legacy requirements, preserving their internal order.
  base.headings.sort((a, b) => Number(b.gilding) - Number(a.gilding));
  const trackingHash = completion?.titleInfo?.gildingTrackingRecordHash;
  const tracking = defs.records[String(trackingHash)];
  if (trackingHash && tracking && [0, 1].includes(tracking.scope)) {
    // This record's objectives describe the current gilding, not the lifetime count.
    base.headings = base.headings.filter(h => h.hash !== String(trackingHash));
    base.headings.unshift({ hash: String(trackingHash), metric: 'gildingCount',
      name: 'Times gilded', label: 'Times gilded', description: 'Number of times this title has been gilded.',
      group: 'Triumphs', scope: tracking.scope, gilding: false, skip: true, order: 0, objectives: [], intervals: [] });
  }
  base.headings = groupHeadings(base.headings);
  return base;
}

// Mirrors PHP estimate_player_record_progress, including redeemed and zero-progress/complete records.
export function recordFraction(record: RecordProgress): number {
  if ((record.state === 0 && !record.intervalObjectives?.length) || (record.state & 1)) return 1;
  if (record.objectives?.length) return record.objectives.reduce((sum, objective) => sum + (objective.complete && objective.progress === 0 ? 1 : Math.min(1, objective.progress / Math.max(1, objective.completionValue))), 0) / record.objectives.length;
  const interval = record.intervalObjectives?.at(-1);
  return interval ? Math.min(1, (interval.progress ?? 0) / Math.max(1, interval.completionValue)) : 0;
}

export function selectRecord(profile: Profile, heading: Pick<Heading, 'hash' | 'scope' | 'metric'>): RecordProgress | undefined {
  if (heading.scope === 0) return profile.profileRecords?.data?.records[heading.hash];
  const candidates = Object.values(profile.characterRecords?.data ?? {}).map(c => c.records[heading.hash]).filter((r): r is RecordProgress => !!r);
  if (heading.metric === 'gildingCount') {
    return candidates.reduce<RecordProgress | undefined>((best, next) =>
      (next.completedCount ?? -1) > (best?.completedCount ?? -1) ? next : best, undefined);
  }
  // Select one whole character's record: do not invent completion by merging characters.
  return candidates.reduce<RecordProgress | undefined>((best, next) => {
    if (!best) return next;
    const difference = recordFraction(next) - recordFraction(best);
    return difference > 0 || (difference === 0 && !!(next.state & 1) && !(best.state & 1)) ? next : best;
  }, undefined);
}

export function recordCell(record: RecordProgress | undefined, heading: Heading): Cell {
  if (heading.metric === 'gildingCount') {
    const count = record?.completedCount;
    const missing = typeof count !== 'number' || !Number.isInteger(count) || count < 0;
    return { objectives: [], fraction: 0, complete: false, missing, text: missing ? '—' : String(count),
      detail: missing ? 'Gilding count unavailable.' : `${count} ${count === 1 ? 'gilding' : 'gildings'}`, unowned: false };
  }
  const fraction = record ? recordFraction(record) : 0;
  const complete = !!record && fraction >= 1;
  const definitions = heading.objectives.length ? heading.objectives : heading.intervals.slice(-1);
  const progress = heading.objectives.length ? record?.objectives : record?.intervalObjectives;
  const objectives = definitions.map(def => {
    const objective = progress?.find(o => String(o.objectiveHash) === String(def.hash));
    const target = objective?.completionValue ?? def.completionValue;
    const value = objective?.progress ?? 0;
    const done = complete || !!objective?.complete || (target > 0 && value >= target);
    return { hash: String(def.hash), name: def.progressDescription || def.displayProperties?.description || heading.name,
      progress: value, target, complete: done, missing: !record,
      text: !record ? '—' : done ? '✓' : value === 0 ? '·' : `${value}/${target}`,
      fraction: done ? 1 : Math.min(1, value / Math.max(1, target)) };
  });
  const detail = objectives.map(o => `${o.name}: ${o.progress}/${o.target}${o.complete ? ' (complete)' : ''}`).join('\n');
  const unclaimed = complete && !!record && !(record.state & 1) && !(record.state & 4);
  return { conditions: record ? recordConditions(record.state) : [], objectives, fraction, complete, unclaimed, missing: !record, text: !record ? '—' : complete ? '✓' : fraction > 0 ? `${Math.round(fraction * 100)}%` : '·',
    detail: !record ? 'No record data available' : detail || (complete ? 'Complete' : 'Incomplete'), unowned: !!(record && (record.state & 32)) };
}

export function sealAwarded(profile: Profile | undefined, seal: Seal): boolean | undefined {
  if (!profile) return undefined;
  const records = (seal.completionScope ?? 0) === 1
    ? Object.values(profile.characterRecords?.data ?? {}).map(character => character.records[seal.completionHash])
    : [profile.profileRecords?.data?.records[seal.completionHash]];
  const present = records.filter((record): record is RecordProgress => !!record);
  // A title may be redeemed on just one character, even if other records have equal objective progress.
  return present.length ? present.some(record => !!(record.state & 1) || record.state === 0) : undefined;
}

function collectibleHeading(hashes: string[], classes: string[], defs: Definitions, focus: string): Heading | undefined {
  const first = defs.collectibles?.[hashes[0]!];
  if (!first || hashes.some(h => !defs.collectibles?.[h])) return undefined;
  const variants = new Set(hashes).size > 1;
  const item = defs.items?.[String(first.itemHash)];
  const itemType = item?.itemType === 22 ? 'Sparrow' : item?.itemTypeDisplayName ?? (variants ? 'Armor' : 'Collection item');
  const group = item?.itemType === 3 || item?.itemType === 20 ? 'Weapons' : variants || item?.itemType === 2 ? 'Armor' : /mod/i.test(itemType) ? 'Armor Mods' : /emblem|shader|shell|sparrow|ship|vehicle|emote|ornament/i.test(itemType) ? 'Cosmetics' : 'Collection';
  const perks = group === 'Armor Mods' ? (item?.perks ?? []).map(p => defs.perks?.[String(p.perkHash)]?.displayProperties).filter((p): p is NonNullable<typeof p> => !!p && !!(p.name || p.description)) : undefined;
  const source = redundantSource(first.sourceString ?? '', focus) ? '' : first.sourceString;
  return { group, source, itemType: group === 'Armor Mods' ? 'Armor mod' : itemType, perks, hash: 'collectible:' + hashes.join(':'), collectibleHashes: hashes, classNames: classes,
    name: first.displayProperties.name, label: first.displayProperties.name,
    description: [source, ...hashes.map((h, i) => variants ? `${classes[i]}: ${defs.collectibles![h]!.displayProperties.name}` : '').filter(Boolean)].filter(Boolean).join('\n'),
    scope: first.scope, gilding: false, skip: false, order: 1000,
    objectives: [{ hash: first.hash, completionValue: 1, progressDescription: variants ? 'Selected class set' : first.displayProperties.name }], intervals: [] };
}
function buildBadge(page: PageConfig, defs: Definitions, base: Seal): Seal {
  const node = defs.nodes[page.badgeNodeHash ?? ''];
  const classes = (node?.children.presentationNodes ?? []).map(c => defs.nodes[String(c.presentationNodeHash)]).filter((n): n is NonNullable<typeof n> => !!n);
  if (!defs.collectibles || !classes.length) return { ...base, headings: [], unavailable: 'Badge definitions are not available. Refresh data to download them.' };
  const headings: Heading[] = [];
  const count = Math.max(...classes.map(c => c.children.collectibles?.length ?? 0));
  if (!count || classes.some(c => c.children.collectibles?.length !== count)) return { ...base, headings: [], unavailable: 'Badge class sets are incomplete in this manifest.' };
  // The badge manifest presents parallel, equally sized class sets, as in the legacy view.
  for (let i = 0; i < count; i++) {
    const hashes = classes.map(c => String(c.children.collectibles![i]!.collectibleHash));
    const h = collectibleHeading(hashes, classes.map(c => c.displayProperties.name), defs, page.name);
    if (!h) return { ...base, headings: [], unavailable: 'A required badge collectible is missing from this manifest.' };
    h.classIcons = classes.map(c => c.displayProperties.icon);
    headings.push(h);
  }
  // Parallel armor slots are listed in sets of five, including normal/Epic sets in newer raids.
  const armor = headings.filter(h => new Set(h.collectibleHashes).size > 1);
  if (armor.length && armor.length % 5 === 0 && headings.slice(-armor.length).every(h => armor.includes(h))) {
    for (let start = 0; start < armor.length; start += 5) {
      const set = armor.slice(start, start + 5);
      const words = set[0]!.name.split(/\s+/);
      let prefixLength = words.length;
      for (const h of set) {
        const next = h.name.split(/\s+/);
        while (prefixLength && words.slice(0, prefixLength).join(' ') !== next.slice(0, prefixLength).join(' ')) prefixLength--;
      }
      const setName = words.slice(0, prefixLength).join(' ') || `Armor set ${start / 5 + 1}`;
      set.forEach((h, i) => {
        h.armorSetKey = `${page.id}:${start / 5}`; h.armorSetName = setName;
        h.name = h.label = ['Helmet', 'Arms', 'Chest', 'Legs', 'Class item'][i]!;
        if (armor.length > 5) h.group = `Armor · ${setName}`;
      });
    }
  }
  return { ...base, title: page.name + ' badge', description: node?.displayProperties.description ?? '', icon: node?.displayProperties.icon, headings: groupHeadings(headings) };
}
function collectibleState(profile: Profile, hash: string): number | undefined {
  const account = profile.profileCollectibles?.data?.collectibles[hash];
  if (account) return account.state;
  const states = Object.values(profile.characterCollectibles?.data ?? {}).map(c => c.collectibles[hash]?.state).filter((s): s is number => s !== undefined);
  return states.find(s => !(s & 1)) ?? states[0];
}
export const formatClasses = (names: string[]) => new Intl.ListFormat('en', { style: 'long', type: 'conjunction' }).format(names);
export interface BadgeOwnership { completeClasses: string[]; allClasses: boolean }
export function badgeOwnership(profile: Profile | undefined, headings: Heading[]): BadgeOwnership {
  const classes = headings.find(h => h.classNames?.length)?.classNames ?? [];
  const collection = headings.filter(h => h.collectibleHashes?.length);
  const completeClasses = profile && collection.length ? classes.filter((_, i) => collection.every(h => {
    const state = collectibleState(profile, h.collectibleHashes![i] ?? h.collectibleHashes![0]!);
    return state !== undefined && !(state & 1);
  })) : [];
  return { completeClasses, allClasses: classes.length === 3 && completeClasses.length === 3 };
}
export function bestBadgeClass(profile: Profile | undefined, headings: Heading[]): number {
  if (!profile) return 0;
  const badge = headings.filter(h => (h.collectibleHashes?.length ?? 0) > 1);
  const count = Math.max(1, ...badge.map(h => h.collectibleHashes!.length));
  const scores = Array.from({ length: count }, (_, i) => badge.reduce((sum, h) => {
    const state = collectibleState(profile, h.collectibleHashes![i] ?? h.collectibleHashes![0]!);
    return sum + (state !== undefined && !(state & 1) ? 1 : 0);
  }, 0));
  return scores.indexOf(Math.max(...scores));
}
export function headingCell(profile: Profile | undefined, heading: Heading, classIndex = 0, badgeHeadings: Heading[] = [heading]): Cell {
  if (!heading.collectibleHashes) return recordCell(profile ? selectRecord(profile, heading) : undefined, heading);
  const index = Math.min(classIndex, heading.collectibleHashes.length - 1);
  const state = profile ? collectibleState(profile, heading.collectibleHashes[index]!) : undefined;
  const complete = state !== undefined && !(state & 1), missing = state === undefined;
  const name = new Set(heading.collectibleHashes).size === 1 ? 'Shared collection' : heading.classNames?.[index] ? heading.classNames[index] + ' set' : heading.name;
  const text = missing ? '—' : complete ? '✓' : '·';
  const variants = new Set(heading.collectibleHashes).size > 1 ? heading.collectibleHashes.map((hash, i) => {
    const state = profile ? collectibleState(profile, hash) : undefined;
    const armor = badgeHeadings.filter(h => new Set(h.collectibleHashes).size > 1 && h.armorSetKey === heading.armorSetKey);
    const setStates = armor.map(h => profile ? collectibleState(profile, h.collectibleHashes![i]!) : undefined);
    return { icon: heading.classIcons?.[i], name: heading.classNames?.[i] ?? `Class ${i + 1}`, complete: state !== undefined && !(state & 1), missing: state === undefined,
      setComplete: setStates.length > 0 && setStates.every(s => s !== undefined && !(s & 1)), setMissing: setStates.some(s => s === undefined) };
  }) : undefined;
  return { variants, fraction: complete ? 1 : 0, complete, missing, text, detail: name, unowned: false,
    objectives: [{ hash: heading.hash, name, progress: complete ? 1 : 0, target: 1, complete, missing, text, fraction: complete ? 1 : 0 }] };
}

const GROUP_ORDER = ['Triumphs', 'Weapons', 'Weapon Patterns', 'Armor', 'Armor Mods', 'Cosmetics', 'Collection'];
function groupHeadings(headings: Heading[]): Heading[] {
  const order = (h: Heading) => GROUP_ORDER.indexOf(h.group?.startsWith('Armor · ') ? 'Armor' : h.group ?? 'Triumphs');
  return [...headings].sort((a, b) => order(a) - order(b));
}
export function redundantSource(source: string, focus: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const text = normalize(source.replace(/^source:\s*/i, ''));
  const activity = normalize(focus);
  return !!activity && (text === activity || text === activity + ' raid' || text === 'raid ' + activity);
}
export function objectiveUnit(heading: Heading, description: string, count: number): string {
  if (heading.group === 'Weapon Patterns') return count === 1 ? 'pattern' : 'patterns';
  const explicit = /\b(kills|chests|encounters|logs|wishes|banners|extractions|completions)\b/i.exec(description)?.[1]?.toLowerCase();
  const unit = explicit ?? (/combatants defeated|enemies defeated|final blows/i.test(description) ? 'kills' : '');
  if (!unit || count !== 1) return unit;
  return ({ kills: 'kill', chests: 'chest', encounters: 'encounter', logs: 'log', wishes: 'wish', banners: 'banner', extractions: 'extraction', completions: 'completion' } as Record<string, string>)[unit] ?? unit;
}
export function objectiveGoal(heading: Heading, objective: { completionValue: number; progressDescription?: string }): string {
  if (heading.badgeRequirement) return 'Acquire badge';
  if (heading.collectibleHashes) return 'Acquire';
  const count = objective.completionValue;
  const unit = objectiveUnit(heading, objective.progressDescription ?? '', count);
  if (unit) return `${count} ${unit}`;
  return count === 1 ? 'At least once' : `${count} required`;
}
