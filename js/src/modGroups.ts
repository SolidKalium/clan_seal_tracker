// The manifest puts these in one “Legacy and Raid” node, but their sources
// distinguish the activities more usefully than that presentation hierarchy.
export function legacyModGroup(source: string, itemType: string): string {
  const text = source
    .replace(/^Source:\s*/i, '')
    .replace(/\\'/g, "'")
    .trim();
  const raid = /^"?(.+?)"?\s+raid\.?$/i.exec(text)?.[1];
  if (raid) return raid;
  if (/nightmare hunts/i.test(text)) return 'Nightmare Hunts';
  if (/dreaming city/i.test(text)) return 'Dreaming City';
  const typeRaid = /^(.+?)\s+(?:Raid|Armor) Mod$/i.exec(itemType)?.[1];
  return typeRaid && typeRaid !== 'General' ? typeRaid : 'Legacy mods';
}
