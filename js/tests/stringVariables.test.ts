import { expect, it } from 'vitest';
import {
  resolveStringVariables,
  playerStringVariables,
} from '../src/stringVariables';
import { buildSeal, headingCell } from '../src/domain';
import fixture from './fixtures/never-defeated.json';

it('uses agreed character values as a player fallback and preserves zero', () => {
  const values = playerStringVariables({
    characterStringVariables: {
      data: {
        a: { integerValuesByHash: { '1': 0, '2': 3, '3': 5 } },
        b: { integerValuesByHash: { '2': 3, '3': 7 } },
      },
    },
  });
  expect(values).toEqual({ '1': 0, '2': 3 });
  expect(resolveStringVariables('{var:1} / {var:2} / {var:3}', values)).toBe(
    '0 / 3 / ?',
  );
});
it('resolves Never De-Feated interval objective text without changing goals or the manifest', () => {
  const defs = {
    version: 'v',
    language: 'en',
    nodes: {
      '1': {
        hash: 1,
        completionRecordHash: 0,
        displayProperties: { name: 'Praxic' },
        children: { records: [{ recordHash: 4184277958 }] },
      },
    },
    records: { '4184277958': fixture.record },
    objectives: fixture.objectives,
  };
  const page = {
    id: 'equilibrium',
    name: 'Equilibrium',
    category: 'Dungeons',
    sealNodeHash: '1',
    records: {},
  };
  const seal = buildSeal(page, defs, 'seal', { '713619738': 3 });
  const h = seal.headings[0]!;
  expect(h.intervals).toHaveLength(5);
  expect(h.intervals.map((o) => o.completionValue)).toEqual([1, 2, 3, 4, 5]);
  expect(
    h.intervals.every(
      (o) =>
        o.progressDescription === '3 encounters completed with feats active',
    ),
  ).toBe(true);
  expect(headingCell(undefined, h).objectives[0]?.name).toBe(
    '3 encounters completed with feats active',
  );
  expect(JSON.stringify(seal)).not.toContain('{var:');
  expect(JSON.stringify(buildSeal(page, defs))).not.toContain('{var:');
  expect(fixture.objectives['1670545459'].progressDescription).toContain(
    '{var:',
  );
});

it('uses player account values or the selected character values instead of a clan-wide value', () => {
  const profile = {
    profileStringVariables: {
      data: { integerValuesByHash: { '1': 99, '2': 5 } },
    },
    characterStringVariables: {
      data: {
        a: { integerValuesByHash: { '1': 3 } },
        b: { integerValuesByHash: { '1': 0 } },
      },
    },
  };
  expect(playerStringVariables(profile)).toEqual({ '1': 99, '2': 5 });
  expect(playerStringVariables(profile, 'a')).toEqual({ '1': 3, '2': 5 });
  expect(playerStringVariables(profile, 'b')).toEqual({ '1': 0, '2': 5 });
  expect(playerStringVariables(undefined)).toEqual({});
});
