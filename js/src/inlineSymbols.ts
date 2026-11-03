// Bungie Destiny Symbols codepoints; see src/assets/README.md for provenance.
const codepoints: Record<string, number> = {
  'Auto Rifle': 57600,
  'Pulse Rifle': 57601,
  'Scout Rifle': 57602,
  'Hand Cannon': 57603,
  Shotgun: 57604,
  'Sniper Rifle': 57605,
  'Fusion Rifle': 57606,
  SMG: 57607,
  'Rocket Launcher': 57608,
  Sidearm: 57609,
  Melee: 57616,
  Grenade: 57617,
  'Grenade Launcher': 57619,
  'Special Grenade Launcher': 57685,
  Bow: 57497,
  'Linear Fusion Rifle': 57682,
  'Trace Rifle': 57656,
  Sword: 57683,
  'Machine Gun': 57684,
  Glaive: 57686,
  Headshot: 57666,
  Solar: 57664,
  Arc: 57667,
  Void: 57668,
  Stasis: 57657,
  Strand: 61198,
  Quest: 57461,
  'Grapple Melee': 61189,
  'Small Blocker': 57427,
  'Medium Blocker': 57428,
  'Large Blocker': 57429,
  'Stasis: Glyph 0': 57462,
  'Stasis: Glyph 1 Locked': 57463,
  'Stasis: Glyph 2 Locked': 57464,
  'Stasis: Glyph 3 Locked': 57465,
  'Shield-Piercing': 57456,
  Disruption: 57457,
  Stagger: 57458,
};
const normalize = (token: string) => token.trim().toLowerCase();
const symbols = new Map(
  Object.entries(codepoints).map(([name, code]) => [
    normalize(name),
    { label: name, glyph: String.fromCodePoint(code) },
  ]),
);
// These refer to player input bindings, not Destiny Symbols glyphs. The API
// doesn't tell us a visitor's bindings, so show the action rather than a key.
const actions = new Map([['back', 'Mission summary']]);
// Known text-only tokens, names, and editorial text. Keep their brackets.
export const literalTokens = new Set(
  [
    'Finisher',
    'Insert Medal Here',
    'REDACTED',
    'Redacted…',
    'Draft',
    'Ambition',
    'Rosetta',
    'Mattermorph',
    'Relocator',
    'Matterspark',
    'Finisher',
  ].map(normalize),
);
export interface InlinePart {
  text: string;
  label?: string;
  action?: boolean;
}
export function inlineSymbols(text: string): InlinePart[] {
  return text
    .split(/(\[[^\[\]\n]+\])/g)
    .filter(Boolean)
    .map((text) => {
      const symbol = text.startsWith('[')
        ? symbols.get(normalize(text.slice(1, -1)))
        : undefined;
      const action = text.startsWith('[')
        ? actions.get(normalize(text.slice(1, -1)))
        : undefined;
      return symbol
        ? { text: symbol.glyph, label: symbol.label }
        : action
          ? { text: action, action: true }
          : { text };
    });
}
export function unknownManifestTokens(
  value: unknown,
  path = '',
): { token: string; path: string }[] {
  if (typeof value === 'string')
    return [...value.matchAll(/\[([^\[\]\n]+)\]/g)]
      .filter(
        (match) =>
          !symbols.has(normalize(match[1]!)) &&
          !actions.has(normalize(match[1]!)) &&
          !literalTokens.has(normalize(match[1]!)),
      )
      .map((match) => ({ token: match[0], path }));
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) =>
    unknownManifestTokens(child, path ? `${path}.${key}` : key),
  );
}
