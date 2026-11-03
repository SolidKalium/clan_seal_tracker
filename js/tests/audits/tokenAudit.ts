import { unknownManifestTokens } from '../../src/inlineSymbols';
import type { Definitions } from '../../src/types';

export function auditManifestTokens(
  defs: Definitions & { tokenSamples?: { token: string; path: string }[] },
) {
  if (defs.tokenSamples)
    return defs.tokenSamples
      .filter((sample) => !/^(items|perks)(\.|$)/.test(sample.path))
      .flatMap((sample) => unknownManifestTokens(sample.token, sample.path));
  // Older pinned snapshots predate samples collected before compaction.
  const { items, perks, ...includedTables } = defs;
  return unknownManifestTokens(includedTables);
}
