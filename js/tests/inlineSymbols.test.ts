import { expect, it } from 'vitest';
import { inlineSymbols, unknownManifestTokens } from '../src/inlineSymbols';

it('converts adjacent weapon and precision tokens without losing surrounding text', () => {
  expect(inlineSymbols('[Hand Cannon][Headshot] Precision')).toEqual([
    { text: String.fromCodePoint(57603), label: 'Hand Cannon' },
    { text: String.fromCodePoint(57666), label: 'Headshot' }, { text: ' Precision' },
  ]);
  expect(inlineSymbols('[Linear Fusion Rifle] Linear Fusion Rifle')[0]?.label).toBe('Linear Fusion Rifle');
});
it('keeps unknown tokens and literal bracketed text intact', () => {
  expect(inlineSymbols('Earn [New Unknown Symbol] and [REDACTED].')).toEqual([
    { text: 'Earn ' }, { text: '[New Unknown Symbol]' }, { text: ' and ' }, { text: '[REDACTED]' }, { text: '.' },
  ]);
});
it('reports unknown manifest tokens with their definition and field, without flagging known literals', () => {
  expect(unknownManifestTokens({ objectives: { '123': { progressDescription: '[Headshot] [Future Weapon]' } }, records: { name: '[Insert Medal Here]' } })).toEqual([
    { token: '[Future Weapon]', path: 'objectives.123.progressDescription' },
  ]);
});

it('renders champion properties as glyphs and input prompts as actions without guessing bindings', () => {
  expect(inlineSymbols('[Disruption][Shield-Piercing][Stagger]')).toEqual([
    { text: String.fromCodePoint(57457), label: 'Disruption' },
    { text: String.fromCodePoint(57456), label: 'Shield-Piercing' },
    { text: String.fromCodePoint(57458), label: 'Stagger' },
  ]);
  expect(inlineSymbols('[Finisher] [Back]')).toEqual([
    { text: '[Finisher]' }, { text: ' ' }, { text: 'Mission summary', action: true },
  ]);
});
