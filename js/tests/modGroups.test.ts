import { expect, it } from 'vitest';
import { legacyModGroup } from '../src/modGroups';
it('uses raid sources and handles quoted and escaped apostrophes', () => {
  expect(legacyModGroup('Source: "Vault of Glass" Raid', 'Armor Mod')).toBe(
    'Vault of Glass',
  );
  expect(legacyModGroup('Source: Last Wish raid.', 'General Mod')).toBe(
    'Last Wish',
  );
  expect(
    legacyModGroup('Source: "King\\\'s Fall" Raid', "King's Fall Mod"),
  ).toBe("King's Fall");
});
it('separates legacy activities and retains a fallback for incomplete definitions', () => {
  expect(legacyModGroup('Source: Nightmare Hunts', 'Nightmare Mod')).toBe(
    'Nightmare Hunts',
  );
  expect(
    legacyModGroup(
      'Source: Complete activities in the Dreaming City.',
      'General Armor Mod',
    ),
  ).toBe('Dreaming City');
  expect(legacyModGroup('', 'Deep Stone Crypt Raid Mod')).toBe(
    'Deep Stone Crypt',
  );
  expect(legacyModGroup('', 'General Armor Mod')).toBe('Legacy mods');
});
