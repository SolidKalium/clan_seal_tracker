import type { Definitions } from './types';

export interface SealMembership {
  hash: string;
  name: string;
  title: string;
}
const indexes = new WeakMap<
  Definitions,
  ReadonlyMap<string, SealMembership[]>
>();

// Use title-awarding manifest nodes, including seals absent from the page catalog.
// A snapshot gets one index; a refreshed manifest naturally gets a new one.
export function sealMembershipIndex(
  defs: Definitions,
): ReadonlyMap<string, SealMembership[]> {
  const cached = indexes.get(defs);
  if (cached) return cached;
  const index = new Map<string, SealMembership[]>();
  for (const [hash, node] of Object.entries(defs.nodes)) {
    const title = Object.values(
      defs.records[String(node.completionRecordHash)]?.titleInfo
        ?.titlesByGender ?? {},
    ).find(Boolean);
    if (!title) continue;
    const seal = { hash, name: node.displayProperties.name || title, title };
    for (const recordHash of new Set(
      (node.children.records ?? []).map((r) => String(r.recordHash)),
    )) {
      if (!defs.records[recordHash]) continue;
      const memberships = index.get(recordHash) ?? [];
      memberships.push(seal);
      index.set(recordHash, memberships);
    }
  }
  for (const memberships of index.values())
    memberships.sort(
      (a, b) =>
        a.name.localeCompare(b.name) ||
        a.title.localeCompare(b.title) ||
        a.hash.localeCompare(b.hash),
    );
  indexes.set(defs, index);
  return index;
}
