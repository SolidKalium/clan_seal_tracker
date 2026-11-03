import { buildSeal, presentationTree, type PageMode } from './domain';
import type { Definitions, PageConfig } from './types';

// Use the Triumphs branch, not its umbrella parent (which also contains Lore
// and Medals). Include separate rank, crafting, and active/legacy seal trees.
export const COVERAGE_ROOTS = {
  triumphs: [
    '1866538467',
    '3215903653',
    '2642502414',
    '3741753466',
    '616318467',
    '1881970629',
  ],
  seals: ['616318467', '1881970629'],
  badges: ['498211331'],
};
export interface CoverageGap {
  hash: string;
  name: string;
  paths: string[];
}
export function catalogCoverage(
  defs: Definitions,
  pages: PageConfig[],
  roots = COVERAGE_ROOTS,
) {
  const expected = new Map<string, CoverageGap>();
  function visit(hash: string, path: string[], seen: Set<string>) {
    if (seen.has(hash)) return;
    const node = defs.nodes[hash];
    if (!node)
      throw new Error(`Coverage root or child node is missing: ${hash}`);
    const trail = [...path, node.displayProperties.name || hash];
    for (const child of node.children.records ?? []) {
      const id = String(child.recordHash),
        record = defs.records[id];
      if (!record) throw new Error(`Coverage record is missing: ${id}`);
      const gap = expected.get(id) ?? {
        hash: id,
        name: record.displayProperties.name,
        paths: [],
      };
      const name = trail.join(' / ');
      if (!gap.paths.includes(name)) gap.paths.push(name);
      expected.set(id, gap);
    }
    const next = new Set([...seen, hash]);
    for (const child of node.children.presentationNodes ?? [])
      visit(String(child.presentationNodeHash), trail, next);
  }
  roots.triumphs.forEach((root) => visit(root, [], new Set()));
  const expectedSeals = new Map<string, CoverageGap>();
  for (const node of presentationTree(defs, roots.seals)) {
    const title =
      defs.records[String(node.completionRecordHash)]?.titleInfo
        ?.titlesByGender;
    if (title && Object.values(title).some(Boolean))
      expectedSeals.set(String(node.hash), {
        hash: String(node.hash),
        name: node.displayProperties.name,
        paths: [],
      });
  }
  const expectedBadges = new Map<string, CoverageGap>();
  for (const root of roots.badges) {
    if (!defs.nodes[root])
      throw new Error(`Badge coverage root is missing: ${root}`);
    for (const child of defs.nodes[root]!.children.presentationNodes ?? []) {
      const id = String(child.presentationNodeHash),
        node = defs.nodes[id];
      if (!node) throw new Error(`Badge definition is missing: ${id}`);
      expectedBadges.set(id, {
        hash: id,
        name: node.displayProperties.name,
        paths: [],
      });
    }
  }
  const records = new Set<string>(),
    badges = new Set<string>(),
    seals = new Set<string>();
  const unavailable: { page: string; mode: PageMode; reason: string }[] = [];
  for (const page of pages) {
    if (page.unavailableReason || page.kind || page.checklistHash) continue;
    const modes: PageMode[] =
      page.category === 'Other badges'
        ? ['badge']
        : [
            ...(page.sealNodeHash ? ['seal' as const] : []),
            ...(page.badgeNodeHash ? ['badge' as const] : []),
            ...(['Raid seals', 'Dungeons'].includes(page.category) &&
            page.sealNodeHash
              ? ['raid' as const]
              : []),
            'triumphs',
          ];
    for (const mode of modes) {
      const view = buildSeal(page, defs, mode);
      if (view.unavailable) {
        unavailable.push({ page: page.id, mode, reason: view.unavailable });
        continue;
      }
      for (const heading of view.headings)
        if (!heading.collectibleHashes && defs.records[heading.hash])
          records.add(heading.hash);
      if (mode === 'seal' && page.sealNodeHash) seals.add(page.sealNodeHash);
      if (mode === 'badge' && page.badgeNodeHash)
        badges.add(page.badgeNodeHash);
    }
  }
  const missing = (all: Map<string, CoverageGap>, represented: Set<string>) =>
    [...all.values()].filter((g) => !represented.has(g.hash));
  return {
    missingTriumphs: missing(expected, records),
    missingBadges: missing(expectedBadges, badges),
    missingSeals: missing(expectedSeals, seals),
    unavailable,
    totals: {
      triumphs: expected.size,
      badges: expectedBadges.size,
      seals: expectedSeals.size,
    },
  };
}
