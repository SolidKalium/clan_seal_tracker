import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { recordCell, recordFraction, selectRecord, buildSeal, sealAwarded } from '../src/domain';
import type { Heading, Profile, RecordProgress, Seal } from '../src/types';
export const heading: Heading = { hash: '42', name: 'Test triumph', label: 'Test', description: '', scope: 0, gilding: false, skip: false, order: 1, objectives: [{ hash: 101, completionValue: 10 }], intervals: [] };
const objective = (progress: number, complete = false, hash = 101) => ({ objectiveHash: hash, progress, completionValue: 10, complete });
const cases: RecordProgress[] = [
  { state: 0 }, { state: 1 }, { state: 4 }, { state: 12 },
  { state: 4, objectives: [objective(3)] },
  { state: 4, objectives: [objective(0, true)] },
  { state: 4, objectives: [objective(30)] },
  { state: 4, objectives: [objective(5), objective(0, true, 102)] },
  { state: 6, intervalObjectives: [objective(10), objective(3, false, 102)] },
  { state: 0, intervalObjectives: [objective(4)] },
  { state: 7, intervalObjectives: [objective(4)] },
];
describe('progress rules', () => {
  it('matches the existing PHP progress calculation on shared inputs', () => {
    const php = spawnSync('php', ['tests/php-progress-oracle.php'], { input: JSON.stringify(cases), encoding: 'utf8' });
    expect(php.status, php.stderr).toBe(0);
    const expected = JSON.parse(php.stdout) as number[];
    cases.forEach((record, i) => expect(recordFraction(record)).toBeCloseTo(expected[i]!));
  });
  it('averages objectives, caps excess, and recognizes complete with zero progress', () => {
    expect(recordFraction(cases[7]!)).toBe(.75);
    expect(recordFraction(cases[6]!)).toBe(1);
    expect(recordFraction(cases[5]!)).toBe(1);
  });
  it('matches objectives by hash rather than response order', () => {
    const cell = recordCell({ state: 4, objectives: [objective(8, false, 102), objective(2)] }, heading);
    expect(cell.detail).toContain('2/10');
  });
  it('distinguishes missing records from incomplete records', () => {
    expect(recordCell(undefined, heading).missing).toBe(true);
    expect(recordCell({ state: 4 }, heading).missing).toBe(false);
  });
  it('does not merge character objectives to invent completion', () => {
    const p: Profile = { characterRecords: { data: { titan: { records: { '42': { state: 4, objectives: [objective(10), objective(0, false, 102)] } } }, hunter: { records: { '42': { state: 4, objectives: [objective(0), objective(10, false, 102)] } } } } } };
    const record = selectRecord(p, { ...heading, scope: 1 });
    expect(recordFraction(record!)).toBe(.5);
  });
  it('counts character-scoped title redemption on any character, including tied progress', () => {
    const seal = { completionHash: '42', completionScope: 1 } as Seal;
    const profile: Profile = { characterRecords: { data: {
      first: { records: { '42': { state: 4, objectives: [objective(10, true)] } } },
      second: { records: { '42': { state: 1, objectives: [objective(10, true)] } } },
    } } };
    expect(sealAwarded(profile, seal)).toBe(true);
    expect(sealAwarded(profile, { ...seal, completionScope: 0 })).toBeUndefined();
  });
  it('exposes objective names, counts, completion, and response-order independence', () => {
    const h = { ...heading, objectives: [{ hash: 101, completionValue: 10, progressDescription: 'Security' }, { hash: 102, completionValue: 1, progressDescription: 'Atraks' }] };
    const cell = recordCell({ state: 4, objectives: [{ ...objective(0, false, 102), completionValue: 1 }, objective(5)] }, h);
    expect(cell.objectives.map(o => [o.name, o.text, o.complete])).toEqual([['Security', '5/10', false], ['Atraks', '·', false]]);
    expect(recordCell({ state: 1 }, h).objectives.every(o => o.complete)).toBe(true);
  });
  it('marks missing manifest content unavailable', () => {
    expect(buildSeal({ id: 'x', name: 'X', category: 'Raid', sealNodeHash: '1', records: {} }, { version: 'v', language: 'en', nodes: {}, records: {}, objectives: {} }).unavailable).toBeTruthy();
  });
});


it('distinguishes completed unclaimed records without changing their progress', () => {
  expect(recordCell({ state: 0, objectives: [objective(10, true)] }, heading)).toMatchObject({ complete: true, fraction: 1, text: '✓', unclaimed: true });
  expect(recordCell({ state: 1, objectives: [objective(10, true)] }, heading)).toMatchObject({ complete: true, unclaimed: false });
  expect(recordCell({ state: 4, objectives: [objective(5)] }, heading)).toMatchObject({ complete: false, unclaimed: false });
  expect(recordCell(undefined, heading).unclaimed).toBe(false);
  expect(recordCell({ state: 0, intervalObjectives: [objective(5)] }, { ...heading, objectives: [], intervals: heading.objectives }).unclaimed).toBe(false);
});
it('prefers a redeemed character record when complete progress ties an unclaimed one', () => {
  const profile: Profile = { characterRecords: { data: {
    titan: { records: { '42': { state: 0, objectives: [objective(10, true)] } } },
    hunter: { records: { '42': { state: 1, objectives: [objective(10, true)] } } },
  } } };
  expect(recordCell(selectRecord(profile, { ...heading, scope: 1 }), heading).unclaimed).toBe(false);
});
