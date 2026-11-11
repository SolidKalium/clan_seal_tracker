import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { expect, it } from 'vitest';
import { compile, readJsonc } from '../../scripts/compile-data.mjs';
import { catalogCoverage } from './catalogCoverage';
import { auditManifestTokens } from './tokenAudit';
import type { Definitions } from '../../src/types';

const snapshot =
  process.env.TRACKER_AUDIT_SNAPSHOT ??
  new URL('../fixtures/catalog-manifest.json.gz', import.meta.url);
const defs: Definitions = JSON.parse(
  gunzipSync(readFileSync(snapshot)).toString('utf8'),
);
const catalog = compile(
  { api_key: 'coverage-test', group_id: 1 },
  readJsonc(
    readFileSync(new URL('../../pages.jsonc', import.meta.url), 'utf8'),
    'pages.jsonc',
  ),
).catalog;
it(`represents every triumph, badge, and named seal in manifest ${defs.version}`, () => {
  const report = catalogCoverage(defs, catalog);
  for (const key of [
    'missingTriumphs',
    'missingBadges',
    'missingSeals',
    'unavailable',
  ] as const) {
    expect(
      report[key],
      `${key} (${report[key].length}); first 50 entries:\n${JSON.stringify(report[key].slice(0, 50), null, 2)}`,
    ).toEqual([]);
  }
  expect(report.totals.triumphs).toBeGreaterThan(0);
  expect(report.totals.badges).toBeGreaterThan(0);
  expect(report.totals.seals).toBeGreaterThan(0);
});

it(`recognizes bracketed tokens in manifest ${defs.version}`, () => {
  const unknown = auditManifestTokens(defs);
  expect(
    unknown,
    `Unknown manifest tokens (token and definition field):\n${JSON.stringify(unknown, null, 2)}`,
  ).toEqual([]);
});
