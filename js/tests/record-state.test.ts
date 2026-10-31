import { expect, it } from 'vitest';
import { recordConditions } from '../src/recordState';
import { recordCell } from '../src/domain';
import type { Heading } from '../src/types';
const heading: Heading = { hash: '42', name: 'Triumph', label: 'Triumph', description: '', scope: 0, gilding: false, skip: false, order: 1, objectives: [{ hash: 101, completionValue: 10 }], intervals: [] };

it('decodes each permission/visibility flag without treating normal progress as a condition', () => {
  expect(recordConditions(0)).toEqual([]);
  expect(recordConditions(1 | 4)).toEqual([]);
  expect(recordConditions(2 | 64)).toEqual([]);
  for (const [bit, code] of [[32, 'unowned'], [16, 'hidden'], [8, 'obscured']] as const) {
    expect(recordConditions(bit).map(c => c.code)).toEqual([code]);
  }
  expect(recordConditions(2 | 8 | 16 | 32).map(c => c.code)).toEqual(['unowned', 'hidden', 'obscured']);
});
it('keeps progress and flags together, distinct from absent profile data', () => {
  const cell = recordCell({ state: 4 | 8 | 16 | 32, objectives: [{ objectiveHash: 101, progress: 5, completionValue: 10, complete: false }] }, heading);
  expect(cell).toMatchObject({ fraction: .5, missing: false, unowned: true });
  expect(cell.objectives[0]?.text).toBe('5/10');
  expect(cell.conditions).toHaveLength(3);
  expect(recordCell(undefined, heading).conditions).toEqual([]);
});

it('uses a pip at zero for any goal, retaining counts for hidden progress', () => {
  for (const state of [4, 4 | 16]) {
    for (const target of [1, 10, 350]) {
      const cell = recordCell({ state, objectives: [{ objectiveHash: 101, progress: 0, completionValue: target, complete: false }] }, heading);
      expect(cell.objectives[0]?.text).toBe('·');
    }
    const partial = recordCell({ state, objectives: [{ objectiveHash: 101, progress: 2, completionValue: 10, complete: false }] }, heading);
    expect(partial.objectives[0]?.text).toBe('2/10');
    expect(partial.fraction).toBe(.2);
  }
});
