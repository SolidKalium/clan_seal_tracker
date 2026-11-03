import type { Definitions, Heading, PageConfig, Seal } from './types';

// The title trees include seals absent from (or subsequently added to) curation.
// Walk both levels safely rather than assuming every direct child is a seal.
export function buildSealOverview(page: PageConfig, defs: Definitions): Seal {
  const legacy = page.id.endsWith('_legacy');
  const root = legacy ? '1881970629' : '616318467';
  const headings: Heading[] = [], seenNodes = new Set<string>(), seenRecords = new Set<string>();
  function visit(hash: string) {
    if (seenNodes.has(hash)) return;
    seenNodes.add(hash);
    const node = defs.nodes[hash];
    if (!node) return;
    const completionHash = String(node.completionRecordHash ?? '');
    const record = defs.records[completionHash];
    const title = Object.values(record?.titleInfo?.titlesByGender ?? {}).find(Boolean);
    if (record && title && !seenRecords.has(completionHash)) {
      seenRecords.add(completionHash);
      const trackingHash = record.titleInfo?.gildingTrackingRecordHash;
      headings.push({ hash: completionHash, scope: record.scope, name: title, label: title,
        description: [node.displayProperties.name !== title ? `${node.displayProperties.name} seal.` : '', record.displayProperties.description].filter(Boolean).join('\n'),
        gilding: false, skip: false, order: headings.length,
        objectives: (record.objectiveHashes ?? []).map(hash => defs.objectives[String(hash)]).filter((o): o is NonNullable<typeof o> => !!o),
        intervals: [], sealSummary: { nodeHash: hash, legacy,
          gildingHash: trackingHash ? String(trackingHash) : undefined,
          gildingBoolean: node.hash === 1210906304,
          gildingScope: trackingHash ? defs.records[String(trackingHash)]?.scope : undefined },
      });
    }
    for (const child of node.children.presentationNodes ?? []) visit(String(child.presentationNodeHash));
  }
  visit(root);
  return { page, title: page.name, completionHash: '', headings,
    description: legacy ? 'Progress toward legacy seals. Bungie lists these under Legacy Titles; they can no longer be earned.' : 'Progress toward the seals in Bungie’s current Titles collection. Gilding is shown in the details and does not count toward completion.',
    unavailable: !headings.length ? 'Seal definitions are unavailable.' : undefined,
  };
}
