import type { Profile, Seal, Heading, Display, ObjectiveDefinition } from './types';
export type StringVariables = Record<string, number>;

// Character agreement is a fallback within this one player's data only.
function consistentCharacterVariables(profile: Profile | undefined): StringVariables {
  const values = new Map<string, number>(), conflicts = new Set<string>();
  for (const source of Object.values(profile?.characterStringVariables?.data ?? {})) {
    for (const [hash, value] of Object.entries(source.integerValuesByHash ?? {})) {
      if (!Number.isFinite(value)) continue;
      if (values.has(hash) && values.get(hash) !== value) conflicts.add(hash);
      else values.set(hash, value);
    }
  }
  return Object.fromEntries([...values].filter(([hash]) => !conflicts.has(hash)));
}
export function resolveStringVariables(text: string, values: StringVariables = {}): string {
  return text.replace(/\{var:(\d+)\}/g, (_, hash: string) => String(values[hash] ?? '?'));
}
export function playerStringVariables(profile: Profile | undefined, characterId?: string): StringVariables {
  const account = profile?.profileStringVariables?.data?.integerValuesByHash ?? {};
  const character = characterId ? profile?.characterStringVariables?.data?.[characterId]?.integerValuesByHash : undefined;
  return characterId ? { ...account, ...character }
    : { ...consistentCharacterVariables(profile), ...account };
}
export function resolveHeadingStrings(h: Heading, values: StringVariables): Heading {
  const text = (s: string) => resolveStringVariables(s, values);
  const optional = (s: string | undefined) => s === undefined ? undefined : text(s);
  const display = (d: Display): Display => ({ ...d, name: text(d.name ?? ''), description: optional(d.description) });
  const objective = (o: ObjectiveDefinition): ObjectiveDefinition => ({ ...o, progressDescription: optional(o.progressDescription), displayProperties: o.displayProperties && display(o.displayProperties) });
  return { ...h, name: text(h.name), label: text(h.label), description: text(h.description), source: optional(h.source), armorSetName: optional(h.armorSetName),
    objectives: h.objectives.map(objective), intervals: h.intervals.map(objective), perks: h.perks?.map(display) };
}
export function resolveSealStrings(seal: Seal, values: StringVariables): Seal {
  return { ...seal, title: resolveStringVariables(seal.title, values), description: resolveStringVariables(seal.description, values), headings: seal.headings.map(h => resolveHeadingStrings(h, values)) };
}
