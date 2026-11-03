import { expect, it } from 'vitest';
import { auditManifestTokens } from './audits/tokenAudit';
import type { Definitions } from '../src/types';
const defs: Definitions = {
  version: 'test',
  language: 'en',
  nodes: {},
  records: {},
  objectives: {},
  items: {
    '1': {
      displayProperties: {
        name: 'Fixture',
        description: '[Unmapped item token]',
      },
    },
  },
  perks: {
    '2': {
      displayProperties: {
        name: 'Fixture',
        description: '[Unmapped perk token]',
      },
    },
  },
};
it('ignores item and perk text while auditing other retained definition text', () => {
  expect(
    auditManifestTokens({
      ...defs,
      objectives: {
        '3': {
          hash: 3,
          completionValue: 1,
          progressDescription: '[Unknown objective]',
        },
      },
    }),
  ).toEqual([
    { token: '[Unknown objective]', path: 'objectives.3.progressDescription' },
  ]);
});
it('applies the same scope to pre-compaction samples and recognizes handled tokens', () => {
  expect(
    auditManifestTokens({
      ...defs,
      tokenSamples: [
        {
          token: '[Unknown item]',
          path: 'items.1.displayProperties.description',
        },
        {
          token: '[Unknown perk]',
          path: 'perks.2.displayProperties.description',
        },
        {
          token:
            '[Finisher][Back][Disruption][Shield-Piercing][Stagger][Redacted…]',
          path: 'records.3.displayProperties.description',
        },
        {
          token: '[Unknown record]',
          path: 'records.4.displayProperties.description',
        },
      ],
    }),
  ).toEqual([
    {
      token: '[Unknown record]',
      path: 'records.4.displayProperties.description',
    },
  ]);
});
