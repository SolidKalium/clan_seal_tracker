import { expect, it } from 'vitest';
import { sealMembershipIndex } from '../src/sealMembership';
import { buildSeal } from '../src/domain';
import type { Definitions } from '../src/types';
const record = (hash: number, title?: string) => ({
  hash,
  scope: 0,
  displayProperties: { name: String(hash) },
  ...(title
    ? { titleInfo: { titlesByGender: { Male: title, Female: title } } }
    : {}),
});
const node = (
  hash: number,
  name: string,
  completionRecordHash: number,
  records: number[],
) => ({
  hash,
  displayProperties: { name },
  completionRecordHash,
  children: { records: records.map((recordHash) => ({ recordHash })) },
});
const defs: Definitions = {
  version: 'test',
  language: 'en',
  nodes: {
    '1': node(1, 'Raid', 90, [42, 42, 43]),
    '2': node(2, 'Moments of Triumph', 91, [42]),
    '3': node(3, 'Ordinary destination tree', 92, [42]),
  },
  records: {
    '42': record(42),
    '43': record(43),
    '90': record(90, 'Raid title'),
    '91': record(91, 'MMXXIV'),
    '92': record(92),
  },
  objectives: {},
};
it('indexes actual seal requirements across title nodes without duplicate children or unrelated trees', () => {
  const index = sealMembershipIndex(defs);
  expect(index.get('42')).toEqual([
    { hash: '2', name: 'Moments of Triumph', title: 'MMXXIV' },
    { hash: '1', name: 'Raid', title: 'Raid title' },
  ]);
  expect(index.get('43')?.map((s) => s.hash)).toEqual(['1']);
  expect(index.has('90')).toBe(false);
  expect(sealMembershipIndex(defs)).toBe(index);
  const refreshed = {
    ...defs,
    nodes: { ...defs.nodes, '2': node(2, 'Moments of Triumph', 91, [43]) },
  };
  expect(
    sealMembershipIndex(refreshed)
      .get('42')
      ?.map((s) => s.hash),
  ).toEqual(['1']);
});
it('attaches membership to displayed triumphs without needing a configured page for every seal', () => {
  const result = buildSeal(
    {
      id: 'raid',
      name: 'Raid',
      category: 'Raid seals',
      sealNodeHash: '1',
      records: {},
    },
    defs,
  );
  expect(result.headings.find((h) => h.hash === '42')?.seals).toEqual(
    sealMembershipIndex(defs).get('42'),
  );
});
