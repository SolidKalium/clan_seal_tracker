import type { Definitions, Heading } from './types';

// Duplicate collection entries can reference the very same item. Keep their
// ownership flags as alternatives, not parallel class slots or extra goals.
export function mergeExoticWeaponVersions(
  headings: Heading[],
  defs: Definitions,
): Heading[] {
  const patterns = new Map<string, { hash: string; scope: number }[]>();
  for (const [hash, record] of Object.entries(defs.records)) {
    if (record.recordTypeName !== 'Weapon Pattern') continue;
    const name = record.displayProperties.name;
    patterns.set(name, [
      ...(patterns.get(name) ?? []),
      { hash, scope: record.scope },
    ]);
  }
  const byItem = new Map<number, Heading>(),
    result: Heading[] = [];
  for (const heading of headings) {
    const itemHash =
      defs.collectibles?.[heading.collectibleHashes?.[0] ?? '']?.itemHash;
    if (!itemHash || defs.items?.[String(itemHash)]?.itemType !== 3) {
      result.push(heading);
      continue;
    }
    const previous = byItem.get(itemHash);
    if (previous) {
      previous.alternativeCollectibleHashes = [
        ...new Set([
          ...(previous.alternativeCollectibleHashes ??
            previous.collectibleHashes ??
            []),
          ...(heading.collectibleHashes ?? []),
        ]),
      ];
    } else {
      const matches = patterns.get(heading.name);
      const merged = {
        ...heading,
        pattern: matches?.length === 1 ? matches[0] : undefined,
      };
      byItem.set(itemHash, merged);
      result.push(merged);
    }
  }
  return result;
}
