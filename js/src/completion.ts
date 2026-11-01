import type { Cell, Definitions, Heading, NodeDefinition, RecordDefinition } from './types';

export interface RequirementCount { required?: number; total: number }
export interface SealRequirements { seal: RequirementCount; gilding?: RequirementCount & { requiresSeal: boolean } }
export interface CompletionCounts { triumphs: Counts; collections: Counts }
interface Counts { complete: number; partial: number; missing: number; total: number }

export function sealRequirements(node: NodeDefinition | undefined, defs: Definitions): SealRequirements | undefined {
  if (!node) return;
  const completion = defs.records[String(node.completionRecordHash)];
  const children = [...new Set(node.children.records?.map(r => String(r.recordHash)))].map(h => defs.records[h]).filter((r): r is RecordDefinition => !!r);
  const base = children.filter(r => !r.forTitleGilding), gilding = children.filter(r => r.forTitleGilding);
  const threshold = (record: RecordDefinition | undefined, total: number) => {
    const objectives = record?.objectiveHashes ?? [];
    const count = objectives.length === 1 ? defs.objectives[String(objectives[0])]?.completionValue : undefined;
    return count !== undefined && Number.isInteger(count) && count > 0 && count <= total ? count : undefined;
  };
  const result: SealRequirements = { seal: { total: base.length, required: threshold(completion, base.length) } };
  const tracking = defs.records[String(completion?.titleInfo?.gildingTrackingRecordHash)];
  if (tracking) result.gilding = gilding.length
    ? { total: gilding.length, required: gilding.length, requiresSeal: true }
    : { total: base.length, required: threshold(tracking, base.length), requiresSeal: false };
  return result;
}

export function completionCounts(headings: Heading[], cells: Cell[]): CompletionCounts {
  const empty = (): Counts => ({ complete: 0, partial: 0, missing: 0, total: 0 });
  const counts = { triumphs: empty(), collections: empty() };
  headings.forEach((heading, i) => {
    if (heading.skip || heading.metric) return;
    const cell = cells[i];
    const count = heading.collectibleHashes ? counts.collections : counts.triumphs;
    count.total++;
    if (!cell || cell.missing) count.missing++;
    else if (cell.complete) count.complete++;
    else if (cell.fraction > 0) count.partial++;
  });
  return counts;
}
