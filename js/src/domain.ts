import type { Cell, Definitions, Heading, PageConfig, Profile, RecordProgress, Seal } from './types';

export function buildSeal(page: PageConfig, defs: Definitions): Seal {
  const node = defs.nodes[page.sealNodeHash];
  const completion = node && defs.records[String(node.completionRecordHash)];
  const base: Seal = { page, title: completion?.titleInfo?.titlesByGender ? Object.values(completion.titleInfo.titlesByGender)[0] ?? page.name : page.name, description: completion?.displayProperties.description ?? '', icon: node?.displayProperties.icon, completionHash: String(node?.completionRecordHash ?? ''), completionScope: completion?.scope ?? 0, headings: [] };
  if (!node?.children.records?.length) return { ...base, unavailable: 'This seal is not available in the current manifest.' };
  let nextOrder = 100;
  for (const { recordHash } of node.children.records) {
    const id = String(recordHash), rule = page.records[id];
    if (rule?.suppress) continue;
    const record = defs.records[id];
    if (!record || ![0, 1].includes(record.scope)) return { ...base, unavailable: 'A required record is missing or has an unsupported scope.' };
    const objectiveHashes = record.objectiveHashes ?? [];
    const intervalHashes = (record.intervalInfo?.intervalObjectives ?? []).map(i => i.intervalObjectiveHash).filter(Boolean);
    if ([...objectiveHashes, ...intervalHashes].some(hash => !defs.objectives[String(hash)])) return { ...base, unavailable: 'A required objective is missing from this manifest.' };
    base.headings.push({ hash: id, name: record.displayProperties.name, label: rule?.column_name ?? record.displayProperties.name,
      description: record.displayProperties.description ?? '', scope: record.scope, gilding: !!record.forTitleGilding,
      skip: !!rule?.skip_for_completion, order: rule?.order ?? nextOrder++,
      objectives: objectiveHashes.map(h => defs.objectives[String(h)]!), intervals: intervalHashes.map(h => defs.objectives[String(h)]!),
    });
  }
  // Match PHP's positive/default columns first and negative-order extras last.
  const group = (n: number) => n === 0 ? 0 : n > 0 ? 1 : 3;
  base.headings.sort((a, b) => group(a.order) - group(b.order) || a.order - b.order);
  return base;
}

// Mirrors PHP estimate_player_record_progress, including redeemed and zero-progress/complete records.
export function recordFraction(record: RecordProgress): number {
  if ((record.state === 0 && !record.intervalObjectives?.length) || (record.state & 1)) return 1;
  if (record.objectives?.length) return record.objectives.reduce((sum, objective) => sum + (objective.complete && objective.progress === 0 ? 1 : Math.min(1, objective.progress / Math.max(1, objective.completionValue))), 0) / record.objectives.length;
  const interval = record.intervalObjectives?.at(-1);
  return interval ? Math.min(1, (interval.progress ?? 0) / Math.max(1, interval.completionValue)) : 0;
}

export function selectRecord(profile: Profile, heading: Pick<Heading, 'hash' | 'scope'>): RecordProgress | undefined {
  if (heading.scope === 0) return profile.profileRecords?.data?.records[heading.hash];
  const candidates = Object.values(profile.characterRecords?.data ?? {}).map(c => c.records[heading.hash]).filter((r): r is RecordProgress => !!r);
  // Select one whole character's record: do not invent completion by merging characters.
  return candidates.reduce<RecordProgress | undefined>((best, next) => !best || recordFraction(next) > recordFraction(best) ? next : best, undefined);
}

export function recordCell(record: RecordProgress | undefined, heading: Heading): Cell {
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
      text: !record ? '—' : done ? '✓' : target === 1 ? '·' : `${value}/${target}`,
      fraction: done ? 1 : Math.min(1, value / Math.max(1, target)) };
  });
  const detail = objectives.map(o => `${o.name}: ${o.progress}/${o.target}${o.complete ? ' (complete)' : ''}`).join('\n');
  return { objectives, fraction, complete, missing: !record, text: !record ? '—' : complete ? '✓' : fraction > 0 ? `${Math.round(fraction * 100)}%` : '·',
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
