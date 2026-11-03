import { expect, test, type Page } from '@playwright/test';
import neverDefeated from '../fixtures/never-defeated.json' with { type: 'json' };
const root = '/common/destiny2_content/';
const nodeHash = '1486062207';
const record = (hash: number, name: string, extra = {}) => ({ hash, displayProperties: { name, description: `${name} description` }, scope: 0, ...extra });
const nodes = { [nodeHash]: { hash: Number(nodeHash), displayProperties: { name: 'Last Wish' }, completionRecordHash: 99, children: { records: [{ recordHash: 42 }, { recordHash: 43 }] } } };
const records = { '99': record(99, 'Seal', { titleInfo: { titlesByGender: { Male: 'Rivensbane' } } }), '42': record(42, 'First challenge', { objectiveHashes: [101, 103] }), '43': record(43, 'Second challenge', { objectiveHashes: [102] }) };
const objectives = { '103': { hash: 103, completionValue: 10, progressDescription: 'Final encounter' }, '101': { hash: 101, completionValue: 10, progressDescription: 'Encounters' }, '102': { hash: 102, completionValue: 1, progressDescription: 'Challenge' } };
const members = ['Ada', 'Banshee', 'Crow'].map((name, i) => ({ destinyUserInfo: { membershipType: 3, membershipId: `461168601848564558${i}`, displayName: name, bungieGlobalDisplayName: name }, isOnline: false, lastOnlineStatusChange: '1', joinDate: ['2020-06-01T12:00:00Z', '2022-06-01T12:00:00Z', '2018-06-01T12:00:00Z'][i], memberType: [5, 3, 2][i] }));
const envelope = (Response: unknown) => ({ ErrorCode: 1, ErrorStatus: 'Success', ThrottleSeconds: 0, Response });
async function setup(page: Page, state: { offline: boolean; calls: number; originError?: boolean; delay?: number; profileGate?: Promise<void>; extended?: boolean; other?: boolean; activeMembers?: boolean }) {
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://www.bungie.net/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (/\/icons\/test-(titan|hunter)\.png$/.test(path)) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><path fill="white" d="M16 4 28 26H4Z"/></svg>' });
    state.calls++;
    if (state.delay) await new Promise(resolve => setTimeout(resolve, state.delay));
    if (state.offline) return route.abort('failed');
    if (state.originError && path.includes('/Members/')) return route.fulfill({ status: 500, json: { ErrorCode: 2107, ErrorStatus: 'OriginHeaderDoesNotMatchKey' } });
    if (path === '/Platform/Destiny2/Manifest/') return route.fulfill({ json: envelope({ version: 'test-manifest', jsonWorldComponentContentPaths: { en: { DestinyPresentationNodeDefinition: root + 'nodes.json', DestinyRecordDefinition: root + 'records.json', DestinyObjectiveDefinition: root + 'objectives.json', DestinyCollectibleDefinition: root + 'collectibles.json', DestinyInventoryItemLiteDefinition: root + 'items.json', DestinySandboxPerkDefinition: root + 'perks.json', ...(state.other ? { DestinyGuardianRankDefinition: root + 'ranks.json', DestinyChecklistDefinition: root + 'checklists.json', DestinySocialCommendationDefinition: root + 'commendations.json', DestinySocialCommendationNodeDefinition: root + 'commendation-nodes.json' } : {}) } } }) });
    if (state.other && path === root + 'ranks.json') return route.fulfill({ json: { '1': { hash: 1, rankNumber: 2, presentationNodeHash: Number(nodeHash), displayProperties: { name: 'Explorer' } } } });
    if (state.other && path === root + 'checklists.json') return route.fulfill({ json: { '1697465175': { hash: 1697465175, scope: 0, displayProperties: { name: 'Region Chests' }, entries: [1, 2].map(hash => ({ hash, scope: 0, displayProperties: { name: `Chest ${hash}` } })) } } });
    if (state.other && path === root + 'commendation-nodes.json') return route.fulfill({ json: { '1062358355': { hash: 1062358355, childCommendationNodeHashes: [1] }, '1': { hash: 1, displayProperties: { name: 'Ally' }, color: { red: 54, green: 163, blue: 137 }, childCommendationHashes: [2] } } });
    if (state.other && path === root + 'commendations.json') return route.fulfill({ json: { '2': { hash: 2, parentCommendationNodeHash: 1, displayProperties: { name: 'Selfless' }, displayActivities: [{ name: 'Raids' }] } } });
    if (path === root + 'nodes.json') return route.fulfill({ json: state.extended ? { ...nodes, '1525933460': { children: { records: [{ recordHash: 901 }, { recordHash: 902 }] } }, '1086048586': { displayProperties: { name: 'Badge', description: 'Raid collection' }, children: { presentationNodes: [{ presentationNodeHash: 4 }, { presentationNodeHash: 5 }] } }, '4': { displayProperties: { name: 'Titan', icon: root + 'icons/test-titan.png' }, children: { collectibles: [{ collectibleHash: 201 }, { collectibleHash: 202 }] } }, '5': { displayProperties: { name: 'Hunter', icon: root + 'icons/test-hunter.png' }, children: { collectibles: [{ collectibleHash: 201 }, { collectibleHash: 203 }] } } } : nodes });
    if (path === root + 'records.json') return route.fulfill({ json: state.extended ? { ...records, '901': record(901, 'Woven Wish', { displayProperties: { name: 'Woven Wish', description: 'Complete with a fireteam made entirely of Strand subclasses.' } }), '902': record(902, 'Day one', { displayProperties: { name: 'Day one', description: 'Complete within the first 24 hours of release.' } }) } : records });
    if (path === root + 'items.json') return route.fulfill({ json: { '301': { displayProperties: { name: 'Raid weapon' }, itemType: 3, itemTypeDisplayName: 'Scout Rifle' }, '302': { displayProperties: { name: 'Armor' }, itemType: 2, itemTypeDisplayName: 'Helmet' } } });
    if (path === root + 'perks.json') return route.fulfill({ json: { '401': { displayProperties: { name: 'Mod perk', description: 'Improves the augment.' } } } });
    if (path === root + 'collectibles.json') return route.fulfill({ json: { '201': { hash: 201, scope: 0, itemHash: 301, sourceString: 'Source: Last Wish Raid', displayProperties: { name: 'Raid weapon' } }, '202': { hash: 202, scope: 1, itemHash: 302, displayProperties: { name: 'Titan helmet' } }, '203': { hash: 203, scope: 1, itemHash: 302, displayProperties: { name: 'Hunter helmet' } } } });
    if (path === root + 'objectives.json') return route.fulfill({ json: objectives });
    if (path.includes('/Members/')) return route.fulfill({ json: envelope({ results: state.activeMembers ? members.map(member => ({ ...member, lastOnlineStatusChange: String((Date.now() + 1000) / 1000) })) : members, hasMore: false }) });
    if (/\/GroupV2\/\d+\/$/.test(path)) return route.fulfill({ json: envelope({ detail: { name: 'Test Clan' } }) });
    if (path.includes('/User/GetMembershipsById/')) return route.fulfill({ json: envelope({ destinyMemberships: [
      { membershipType: 2, membershipId: 'linked-psn', displayName: 'PSN Guardian' },
      { membershipType: 3, membershipId: 'linked-steam', displayName: 'Steam Guardian' },
    ] }) });
    if (path.includes('/Profile/')) {
      if (state.profileGate) await state.profileGate;
      const member = members.find(m => path.includes(m.destinyUserInfo.membershipId))!;
      if (member.destinyUserInfo.displayName === 'Crow') return route.fulfill({ json: envelope({ profile: { privacy: 2 }, profileRecords: { privacy: 2 } }) });
      const complete = member.destinyUserInfo.displayName === 'Ada';
      return route.fulfill({ json: envelope({ profile: { data: { userInfo: member.destinyUserInfo, ...(state.other ? { currentGuardianRank: complete ? 11 : 5, renewedGuardianRank: complete ? 10 : 4, lifetimeHighestGuardianRank: 11 } : {}) } }, ...(state.other ? { profileProgression: { data: { checklists: { '1697465175': { '1': complete, '2': true } } } }, profileCommendations: { data: { totalScore: complete ? 500 : 100, scoreDetailValues: [0, 7], commendationNodeScoresByHash: { '1': 12 }, commendationNodePercentagesByHash: { '1': 25 }, commendationScoresByHash: { '2': 0 } } } } : {}), profileCollectibles: { data: { collectibles: { '201': { state: complete ? 0 : 1 }, '202': { state: complete ? 0 : 1 }, '203': { state: 0 } } } }, profileRecords: { data: { records: { '99': { state: complete ? 1 : 4 }, '42': { state: complete ? 1 : 4, objectives: [{ objectiveHash: 101, completionValue: 10, progress: complete ? 10 : 5, complete }, { objectiveHash: 103, completionValue: 10, progress: complete ? 10 : 5, complete }] }, '43': { state: complete ? 1 : 4, objectives: [{ objectiveHash: 102, completionValue: 1, progress: complete ? 1 : 0, complete }] } } } } }) });
    }
    throw new Error(`Unmocked API route: ${path}`);
  });
}
async function noUnresolvedVariables(page: Page) {
  await expect(page.locator('body')).not.toContainText('{var:');
  const labels = await page.locator('[aria-label], [title]').evaluateAll(elements => elements.map(e => [e.getAttribute('aria-label'), e.getAttribute('title')]).flat().join(' '));
  expect(labels).not.toContain('{var:');
}
async function ready(page: Page) {
  await expect(page.getByRole('button', { name: 'Refresh data', exact: true })).toBeEnabled({ timeout: 20_000 });
  await noUnresolvedVariables(page);
}
test.afterEach(async ({ page }) => { if (!page.isClosed()) await noUnresolvedVariables(page); });

test('clan overview, seal table, filters, sort, details, and persisted preferences', async ({ page }) => {
  const state = { offline: false, calls: 0 }; await setup(page, state);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(''); await ready(page);
  await expect(page.locator('.sidebar h2')).toHaveText('Test Clan');
  await expect(page.locator('.sync-strip')).toContainText('3 / 3');
  await page.locator('.seal-card').first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rivensbane seal');
  await expect(page.locator('tbody tr')).toHaveCount(3);
  await expect(page.locator('tbody tr').first()).toContainText('Banshee');
  await expect(page.locator('tbody tr').first()).toContainText('25');
  await page.getByLabel('Search guardians').fill('Ada');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByLabel('Search guardians').fill('');
  await page.getByLabel('Filter progress').selectOption('complete');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr')).toContainText('Ada');
  await page.getByLabel('Filter progress').selectOption('all');
  await page.getByLabel('Sort guardians').selectOption('name');
  await expect(page.locator('tbody tr').first()).toContainText('Ada');
  await page.getByRole('button', { name: 'Banshee: First challenge: Encounters: 5/10' }).click();
  await expect(page.locator('.detail-panel .objective-count').first()).toHaveText(/5\s*\/\s*10/);
  await page.reload(); await ready(page);
  await expect(page.getByLabel('Sort guardians')).toHaveValue('name');
  expect(errors).toEqual([]);
});

test('warm reload needs no network, and failed roster refresh retains fresh inactive profiles', async ({ page }) => {
  const state = { offline: false, calls: 0 }; await setup(page, state);
  await page.goto('#/seal/last_wish'); await ready(page);
  const calls = state.calls;
  await page.reload(); await ready(page);
  expect(state.calls).toBe(calls);
  state.offline = true;
  await page.getByRole('button', { name: 'Refresh data', exact: true }).click(); await ready(page);
  await expect(page.locator('tbody tr')).toHaveCount(3);
  await expect(page.locator('.notice')).toContainText('Cannot reach Bungie');
  await page.getByRole('button', { name: 'Guardian details: Banshee', exact: true }).hover();
  await expect(page.getByRole('tooltip')).toContainText('Up to date');
});

test('clear cache preserves preferences but downloads fresh API data', async ({ page }) => {
  const state = { offline: false, calls: 0 }; await setup(page, state);
  await page.goto('#/seal/last_wish'); await ready(page);
  await page.getByLabel('Sort guardians').selectOption('name');
  const calls = state.calls;
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Clear API cache' }).click();
  await expect.poll(() => state.calls).toBeGreaterThan(calls);
  await ready(page);
  await page.reload(); await ready(page);
  await expect(page.getByLabel('Sort guardians')).toHaveValue('name');
});

test('origin rejection is actionable and unknown content is recoverable', async ({ page }) => {
  await setup(page, { offline: false, calls: 0, originError: true });
  await page.goto(''); await ready(page);
  await expect(page.locator('.notice')).toContainText('Register http://localhost:5173');
  await page.goto('#/seal/not-a-page');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
});

test('mobile layout keeps the page within viewport and table scrolls independently', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, { offline: false, calls: 0 });
  await page.goto('#/seal/last_wish'); await ready(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.locator('tbody tr')).toHaveCount(3);
  await page.screenshot({ path: 'test-results/mobile-seal.png', fullPage: true });
});

test('objective stages, rich tooltips, and full-width controls stay aligned', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await setup(page, { offline: false, calls: 0 });
  await page.goto('#/seal/last_wish'); await ready(page);
  await expect(page.getByRole('columnheader', { name: 'Stage 1: Encounters', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Stage 2: Final encounter', exact: true })).toBeVisible();
  await expect(page.locator('.objective-heading .stage-button')).toHaveText(['1', '2']);
  const cell = page.getByRole('button', { name: 'Banshee: First challenge: Encounters: 5/10' });
  await cell.hover();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await expect(page.getByRole('tooltip').getByRole('heading', { level: 3 })).toHaveText('First challenge');
  await expect(page.getByRole('tooltip').locator('.objective-count').first()).toHaveText(/5\s*\/\s*10/);
  const heights = await page.locator('.search, .select-control').evaluateAll(elements => elements.map(e => e.getBoundingClientRect().height));
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1);
  await page.getByLabel('Search guardians').focus();
  expect(await page.locator('.search').evaluate(e => getComputedStyle(e).outlineStyle)).toBe('none');
  expect(await page.locator('.search').evaluate(e => getComputedStyle(e).boxShadow)).toContain('inset');
  expect(await page.getByLabel('Search guardians').evaluate(e => getComputedStyle(e).outlineStyle)).toBe('none');
  const icon = (await page.locator('.search-icon').boundingBox())!;
  const searchBox = (await page.locator('.search').boundingBox())!;
  expect(Math.abs(icon.y + icon.height / 2 - searchBox.y - searchBox.height / 2)).toBeLessThan(1);
  for (const name of ['Filter progress', 'Sort guardians']) {
    await page.getByLabel(name).focus();
    expect(await page.getByLabel(name).evaluate(e => getComputedStyle(e).outlineStyle)).toBe('none');
    expect(await page.getByLabel(name).evaluate(e => getComputedStyle(e.parentElement!).boxShadow)).toContain('inset');
    expect(await page.getByLabel(name).evaluate(e => parseFloat(getComputedStyle(e.parentElement!).paddingRight))).toBeGreaterThanOrEqual(10);
  }
  await page.screenshot({ path: 'test-results/desktop-objective-stages.png', fullPage: true });
});

test('group dividers, compact rows, guardian names, and pointer-transparent tooltips', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const state = { offline: false, calls: 0 }; await setup(page, state);
  await page.goto('#/seal/last_wish'); await ready(page);
  const boundary = page.locator('.objective-header-row .record-end');
  await expect(boundary).toHaveCount(1);
  expect(await boundary.evaluate(e => getComputedStyle(e).borderRightStyle)).toBe('solid');
  expect(await boundary.evaluate(e => getComputedStyle(e).borderRightColor)).toBe(await page.locator('.record-heading').first().evaluate(e => getComputedStyle(e).borderRightColor));
  expect(await page.locator('tbody tr').first().evaluate(e => e.getBoundingClientRect().height)).toBeLessThanOrEqual(38);
  expect(await page.locator('.table-scroll').evaluate(e => getComputedStyle(e).backgroundColor)).toBe(await page.locator('#app').evaluate(e => getComputedStyle(e).backgroundColor));
  expect(await page.locator('.table-scroll').evaluate(e => getComputedStyle(e).borderTopWidth)).toBe('0px');
  expect(await page.locator('.table-scroll table').evaluate(e => getComputedStyle(e).borderTopWidth)).toBe('1px');
  await page.getByRole('button', { name: 'Guardian details: Banshee', exact: true }).hover();
  await expect(page.getByRole('tooltip')).toContainText('Steam Guardian');
  await expect(page.getByRole('tooltip')).toContainText('PSN Guardian');
  await expect(page.getByRole('tooltip').locator('.objective-details li').first()).toHaveClass('primary-platform');
  await expect(page.getByRole('tooltip').locator('.objective-details li').first()).toContainText('Steam Guardian');
  await expect(page.getByRole('tooltip').locator('.primary-platform-label')).toHaveText('Primary save');
  await expect(page.getByRole('tooltip')).toContainText('Up to date');
  expect(await page.locator('tbody tr').first().locator('th').evaluate(e => getComputedStyle(e).boxShadow)).not.toBe('none');
  expect(await page.locator('tbody tr').first().locator('td').first().evaluate(e => getComputedStyle(e).boxShadow)).not.toBe('none');
  expect(await page.locator('.nav-chevron').first().evaluate(e => e.getBoundingClientRect().width)).toBe(13);
  const cell = page.getByRole('button', { name: 'Banshee: First challenge: Encounters: 5/10', exact: true });
  await cell.hover(); await expect(page.getByRole('tooltip')).toBeVisible();
  expect(await page.getByRole('tooltip').evaluate(e => getComputedStyle(e).pointerEvents)).toBe('none');
  const next = page.getByRole('button', { name: 'Ada: First challenge: complete', exact: true });
  const rect = await next.boundingBox();
  expect(rect).not.toBeNull();
  const x = rect!.x + rect!.width / 2, y = rect!.y + rect!.height / 2;
  expect(await next.evaluate((e, point) => e === document.elementFromPoint(point.x, point.y), { x, y })).toBe(true);
  await page.mouse.move(x, y);
  await expect(page.getByRole('tooltip').locator('.eyebrow')).toHaveText('Ada');
});

test('clan tenure sorts longest first across private/completed profiles and persists', async ({ page }) => {
  await setup(page, { offline: false, calls: 0 });
  await page.goto('#/seal/last_wish'); await ready(page);
  await page.getByLabel('Sort guardians').selectOption('tenure');
  expect(await page.locator('tbody .guardian-button').evaluateAll(elements => elements.map(e => e.getAttribute('aria-label')))).toEqual(['Guardian details: Crow', 'Guardian details: Ada', 'Guardian details: Banshee']);
  await page.getByRole('button', { name: 'Guardian details: Banshee', exact: true }).hover();
  await expect(page.getByRole('tooltip').locator('.clan-rank')).toHaveText('Admin');
  await expect(page.getByRole('tooltip').locator('.clan-joined')).toContainText('2022');
  await page.reload(); await ready(page);
  await expect(page.getByLabel('Sort guardians')).toHaveValue('tenure');
  await expect(page.locator('tbody tr').first()).toContainText('Crow');
});

test('compact header status and persistent collapsible clan rail', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await setup(page, { offline: false, calls: 0 });
  await page.goto('#/seal/last_wish'); await ready(page);
  await expect(page.locator('.topbar .sync-strip')).toContainText('3 / 3 profiles');
  await expect(page.getByText('BROWSER EDITION', { exact: true })).toHaveCount(0);
  await expect(page.locator('.utility-line')).toHaveCount(0);
  await expect(page.locator('.sync-indicator')).not.toHaveAttribute('title');
  await page.getByRole('button', { name: 'Record sync status', exact: true }).hover();
  await expect(page.getByRole('tooltip').locator('.sync-legend li')).toHaveCount(3);
  await expect(page.getByRole('tooltip').locator('.current')).toContainText('Updating or needs attention');
  await expect(page.locator('.title-tally')).toContainText('title holders');
  await expect(page.locator('.title-tally')).not.toContainText('known');
  const width = await page.locator('main').evaluate(e => e.getBoundingClientRect().width);
  await page.getByRole('button', { name: 'Collapse side menu', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Expand side menu', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.sidebar .clan-emblem')).toBeVisible();
  await expect(page.locator('.sidebar .clan-name')).toHaveText('Test Clan');
  expect(await page.locator('.sidebar .clan-name').evaluate(e => getComputedStyle(e).writingMode)).toBe('vertical-rl');
  await expect(page.locator('.seal-nav').first()).toBeHidden();
  expect(await page.locator('main').evaluate(e => e.getBoundingClientRect().width)).toBeGreaterThan(width);
  await page.screenshot({ path: 'test-results/collapsed-sidebar.png', fullPage: true });
  await page.reload(); await ready(page);
  await expect(page.getByRole('button', { name: 'Expand side menu', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/mobile-collapsed-sidebar.png', fullPage: true });
  await page.getByRole('button', { name: 'Expand side menu', exact: true }).click();
  await expect(page.locator('.seal-nav').first()).toBeVisible();
  // Each category stays compact as new categories are added to the catalog.
  for (const toggle of await page.locator('.section-toggle').all()) expect((await toggle.boundingBox())!.height).toBeLessThanOrEqual(24);
  expect(await page.locator('.sidebar').evaluate(e => e.getBoundingClientRect().height)).toBeLessThan(page.viewportSize()!.height / 2);
});

test('status stays anchored during refresh and the collapsed clan name uses the rail', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const state = { offline: false, calls: 0, delay: 0 }; await setup(page, state);
  await page.goto('#/seal/last_wish'); await ready(page);
  await expect(page.locator('.status-heading')).toHaveText('Records synced');
  const original = (await page.locator('.sync-indicator .status-dot').boundingBox())!;
  state.delay = 150;
  await page.getByRole('button', { name: 'Refresh data', exact: true }).click();
  await expect(page.locator('.status-heading')).toHaveText('Syncing records');
  const updating = (await page.locator('.sync-indicator .status-dot').boundingBox())!;
  const primary = (await page.locator('.status-heading').boundingBox())!;
  expect(primary.x - (updating.x + updating.width)).toBeLessThan(20);
  expect(updating.x).toBeLessThan(primary.x);
  expect(updating.y).toBeLessThanOrEqual(original.y);
  await ready(page);
  const settled = (await page.locator('.sync-indicator .status-dot').boundingBox())!;
  expect(Math.abs(settled.x - original.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(settled.y - original.y)).toBeLessThanOrEqual(1);
  const main = (await page.locator('main').boundingBox())!;
  const heading = (await page.locator('.page-heading .eyebrow').boundingBox())!;
  expect(heading.y - main.y).toBeLessThanOrEqual(14);
  await page.getByRole('button', { name: 'Collapse side menu', exact: true }).click();
  const name = (await page.locator('.clan-name').boundingBox())!;
  const rail = (await page.locator('.sidebar').boundingBox())!;
  expect(name.width / rail.width).toBeGreaterThan(.5);
  expect(name.width / rail.width).toBeLessThan(.75);
  expect(await page.locator('.clan-name').evaluate(e => getComputedStyle(e).cursor)).toBe('default');
  await page.getByRole('button', { name: 'Record sync status', exact: true }).focus();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await page.screenshot({ path: 'test-results/status-tooltip-and-clan-name.png', fullPage: true });
});

test('page canvas stays neutral and sidebar backdrop reaches footer', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 600 });
  await setup(page, { offline: false, calls: 0 });
  await page.goto(''); await ready(page);
  expect(await page.locator('html').evaluate(e => getComputedStyle(e).backgroundImage)).toBe('none');
  expect(await page.locator('html').evaluate(e => getComputedStyle(e).backgroundColor)).toBe('rgb(246, 247, 242)');
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => page.locator('html').evaluate(e => getComputedStyle(e).backgroundColor)).toBe('rgb(246, 247, 242)');
  await expect(page.locator('meta[name=theme-color]')).toHaveAttribute('content', '#f6f7f2');
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => page.locator('body').evaluate(e => getComputedStyle(e).backgroundColor)).toBe('rgb(246, 247, 242)');
  const backdropHeight = await page.locator('.shell').evaluate(e => parseFloat(getComputedStyle(e, '::before').height));
  const shell = (await page.locator('.shell').boundingBox())!;
  const footer = (await page.locator('footer').boundingBox())!;
  expect(backdropHeight).toBeGreaterThanOrEqual(footer.y + footer.height - shell.y - 1);
  const counts = (await page.locator('.status-counts').boundingBox())!;
  const refresh = (await page.locator('.refresh').boundingBox())!;
  expect(refresh.x - counts.x - counts.width).toBeLessThanOrEqual(22);
  await page.screenshot({ path: 'test-results/full-height-sidebar.png', fullPage: true });
});

test('refresh progress counts the current pass instead of already-cached profiles', async ({ page }) => {
  const state: { offline: boolean; calls: number; profileGate?: Promise<void>; activeMembers?: boolean } = { offline: false, calls: 0 };
  await setup(page, state); await page.goto('#/seal/last_wish'); await ready(page);
  await expect(page.locator('.status-counts')).toContainText('3 / 3 profiles');
  let finish!: () => void;
  state.profileGate = new Promise<void>(resolve => { finish = resolve; });
  state.activeMembers = true;
  await page.getByRole('button', { name: 'Refresh data', exact: true }).click();
  await expect(page.locator('.status-counts')).toHaveText('Checking profiles… · 0 / 3 done');
  await expect(page.locator('tbody tr')).toHaveCount(3);
  finish(); await ready(page);
  await expect(page.locator('.status-counts')).toContainText('3 / 3 profiles');
  await expect(page.locator('.status-counts')).not.toContainText('checked');
});

test('page edges avoid oversized paint layers and added horizontal scroll range', async ({ page }) => {
  await setup(page, { offline: false, calls: 0 });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('#/seal/last_wish'); await ready(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    expect(await page.locator('.topbar').evaluate(e => getComputedStyle(e).boxShadow)).toBe('none');
    expect(await page.locator('.shell').evaluate(e => getComputedStyle(e).boxShadow)).toBe('none');
    expect(await page.locator('.topbar').evaluate(e => getComputedStyle(e).clipPath)).toBe('none');
    expect(await page.locator('.brand').evaluate(e => e.getBoundingClientRect().left)).toBeGreaterThanOrEqual(0);
  }
});

test('wheel gestures do not change the static canvas or browser theme', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1800 });
  await setup(page, { offline: false, calls: 0 });
  await page.goto('#/seal/last_wish'); await ready(page);
  const paint = () => page.locator('html').evaluate(e => getComputedStyle(e).backgroundColor);
  await page.locator('.topbar').dispatchEvent('wheel', { deltaX: 0, deltaY: 100 });
  expect(await paint()).toBe('rgb(246, 247, 242)');
  for (let i = 0; i < 4; i++) await page.locator('.topbar').dispatchEvent('wheel', { deltaX: 100, deltaY: i % 2 ? -30 : 30 });
  expect(await paint()).toBe('rgb(246, 247, 242)');
  await page.locator('.topbar').dispatchEvent('wheel', { deltaX: 0, deltaY: -100 });
  expect(await paint()).toBe('rgb(246, 247, 242)');
  await expect(page.locator('meta[name=theme-color]')).toHaveAttribute('content', '#f6f7f2');
});


test('badge and full raid navigation keep collection progress and unscored day one visible', async ({ page }) => {
  const state = { offline: false, calls: 0, extended: true }; await setup(page, state);
  await page.goto('#/seal/last_wish'); await ready(page);
  const calls = state.calls;
  await page.getByRole('navigation', { name: 'Raid view' }).getByRole('link', { name: 'Badge', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Badge badge');
  await expect(page.locator('thead')).toContainText('Raid weapon');
  for (const heading of await page.locator('.record-header-row .record-heading').all()) {
    await expect(heading).toHaveCSS('vertical-align', 'middle');
  }
  await expect(page.locator('.category-header-row')).toContainText('Weapons');
  await expect(page.locator('.category-header-row')).toContainText('Armor');
  await expect(page.locator('tbody tr').filter({ hasText: 'Ada' }).locator('.progress-column')).toContainText('100');
  await expect(page.locator('tbody tr').filter({ hasText: 'Banshee' }).locator('.progress-column')).toContainText('50');
  await page.getByRole('button', { name: 'Raid weapon', exact: true }).hover();
  await expect(page.getByRole('tooltip')).toContainText('Scout Rifle');
  await expect(page.getByRole('tooltip')).toContainText('Objective: Acquire');
  await expect(page.getByRole('tooltip')).not.toContainText('Target');
  await expect(page.getByRole('tooltip')).not.toContainText('Source:');
  await page.getByRole('button', { name: 'Ada: Titan helmet: collected for Titan, Hunter', exact: true }).hover();
  const armor = page.getByRole('tooltip').getByRole('table', { name: 'Armor collection by class' });
  await expect(armor.getByRole('columnheader')).toHaveText(['Collection status', 'Titan', 'Hunter']);
  await expect(armor.getByRole('row').nth(1)).toHaveText('Titan helmet Collected');
  await expect(armor.getByRole('row').nth(2)).toHaveText('Set Collected');
  for (const row of [armor.getByRole('row').nth(1), armor.getByRole('row').nth(2)]) {
    await expect(row.getByRole('img', { name: 'Titan', exact: true })).toHaveCount(1);
    await expect(row.getByRole('img', { name: 'Hunter', exact: true })).toHaveCount(1);
  }
  const owned = page.locator('tbody tr').filter({ hasText: 'Banshee' }).locator('.armor-ownership');
  await expect(owned.getByRole('img', { name: 'Hunter', exact: true })).toHaveCount(1);
  await expect(owned.getByRole('img', { name: 'Titan', exact: true })).toHaveCount(0);
  await expect(owned.locator('.class-icon')).toHaveCSS('mask-image', /test-hunter\.png/);
  await expect(owned.locator('.class-slot')).toHaveCount(2);
  await expect(owned.locator('.class-slot').first()).toHaveAttribute('data-class', 'Titan');
  await expect(owned.locator('.class-slot').first().getByRole('img')).toHaveCount(0);
  const allOwned = page.locator('tbody tr').filter({ hasText: 'Ada' }).locator('.armor-ownership');
  const relativeHunterX = (button: typeof owned) => button.evaluate(el => el.querySelector('[data-class="Hunter"]')!.getBoundingClientRect().left - el.getBoundingClientRect().left);
  expect(await relativeHunterX(owned)).toBe(await relativeHunterX(allOwned));
  await expect(allOwned.getByRole('img', { name: 'Titan', exact: true })).toHaveCSS('opacity', '0.58');
  await expect(owned.getByRole('img', { name: 'Hunter', exact: true })).toHaveCSS('opacity', '0.76');
  await expect(armor.getByRole('row').nth(1).getByRole('img', { name: 'Titan', exact: true })).toHaveCSS('opacity', '1');
  await expect(page.getByRole('tooltip').locator('.objective-details')).toHaveCount(0);
  await page.getByLabel('Badge class', { exact: true }).selectOption('0');
  await expect(page.locator('tbody tr').filter({ hasText: 'Banshee' }).locator('.progress-column')).toContainText('0');
  await expect(owned.getByRole('img', { name: 'Hunter', exact: true })).toHaveCount(1);
  await page.getByLabel('Badge class', { exact: true }).selectOption('best');
  await expect(page.locator('tbody tr').filter({ hasText: 'Crow' })).toContainText('No data');
  await page.getByRole('navigation', { name: 'Raid view' }).getByRole('link', { name: 'Full raid', exact: true }).click();
  await expect(page.locator('thead')).toContainText('Strand');
  await expect(page.locator('thead')).toContainText('Day one');
  await expect(page.locator('thead .heading-unscored').first()).toBeVisible();
  await expect(page.locator('thead .unscored-marker')).toHaveCount(0);
  await expect(page.locator('thead')).toContainText('Raid weapon');
  for (const heading of await page.locator('.record-header-row .record-heading').all()) {
    await expect(heading).toHaveCSS('vertical-align', 'middle');
  }
  await page.getByRole('navigation', { name: 'Raid view' }).getByRole('link', { name: 'Seal', exact: true }).click();
  await expect(page.locator('thead')).not.toContainText('Strand');
  await expect(page.locator('thead')).toContainText('Day one');
  expect(state.calls).toBe(calls);
});

test('group titles remain beside the sticky guardian column until their group ends', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await setup(page, { offline: false, calls: 0, extended: true });
  await page.goto('#/raid/last_wish'); await ready(page);
  // Leave enough columns after Triumphs to scroll that group completely out of view.
  await page.locator('.record-heading').last().evaluate(el => { (el as HTMLElement).style.minWidth = '600px'; });
  const geometry = () => page.locator('.table-scroll').evaluate(scroll => {
    const group = scroll.querySelector('.category-header-row th[scope="colgroup"]')!;
    const title = group.querySelector('.category-title')!.getBoundingClientRect();
    const guardian = scroll.querySelector('.category-header-row .player-column')!.getBoundingClientRect();
    const bounds = group.getBoundingClientRect();
    return { left: title.left, right: title.right, guardianRight: guardian.right, groupRight: bounds.right };
  });
  await page.locator('.table-scroll').evaluate(scroll => {
    const group = scroll.querySelector('.category-header-row th[scope="colgroup"]')!;
    const guardian = scroll.querySelector('.player-column')!;
    scroll.scrollLeft = group.getBoundingClientRect().left - scroll.getBoundingClientRect().left - guardian.getBoundingClientRect().width + 30;
  });
  await expect.poll(async () => Math.round((await geometry()).left - (await geometry()).guardianRight)).toBe(12);
  await page.locator('.table-scroll').evaluate(scroll => { scroll.scrollLeft += 25; });
  await expect.poll(async () => Math.round((await geometry()).left - (await geometry()).guardianRight)).toBe(12);
  await page.locator('.table-scroll').evaluate(scroll => {
    const group = scroll.querySelector('.category-header-row th[scope="colgroup"]')!;
    scroll.scrollLeft += group.getBoundingClientRect().right - scroll.querySelector('.player-column')!.getBoundingClientRect().right + 20;
  });
  await expect.poll(async () => (await geometry()).right <= (await geometry()).guardianRight).toBe(true);
});


test('single Complete objective labels are omitted from header and cell details', async ({ page }) => {
  await setup(page, { offline: false, calls: 0 });
  await page.route('**/objectives.json', route => route.fulfill({ json: {
    ...objectives, '102': { ...objectives['102'], progressDescription: 'Complete' },
  } }));
  await page.goto('#/seal/last_wish'); await ready(page);
  await page.getByRole('button', { name: 'Second challenge', exact: true }).hover();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip.locator('.objective-name')).toHaveCount(0);
  await expect(tooltip).toContainText('Objective: At least once');
  await page.getByRole('button', { name: 'Banshee: Second challenge: Complete: 0/1', exact: true }).hover();
  await expect(tooltip.locator('.objective-name')).toHaveCount(0);
  await expect(tooltip.locator('.objective-count')).toHaveText(/0\s*\/\s*1/);
  await expect(tooltip.locator('.objective-state')).toHaveText('Incomplete');
  await page.getByRole('button', { name: 'First challenge', exact: true }).hover();
  await expect(tooltip.locator('.objective-name')).toHaveCount(2);
});

test('generic progress and repeated raid labels are hidden, and badge goals describe acquisition', async ({ page }) => {
  await setup(page, { offline: false, calls: 0 });
  await page.route('**/nodes.json', route => route.fulfill({ json: { ...nodes,
    '1086048586': { displayProperties: { name: 'First challenge', description: 'First challenge description' }, children: {} },
  } }));
  await page.route('**/records.json', route => route.fulfill({ json: { ...records,
    '42': record(42, 'First challenge', { objectiveHashes: [101] }),
  } }));
  await page.route('**/objectives.json', route => route.fulfill({ json: {
    ...objectives, '101': { hash: 101, completionValue: 1, progressDescription: 'Progress' },
    '102': { hash: 102, completionValue: 1, displayProperties: { description: 'The "Last Wish" raid completed' } },
  } }));
  await page.goto('#/seal/last_wish'); await ready(page);
  const tooltip = page.getByRole('tooltip');
  await page.getByRole('button', { name: 'First challenge', exact: true }).hover();
  await expect(tooltip).toContainText('Objective: Acquire badge');
  await expect(tooltip).not.toContainText('At least once');
  await expect(tooltip.locator('.objective-name')).toHaveCount(0);
  await page.getByRole('button', { name: 'Ada: First challenge: complete', exact: true }).hover();
  await expect(tooltip).toContainText('Objective: Acquire badge');
  await expect(tooltip).toContainText('Acquired');
  await expect(tooltip.locator('.objective-count')).toHaveCount(0);
  await page.getByRole('button', { name: 'Second challenge', exact: true }).hover();
  await expect(tooltip.locator('.objective-name')).toHaveCount(0);
  await expect(tooltip).toContainText('Objective: At least once');
  await page.getByRole('button', { name: 'Banshee: Second challenge: The "Last Wish" raid completed: 0/1', exact: true }).hover();
  await expect(tooltip.locator('.objective-name')).toHaveCount(0);
  await expect(tooltip.locator('.objective-count')).toHaveText(/0\s*\/\s*1/);
});

test('triumph tooltips stay anchored while the hovered objective changes', async ({ page }) => {
  await setup(page, { offline: false, calls: 0 });
  await page.goto('#/seal/last_wish'); await ready(page);
  const tooltip = page.getByRole('tooltip');
  await page.getByRole('button', { name: 'First challenge', exact: true }).hover();
  await expect(tooltip).toBeVisible();
  const headerStyle = await tooltip.getAttribute('style');
  await page.getByRole('button', { name: 'Stage 1: Encounters', exact: true }).hover();
  await expect(tooltip.locator('.objective-active')).toContainText('Encounters');
  await expect(tooltip).toHaveAttribute('style', headerStyle!);
  await page.getByRole('button', { name: 'Stage 2: Final encounter', exact: true }).hover();
  await expect(tooltip.locator('.objective-active')).toContainText('Final encounter');
  await expect(tooltip).toHaveAttribute('style', headerStyle!);
  await page.getByRole('button', { name: 'First challenge', exact: true }).hover();
  await expect(tooltip.locator('.objective-active')).toHaveCount(0);
  await expect(tooltip).toHaveAttribute('style', headerStyle!);

  await page.getByRole('button', { name: 'Banshee: First challenge: Encounters: 5/10', exact: true }).hover();
  await expect(tooltip.locator('.objective-active')).toContainText('Encounters');
  const playerStyle = await tooltip.getAttribute('style');
  await page.getByRole('button', { name: 'Banshee: First challenge: Final encounter: 5/10', exact: true }).hover();
  await expect(tooltip.locator('.objective-active')).toContainText('Final encounter');
  await expect(tooltip).toHaveAttribute('style', playerStyle!);
  await page.getByRole('button', { name: 'Stage 1: Encounters', exact: true }).focus();
  await expect(tooltip.locator('.objective-active')).toContainText('Encounters');
  await expect(tooltip).toHaveAttribute('style', headerStyle!);
  await page.getByRole('button', { name: 'Stage 2: Final encounter', exact: true }).focus();
  await expect(tooltip.locator('.objective-active')).toContainText('Final encounter');
  await expect(tooltip).toHaveAttribute('style', headerStyle!);
  await page.getByRole('button', { name: 'Stage 2: Final encounter', exact: true }).press('Escape');
  await expect(tooltip).toHaveCount(0);
});

test('clan emblem layers persist and scale with the collapsed menu', async ({ page }) => {
  const state = { offline: false, calls: 0 }; await setup(page, state);
  const color = (red: number) => ({ red, green: 20, blue: 30, alpha: 255 });
  const icon = root + 'icons/test-titan.png';
  await page.route('**/Platform/GroupV2/*/', route => route.fulfill({ json: envelope({ detail: { name: 'Test Clan', clanInfo: { clanBannerData: { decalId: 1, decalColorId: 2, decalBackgroundColorId: 3, gonfalonColorId: 4, gonfalonDetailId: 5, gonfalonDetailColorId: 6 } } } }) }));
  let dictionaryCalls = 0;
  await page.route('**/Platform/Destiny2/Clan/ClanBannerDictionary/', route => {
    dictionaryCalls++;
    return route.fulfill({ json: envelope({ clanBannerDecalsSquare: { '1': { foregroundPath: icon, backgroundPath: icon } }, clanBannerGonfalonDetailsSquare: { '5': icon }, clanBannerGonfalonColors: { '4': color(10) }, clanBannerDecalPrimaryColors: { '2': color(200) }, clanBannerDecalSecondaryColors: { '3': color(240) }, clanBannerGonfalonDetailColors: { '6': color(50) } }) });
  });
  await page.goto(''); await ready(page);
  const emblem = page.getByRole('img', { name: 'Test Clan clan emblem', exact: true });
  await expect(emblem).toBeVisible();
  await expect(emblem.locator('.clan-banner-layer')).toHaveCount(3);
  await expect(emblem).toHaveCSS('background-color', 'rgb(10, 20, 30)');
  await expect(emblem.locator('.clan-banner-layer').last()).toHaveCSS('background-color', 'rgb(200, 20, 30)');
  expect((await emblem.boundingBox())!.width).toBe(62);
  await page.getByRole('button', { name: 'Collapse side menu' }).click();
  expect((await emblem.boundingBox())!.width).toBe(44);
  const calls = state.calls;
  await page.reload(); await ready(page);
  await expect(emblem).toBeVisible();
  expect(dictionaryCalls).toBe(1);
  expect(state.calls).toBe(calls);
  state.offline = true;
  await page.getByRole('button', { name: 'Refresh data', exact: true }).click(); await ready(page);
  await expect(emblem).toBeVisible();
});

test('the browser catalog exposes the three new raids with seal, badge, and full views', async ({ page }) => {
  await setup(page, { offline: false, calls: 0 });
  const additions = [
    { id: 'crotas_end', name: "Crota's End", seal: '238107129', badge: '48971793', title: 'Swordbearer' },
    { id: 'salvations_edge', name: "Salvation's Edge", seal: '334829503', badge: '988425963', title: 'Iconoclast' },
    { id: 'the_desert_perpetual', name: 'The Desert Perpetual', seal: '3954661385', badge: '4253860097', title: 'Atemporal' },
  ];
  const extraNodes = Object.fromEntries(additions.flatMap((raid, i) => [
    [raid.seal, { hash: Number(raid.seal), displayProperties: { name: raid.name }, completionRecordHash: 990 + i, children: { records: [{ recordHash: 42 }] } }],
    [raid.badge, { displayProperties: { name: raid.name }, children: { presentationNodes: [{ presentationNodeHash: 4 }] } }],
  ]));
  await page.route('**/nodes.json', route => route.fulfill({ json: { ...nodes, ...extraNodes,
    '4': { displayProperties: { name: 'Titan' }, children: { collectibles: [{ collectibleHash: 201 }] } },
  } }));
  await page.route('**/records.json', route => route.fulfill({ json: { ...records, ...Object.fromEntries(additions.map((raid, i) => [990 + i, record(990 + i, raid.name, { titleInfo: { titlesByGender: { Male: raid.title } } })])) } }));
  await page.goto(''); await ready(page);
  await expect(page.getByRole('region', { name: 'Raid seals', exact: true }).locator('.seal-card')).toHaveCount(12);
  await expect(page.getByRole('region', { name: 'Activity seals', exact: true }).locator('.seal-card')).toHaveCount(6);
  for (const raid of additions) {
    await page.locator('.seal-nav').getByRole('link', { name: raid.name, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(raid.title + ' seal');
    const views = page.getByRole('navigation', { name: 'Raid view' });
    await views.getByRole('link', { name: 'Badge', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(raid.name + ' badge');
    await views.getByRole('link', { name: 'Full raid', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(raid.name);
    await views.getByRole('link', { name: 'Seal', exact: true }).click();
  }
});

test('activity seals and triumphs have separate navigation and optional badges', async ({ page }) => {
  await setup(page, { offline: false, calls: 0 });
  const activities = [
    { id: 'crucible', name: 'Crucible', seal: '475207334', badge: '701100740', extra: '3973313476', title: 'Glorious' },
    { id: 'iron_banner', name: 'Iron Banner', seal: '2161171268', extra: '3049172190', title: 'Iron Lord' },
    { id: 'gambit', name: 'Gambit', seal: '3665267419', badge: '1420354007', extra: '97371225', title: 'Dredgen' },
    { id: 'trials', name: 'Trials of Osiris', seal: '1733555826', badge: '564984975', extra: '2739258696', title: 'Flawless' },
    { id: 'strikes', name: 'Strikes', seal: '3776992251', extra: '1954283988', title: 'Conqueror' },
    { id: 'deadeye', name: 'Weapons', seal: '361765966', title: 'Deadeye' },
  ];
  const activityNodes = Object.fromEntries(activities.flatMap((a, i) => [
    [a.seal, { displayProperties: { name: a.name }, completionRecordHash: 990 + i, children: { records: [{ recordHash: 42 }, { recordHash: 43 }] } }],
    ...(a.extra ? [[a.extra, { children: { records: [{ recordHash: 44 }] } }]] : []),
    ...(a.badge ? [[a.badge, { displayProperties: { name: a.name }, children: { presentationNodes: [{ presentationNodeHash: 4 }] } }]] : []),
  ]));
  await page.route('**/nodes.json', route => route.fulfill({ json: { ...nodes, ...activityNodes,
    '4': { displayProperties: { name: 'Titan' }, children: { collectibles: [{ collectibleHash: 201 }] } },
  } }));
  await page.route('**/records.json', route => route.fulfill({ json: { ...records,
    '43': { ...records['43'], forTitleGilding: true }, '44': record(44, 'Extra activity triumph'),
    ...Object.fromEntries(activities.map((a, i) => [990 + i, record(990 + i, a.name, { titleInfo: { titlesByGender: { Male: a.title } } })])),
  } }));
  await page.goto(''); await ready(page);
  await page.getByRole('button', { name: 'Activities', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Activity seals', exact: true }).locator('.seal-card')).toHaveCount(6);
  for (const activity of activities) {
    await page.getByRole('navigation', { name: 'Activities', exact: true }).getByRole('link', { name: activity.name, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(activity.title + ' seal');
    const views = page.getByRole('navigation', { name: 'Activity view' });
    await expect(views.getByRole('link', { name: 'Badge', exact: true })).toHaveCount(activity.badge ? 1 : 0);
    await expect(page.locator('thead .heading-gilding').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Extra activity triumph', exact: true })).toHaveCount(0);
    if (activity.extra) {
      await views.getByRole('link', { name: 'All triumphs', exact: true }).click();
      await expect(page).toHaveURL(new RegExp('#/triumphs/' + activity.id + '$'));
      await expect(page.getByRole('button', { name: 'Extra activity triumph', exact: true })).toHaveCount(1);
    } else {
      await expect(views.getByRole('link', { name: 'All triumphs', exact: true })).toHaveCount(0);
    }
    await expect(page.getByRole('button', { name: 'Raid weapon', exact: true })).toHaveCount(0);
    if (activity.badge) {
      await views.getByRole('link', { name: 'Badge', exact: true }).click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(activity.name + ' badge');
      await expect(page.getByRole('button', { name: 'Raid weapon', exact: true })).toHaveCount(1);
    }
    await views.getByRole('link', { name: 'Seal', exact: true }).click();
  }
});

test('completed unclaimed triumphs use a separate green and explain their status', async ({ page }) => {
  await setup(page, { offline: false, calls: 0 });
  await page.route('**/Platform/Destiny2/3/Profile/*/*', async route => {
    const path = new URL(route.request().url()).pathname;
    const member = members.find(m => path.includes(m.destinyUserInfo.membershipId))!;
    if (!member) return route.fallback();
    const unclaimed = member.destinyUserInfo.displayName === 'Banshee';
    return route.fulfill({ json: envelope({ profile: { data: { userInfo: member.destinyUserInfo } }, profileRecords: { data: { records: {
      '99': { state: 1 }, '42': { state: unclaimed ? 0 : 1, objectives: [{ objectiveHash: 101, progress: 10, completionValue: 10, complete: true }, { objectiveHash: 103, progress: 10, completionValue: 10, complete: true }] }, '43': { state: 1 },
    } } } }) });
  });
  await page.goto('#/seal/last_wish'); await ready(page);
  const button = page.getByRole('button', { name: 'Banshee: First challenge: complete, unclaimed', exact: true });
  await expect(button.locator('..')).toHaveClass(/cell-unclaimed/);
  await expect(button.locator('..')).toHaveCSS('background-color', 'rgb(224, 238, 230)');
  await expect(page.getByRole('button', { name: 'Ada: First challenge: complete', exact: true }).locator('..')).not.toHaveClass(/cell-unclaimed/);
  await button.hover();
  await expect(page.getByRole('tooltip')).toContainText('Completed, but not claimed in game.');
  await page.getByRole('button', { name: 'Ada: First challenge: complete', exact: true }).hover();
  await expect(page.getByRole('tooltip').locator('.claim-status')).toHaveCount(0);
  await expect(page.locator('tbody tr').filter({ hasText: 'Banshee' }).locator('.progress-column')).toContainText('100');
});

test('restricted and hidden triumphs retain progress with a cell indicator and tooltip explanations', async ({ page }) => {
  await setup(page, { offline: false, calls: 0 });
  await page.route('**/Platform/Destiny2/3/Profile/*/*', route => {
    const path = new URL(route.request().url()).pathname;
    const member = members.find(m => path.includes(m.destinyUserInfo.membershipId))!;
    const restricted = member.destinyUserInfo.displayName === 'Banshee';
    return route.fulfill({ json: envelope({ profile: { data: { userInfo: member.destinyUserInfo } }, profileRecords: { data: { records: {
      '99': { state: 1 }, '42': { state: restricted ? 62 : 1, objectives: [101, 103].map(objectiveHash => ({ objectiveHash, progress: restricted ? 5 : 10, completionValue: 10, complete: !restricted })) }, '43': { state: 1 },
    } } } }) });
  });
  await page.goto('#/seal/last_wish'); await ready(page);
  const button = page.getByRole('button', { name: 'Banshee: First challenge: Final encounter: 5/10', exact: true });
  const cell = button.locator('..');
  await expect(cell).toHaveClass(/cell-unowned/);
  await expect(cell.getByRole('img')).toHaveAccessibleName('Content locked; Hidden in game; Obscured in game');
  await expect(cell.locator('.cell-status-watermark')).toHaveAttribute('data-condition', 'unowned');
  await expect(cell.locator('.cell-status-watermark')).toBeVisible();
  await expect(page.locator('tbody tr').filter({ hasText: 'Banshee' }).locator('.cell-status-watermark')).toHaveCount(2);
  await expect(cell.locator('.cell-state')).toHaveCSS('pointer-events', 'none');
  await expect(page.locator('tbody tr').filter({ hasText: 'Banshee' }).locator('.cell-conditions')).toHaveCount(0);
  await button.hover();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip.locator('.record-conditions strong')).toHaveText(['Content locked', 'Hidden in game', 'Obscured in game']);
  await expect(tooltip.locator('.record-conditions .condition-icon')).toHaveCount(3);
  await expect(tooltip).toContainText('such as required DLC');
  await expect(tooltip.locator('.objective-count').first()).toHaveText(/5\s*\/\s*10/);
  await expect(page.locator('tbody tr').filter({ hasText: 'Banshee' }).locator('.progress-column')).toContainText('75');
  await expect(page.locator('tbody tr').filter({ hasText: 'Ada' }).locator('.cell-conditions')).toHaveCount(0);
});

test('expansions and episodes expose nested triumphs, independent badges, and manifest legacy status', async ({ page }) => {
  await setup(page, { offline: false, calls: 0, extended: true });
  const sealNode = (hash: number, title: string) => ({ hash, displayProperties: { name: title }, completionRecordHash: hash + 1, children: { records: [{ recordHash: 42 }] } });
  await page.route('**/nodes.json', route => route.fulfill({ json: { ...nodes,
    '2724376914': sealNode(2724376914, 'The Final Shape'),
    '1309523808': { hash: 1309523808, children: { records: [{ recordHash: 44 }] } },
    '1270675696': sealNode(1270675696, 'Episode: Echoes'),
    '1210906304': sealNode(1210906304, 'Monument of Triumph'),
    '1528010893': { displayProperties: { name: 'Pale Heart Pathfinder' }, children: { presentationNodes: [{ presentationNodeHash: 4 }] } },
    '4': { displayProperties: { name: 'Titan' }, children: { collectibles: [{ collectibleHash: 201 }] } },
    '665075114': { hash: 665075114, children: { presentationNodes: [{ presentationNodeHash: 6 }] } },
    '6': { hash: 6, children: { records: [{ recordHash: 44 }] } },
    '1881970629': { hash: 1881970629, children: { presentationNodes: [{ presentationNodeHash: 1270675696 }] } },
  } }));
  await page.route('**/records.json', route => route.fulfill({ json: { ...records,
    '2724376915': record(2724376915, 'The Final Shape', { titleInfo: { titlesByGender: { Male: 'Transcendent' } } }),
    '1270675697': record(1270675697, 'Echoes', { titleInfo: { titlesByGender: { Male: 'Intrepid' } } }),
    '1210906305': record(1210906305, 'Monument of Triumph', { titleInfo: { titlesByGender: { Male: 'Immortal' } } }),
    '44': record(44, 'Nested episode triumph', { objectiveHashes: [102] }),
  } }));
  await page.goto(''); await ready(page);
  await expect(page.getByRole('region', { name: 'Expansion seals', exact: true }).locator('.seal-card')).toHaveCount(9);
  await expect(page.getByRole('region', { name: 'Seasons & Episodes', exact: true }).locator('.seal-card')).toHaveCount(24);
  await page.getByRole('button', { name: 'Expansions', exact: true }).click();
  await page.getByRole('navigation', { name: 'Expansions', exact: true }).getByRole('link', { name: 'The Final Shape', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Transcendent seal');
  await expect(page.locator('.legacy-notice')).toHaveCount(0);
  const expansionViews = page.getByRole('navigation', { name: 'Expansion view' });
  await expansionViews.getByRole('link', { name: 'Badge', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pale Heart Pathfinder badge');
  await expansionViews.getByRole('link', { name: 'All triumphs', exact: true }).click();
  await page.getByRole('button', { name: 'Seasons & Episodes', exact: true }).click();
  await page.getByRole('navigation', { name: 'Seasons & Episodes', exact: true }).getByRole('link', { name: 'Episode: Echoes Legacy', exact: true }).click();
  await expect(page).toHaveURL(/#\/triumphs\/episode_echoes$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Episode: Echoes triumphs');
  await expect(page.locator('.legacy-notice')).toContainText('can no longer be earned');
  await expect(page.locator('thead')).toContainText('Nested episode triumph');
  await expect(page.locator('thead')).not.toContainText('Raid weapon');
  const seasonalViews = page.getByRole('navigation', { name: 'Seasonal view' });
  await expect(seasonalViews.getByRole('link', { name: 'Badge', exact: true })).toHaveCount(0);
  await seasonalViews.getByRole('link', { name: 'Seal', exact: true }).click();
  await expect(page.locator('thead')).not.toContainText('Nested episode triumph');
  await page.getByRole('button', { name: 'Other seals', exact: true }).click();
  await page.getByRole('navigation', { name: 'Other seals', exact: true }).getByRole('link', { name: 'Moments of Triumph', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Immortal seal');
  await expect(page.locator('.legacy-notice')).toHaveCount(0);
});

test('sidebar sections default to the current category and can be toggled independently by keyboard', async ({ page }) => {
  await setup(page, { offline: false, calls: 0 });
  await page.goto('#/seal/last_wish'); await ready(page);
  const raids = page.getByRole('button', { name: 'Raids', exact: true });
  const activities = page.getByRole('button', { name: 'Activities', exact: true });
  await expect(raids).toHaveAttribute('aria-expanded', 'true');
  for (const name of ['Activities', 'Expansions', 'Seasons & Episodes']) {
    await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('navigation', { name, exact: true })).toHaveCount(0);
  }
  await raids.focus(); await page.keyboard.press('Space');
  await expect(raids).toHaveAttribute('aria-expanded', 'false');
  await raids.press('Enter');
  await expect(raids).toHaveAttribute('aria-expanded', 'true');
  await activities.click();
  await expect(activities).toHaveAttribute('aria-expanded', 'true');
  await expect(raids).toHaveAttribute('aria-expanded', 'true');
  await page.goto('#/seal/crucible');
  await expect(raids).toHaveAttribute('aria-expanded', 'false');
  await expect(activities).toHaveAttribute('aria-expanded', 'true');
  await page.reload(); await ready(page);
  await expect(activities).toHaveAttribute('aria-expanded', 'true');
  await expect(raids).toHaveAttribute('aria-expanded', 'false');
  await page.locator('.sidebar .nav-home').click();
  await expect(raids).toHaveAttribute('aria-expanded', 'true');
  await expect(activities).toHaveAttribute('aria-expanded', 'false');
});

test('Undertaker omits All triumphs when it has no additional triumphs', async ({ page }) => {
  await setup(page, { offline: false, calls: 0 });
  await page.route('**/nodes.json', route => route.fulfill({ json: { ...nodes,
    '347825339': { hash: 347825339, displayProperties: { name: 'Undertaker' }, completionRecordHash: 99, children: { records: [{ recordHash: 42 }] } },
    '2136916333': { hash: 2136916333, children: { records: [{ recordHash: 42 }] } },
  } }));
  await page.goto('#/seal/renegades_invasions'); await ready(page);
  await expect(page.getByRole('navigation', { name: 'Expansion view' }).getByText('All triumphs', { exact: true })).toHaveCount(0);
  await page.goto('#/triumphs/renegades_invasions');
  await expect(page.getByRole('navigation', { name: 'Expansion view' }).getByRole('link', { name: 'Seal', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('overview uses canonical seasons and removes repeated tile and section text', async ({ page }) => {
  await setup(page, { offline: false, calls: 0 });
  await page.goto(''); await ready(page);
  await expect(page.locator('.seal-card[href="#/seal/season_10"] .eyebrow')).toHaveText('SEASON 10');
  await expect(page.locator('.seal-card[href="#/seal/season_5"] .eyebrow')).toHaveText('SEASON 5');
  await expect(page.locator('.seal-card[href="#/seal/episode_echoes"] .eyebrow')).toHaveText('SEASON 24');
  await expect(page.locator('.seal-card[href="#/seal/monument_of_triumph"] .eyebrow')).toHaveText('SEAL');
  for (const label of await page.getByRole('region', { name: 'Activity seals', exact: true }).locator('.card-top .eyebrow').all()) await expect(label).toHaveText('ACTIVITY');
  for (const label of await page.getByRole('region', { name: 'Expansion seals', exact: true }).locator('.card-top .eyebrow').all()) await expect(label).toHaveText('EXPANSION');
  await expect(page.locator('.seal-card[href="#/seal/last_wish"] .card-bottom')).toContainText('title holders');
  await expect(page.locator('.seal-grid').filter({ hasText: /loaded/ })).toHaveCount(0);
  await expect(page.getByText('A title worth chasing.', { exact: true })).toHaveCount(0);
});

test('overview seal logos are monochrome cropped watermarks that do not alter tile content', async ({ page }) => {
  await setup(page, { offline: false, calls: 0 });
  await page.route('**/nodes.json', route => route.fulfill({ json: { ...nodes,
    [nodeHash]: { ...nodes[nodeHash], displayProperties: { name: 'Last Wish', icon: root + 'icons/test-titan.png' } },
  } }));
  await page.goto(''); await ready(page);
  const tile = page.locator('.seal-card[href="#/seal/last_wish"]');
  const mark = tile.locator('.seal-watermark');
  await expect(mark).toHaveAttribute('aria-hidden', 'true');
  await expect(mark).toHaveCSS('mask-mode', 'luminance');
  await expect(mark).toHaveCSS('pointer-events', 'none');
  await expect(tile).toHaveCSS('overflow', 'hidden');
  const placement = await mark.evaluate(el => {
    const logo = el.getBoundingClientRect(), tile = el.parentElement!.getBoundingClientRect();
    return { rightCrop: (logo.right - tile.right) / logo.width, bottomCrop: (logo.bottom - tile.bottom) / logo.height };
  });
  expect(placement.rightCrop).toBeCloseTo(.2, 1);
  expect(placement.bottomCrop).toBeCloseTo(.2, 1);
  await expect(tile.getByRole('heading', { name: 'Rivensbane' })).toBeVisible();
  await expect(page.locator('.seal-card[href="#/seal/season_10"] .seal-watermark')).toHaveCount(0);
});

test('gilding counts show lifetime totals and zero without affecting percentage or completion filters', async ({ page }) => {
  await setup(page, { offline: false, calls: 0 });
  await page.route('**/records.json', route => route.fulfill({ json: { ...records,
    '99': { ...records['99'], titleInfo: { titlesByGender: { Male: 'Rivensbane' }, gildingTrackingRecordHash: 90 } },
    '90': record(90, 'Current gilding requirements', { objectiveHashes: [101] }),
  } }));
  await page.route('**/Platform/Destiny2/3/Profile/*/*', route => {
    const path = new URL(route.request().url()).pathname;
    const member = members.find(m => path.includes(m.destinyUserInfo.membershipId))!;
    if (member.destinyUserInfo.displayName === 'Crow') return route.fulfill({ json: envelope({ profile: { privacy: 2 }, profileRecords: { privacy: 2 } }) });
    const complete = member.destinyUserInfo.displayName === 'Ada';
    return route.fulfill({ json: envelope({ profile: { data: { userInfo: member.destinyUserInfo } }, profileRecords: { data: { records: {
      '99': { state: complete ? 1 : 4 },
      '42': { state: complete ? 1 : 4, objectives: [101, 103].map(objectiveHash => ({ objectiveHash, progress: complete ? 10 : 5, completionValue: 10, complete })) },
      '43': { state: complete ? 1 : 4, objectives: [{ objectiveHash: 102, progress: complete ? 1 : 0, completionValue: 1, complete }] },
      '90': { state: 4, completedCount: complete ? 0 : 13, objectives: [{ objectiveHash: 101, progress: 8, completionValue: 10, complete: false }] },
    } } } }) });
  });
  await page.goto('#/seal/last_wish'); await ready(page);
  await expect(page.getByRole('button', { name: 'Times gilded', exact: true })).toHaveCount(1);
  const count = page.getByRole('button', { name: 'Banshee: Times gilded: 13 gildings', exact: true });
  await expect(count).toHaveText('13');
  await expect(count.locator('..')).not.toHaveClass(/cell-complete|cell-progress/);
  await expect(page.getByRole('button', { name: 'Ada: Times gilded: 0 gildings', exact: true })).toHaveText('0');
  await expect(page.getByRole('button', { name: 'Crow: Times gilded: Gilding count unavailable.', exact: true })).toHaveText('—');
  await expect(page.locator('tbody tr').filter({ hasText: 'Banshee' }).locator('.progress-column')).toContainText('25');
  await expect(page.locator('tbody tr').filter({ hasText: 'Ada' }).locator('.progress-column')).toContainText('100');
  await count.hover();
  await expect(page.getByRole('tooltip')).toContainText('13 gildings');
  await expect(page.getByRole('tooltip')).toContainText("Excluded from this table's completion column");
  await expect(page.getByRole('tooltip')).not.toContainText('Incomplete');
  await expect(page.getByRole('tooltip')).not.toContainText('Objective:');
  await page.getByLabel('Filter progress', { exact: true }).selectOption('complete');
  await expect(page.locator('tbody .player-name')).toHaveText(['Ada ✦']);
});

test('summary tooltips distinguish site completion from seal thresholds and list exclusions without diamonds', async ({ page }) => {
  await setup(page, { offline: false, calls: 0, extended: true });
  await page.route('**/nodes.json', route => route.fulfill({ json: { ...nodes,
    [nodeHash]: { ...nodes[nodeHash], children: { records: [42, 43, 44].map(recordHash => ({ recordHash })) } },
    '1525933460': { children: { records: [{ recordHash: 901 }] } },
    '1086048586': { displayProperties: { name: 'Badge' }, children: { presentationNodes: [{ presentationNodeHash: 4 }] } },
    '4': { displayProperties: { name: 'Titan' }, children: { collectibles: [{ collectibleHash: 201 }] } },
  } }));
  await page.route('**/records.json', route => route.fulfill({ json: { ...records,
    '99': record(99, 'Seal', { titleInfo: { titlesByGender: { Male: 'Rivensbane' }, gildingTrackingRecordHash: 90 }, objectiveHashes: [104] }),
    '43': { ...records['43'], forTitleGilding: true },
    '44': record(44, 'Other base requirement', { objectiveHashes: [102] }),
    '90': record(90, 'Gilding', { objectiveHashes: [105] }),
    '901': record(901, 'First day', { displayProperties: { name: 'First day', description: 'Complete within the first 24 hours.' }, objectiveHashes: [102] }),
  } }));
  await page.route('**/objectives.json', route => route.fulfill({ json: { ...objectives,
    '104': { hash: 104, completionValue: 1 }, '105': { hash: 105, completionValue: 3 },
  } }));
  await page.goto('#/seal/last_wish'); await ready(page);
  const header = page.getByRole('button', { name: 'Requirements', exact: true });
  await header.hover();
  await expect(page.getByRole('tooltip')).toContainText('1 of 2 triumphs required');
  await expect(page.getByRole('tooltip')).toContainText('complete all 1 gilding triumph');
  await expect(page.getByRole('tooltip')).not.toContainText('site-defined summary');
  await expect(page.getByRole('tooltip').locator('.completion-exclusions li')).toHaveText(['Times gilded', 'Day one']);
  await expect(page.locator('thead .unscored-marker')).toHaveCount(0);
  await page.locator('tbody tr').filter({ hasText: 'Banshee' }).locator('.summary-cell').hover();
  await expect(page.getByRole('tooltip')).toContainText('1 triumph partially complete');
  await expect(page.getByRole('tooltip')).not.toContainText('not started');
  await page.getByRole('navigation', { name: 'Raid view' }).getByRole('link', { name: 'Full raid', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Completion', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Requirements', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Completion', exact: true }).hover();
  await expect(page.getByRole('tooltip')).toContainText('site-defined summary');
  await page.getByRole('navigation', { name: 'Raid view' }).getByRole('link', { name: 'Badge', exact: true }).click();
  await page.getByRole('button', { name: 'Collected', exact: true }).hover();
  await expect(page.getByRole('tooltip')).not.toContainText('site-defined summary');
  await expect(page.getByRole('tooltip')).toContainText('Acquire the full collection for at least one class');
});

test('progress sorting breaks percentage ties by gildings before name', async ({ page }) => {
  await setup(page, { offline: false, calls: 0 });
  await page.route('**/records.json', route => route.fulfill({ json: { ...records,
    '99': record(99, 'Seal', { titleInfo: { titlesByGender: { Male: 'Rivensbane' }, gildingTrackingRecordHash: 90 } }),
    '90': record(90, 'Gilding'),
  } }));
  await page.route('**/Platform/Destiny2/3/Profile/*/*', route => {
    const member = members.find(m => new URL(route.request().url()).pathname.includes(m.destinyUserInfo.membershipId))!;
    const name = member.destinyUserInfo.displayName;
    return route.fulfill({ json: envelope({ profile: { data: { userInfo: member.destinyUserInfo } }, profileRecords: { data: { records: {
      '99': { state: 4 },
      '42': { state: 4, objectives: [101, 103].map(objectiveHash => ({ objectiveHash, progress: name === 'Crow' ? 8 : 5, completionValue: 10, complete: false })) },
      '43': { state: 4, objectives: [{ objectiveHash: 102, progress: 0, completionValue: 1, complete: false }] },
      '90': { state: 4, completedCount: name === 'Banshee' ? 13 : 0 },
    } } } }) });
  });
  await page.goto('#/seal/last_wish'); await ready(page);
  const names = page.locator('tbody .player-name');
  await expect(names).toHaveText(['Crow', 'Banshee', 'Ada']);
  await page.getByLabel('Sort guardians', { exact: true }).selectOption('highest');
  await expect(names).toHaveText(['Crow', 'Banshee', 'Ada']);
  await page.getByLabel('Sort guardians', { exact: true }).selectOption('name');
  await expect(names).toHaveText(['Ada', 'Banshee', 'Crow']);
});

test('the guardian star is explained as title ownership in the legend and guardian tooltip', async ({ page }) => {
  await setup(page, { offline: false, calls: 0 });
  await page.goto('#/seal/last_wish'); await ready(page);
  await expect(page.locator('.table-caption')).toContainText('✦ Title earned');
  await expect(page.locator('tbody tr').filter({ hasText: 'Ada' }).locator('.earned')).toHaveAttribute('aria-label', 'Rivensbane title earned');
  await page.getByRole('button', { name: 'Guardian details: Ada', exact: true }).hover();
  await expect(page.getByRole('tooltip').locator('.guardian-title')).toHaveText('✦ Rivensbane title earned');
  await expect(page.getByRole('tooltip').locator('.clan-rank')).toHaveText('Founder');
  await page.getByRole('button', { name: 'Guardian details: Banshee', exact: true }).hover();
  await expect(page.getByRole('tooltip').locator('.guardian-title')).toHaveCount(0);
});

test('badge ownership markers are gold only for all three classes and ignore the selected class filter', async ({ page }) => {
  await setup(page, { offline: false, calls: 0, extended: true });
  await page.route('**/nodes.json', route => route.fulfill({ json: { ...nodes,
    '1086048586': { displayProperties: { name: 'Badge' }, children: { presentationNodes: [4, 5, 6].map(presentationNodeHash => ({ presentationNodeHash })) } },
    ...Object.fromEntries(['Titan', 'Hunter', 'Warlock'].map((name, i) => [4 + i, { displayProperties: { name }, children: { collectibles: [{ collectibleHash: 201 }, { collectibleHash: 202 + i }] } }])),
  } }));
  await page.route('**/collectibles.json', route => route.fulfill({ json: Object.fromEntries([201, 202, 203, 204].map(hash => [hash, { hash, scope: 1, itemHash: hash === 201 ? 301 : 302, displayProperties: { name: hash === 201 ? 'Weapon' : 'Class helmet' } }])) }));
  await page.route('**/Platform/Destiny2/3/Profile/*/*', route => {
    const member = members.find(m => new URL(route.request().url()).pathname.includes(m.destinyUserInfo.membershipId))!;
    const name = member.destinyUserInfo.displayName;
    return route.fulfill({ json: envelope({ profile: { data: { userInfo: member.destinyUserInfo } }, profileRecords: { data: { records: {} } }, profileCollectibles: { data: { collectibles: Object.fromEntries([201, 202, 203, 204].map(hash => [hash, { state: name === 'Ada' || (name === 'Banshee' ? hash <= 202 : hash !== 202) ? 0 : 1 }])) } } }) });
  });
  await page.goto('#/badge/last_wish'); await ready(page);
  const ada = page.locator('tbody tr').filter({ hasText: 'Ada' });
  const banshee = page.locator('tbody tr').filter({ hasText: 'Banshee' });
  await expect(ada.locator('.earned')).toHaveClass(/earned-gold/);
  await expect(ada.locator('.earned')).toHaveAttribute('aria-label', 'Last Wish badge collected on all 3 classes');
  await expect(banshee.locator('.earned')).not.toHaveClass(/earned-gold/);
  await expect(banshee.locator('.earned')).toHaveAttribute('aria-label', 'Last Wish badge collected on Titan');
  await expect(page.locator('tbody .player-name')).toHaveText(['Ada ✦', 'Crow ✦', 'Banshee ✦']);
  await page.getByLabel('Sort guardians', { exact: true }).selectOption('highest');
  await expect(page.locator('tbody .player-name')).toHaveText(['Ada ✦', 'Crow ✦', 'Banshee ✦']);
  await page.getByLabel('Sort guardians', { exact: true }).selectOption('name');
  await expect(page.locator('tbody .player-name')).toHaveText(['Ada ✦', 'Banshee ✦', 'Crow ✦']);
  await expect(page.getByRole('button', { name: 'Collected', exact: true })).toBeVisible();
  await expect(page.locator('.table-caption')).toContainText('Badge collected');
  await page.getByLabel('Badge class', { exact: true }).selectOption('2');
  await expect(banshee.locator('.earned')).toBeVisible();
  await expect(banshee.locator('.progress-column')).toContainText('50');
  await page.getByRole('button', { name: 'Guardian details: Ada', exact: true }).hover();
  await expect(page.getByRole('tooltip').locator('.guardian-badge')).toContainText('Collected on all 3 classes');
  await page.getByRole('button', { name: 'Guardian details: Banshee', exact: true }).hover();
  await expect(page.getByRole('tooltip').locator('.guardian-badge')).toContainText('Collected on Titan');
  await page.getByRole('button', { name: 'Guardian details: Crow', exact: true }).hover();
  await expect(page.getByRole('tooltip').locator('.guardian-badge')).toContainText('Collected on Hunter and Warlock');
});

test('legend uses spaced entries and armor tooltips explain the scoring class behind white owned cells', async ({ page }) => {
  await setup(page, { offline: false, calls: 0, extended: true });
  const classes = ['Titan', 'Hunter', 'Warlock'];
  const hashes = classes.flatMap((_, i) => Array.from({ length: 5 }, (_, j) => 202 + i * 10 + j));
  await page.route('**/nodes.json', route => route.fulfill({ json: { ...nodes,
    '1086048586': { displayProperties: { name: 'Badge' }, children: { presentationNodes: [4, 5, 6].map(presentationNodeHash => ({ presentationNodeHash })) } },
    ...Object.fromEntries(classes.map((name, i) => [4 + i, { displayProperties: { name, icon: root + 'icons/test-' + (i === 1 ? 'hunter' : 'titan') + '.png' }, children: { collectibles: hashes.slice(i * 5, (i + 1) * 5).map(collectibleHash => ({ collectibleHash })) } }])),
  } }));
  await page.route('**/collectibles.json', route => route.fulfill({ json: Object.fromEntries(hashes.map(hash => [hash, { hash, scope: 1, itemHash: 302, displayProperties: { name: `Test Armor ${hash % 10}` } }])) }));
  await page.route('**/Platform/Destiny2/3/Profile/*/*', route => {
    const member = members.find(m => new URL(route.request().url()).pathname.includes(m.destinyUserInfo.membershipId))!;
    return route.fulfill({ json: envelope({ profile: { data: { userInfo: member.destinyUserInfo } }, profileRecords: { data: { records: {} } }, profileCollectibles: { data: { collectibles: Object.fromEntries(hashes.map(hash => [hash, { state: member.destinyUserInfo.displayName === 'Ada' || hash >= 213 && hash <= 216 || hash === 222 ? 0 : 1 }])) } } }) });
  });
  await page.goto('#/badge/last_wish'); await ready(page);
  await expect(page.locator('.table-legend')).toContainText('No progress');
  await expect(page.locator('.table-legend')).not.toContainText('No record');
  await expect(page.locator('.legend-zero')).toHaveCSS('align-items', 'center');
  await expect(page.locator('.legend-zero')).toHaveCSS('justify-content', 'center');
  await expect(page.locator('.legend-group-end')).toHaveCSS('margin-right', '8px');
  await expect(page.locator('.table-legend>span')).toHaveText(['✦ Badge collected', '✦ All 3 classes', '✓ Collected', '● In progress', '· No progress']);
  const helmet = page.getByRole('button', { name: 'Banshee: Helmet: collected for Warlock', exact: true });
  await expect(helmet.locator('..')).not.toHaveClass(/cell-complete/);
  await helmet.hover();
  const note = page.getByRole('tooltip').locator('.armor-scoring-note');
  await expect(note).toContainText('This helmet is marked uncollected because the most complete armor set');
  await expect(note).toContainText('Hunter · 80%');
  await expect(note).toContainText('is missing it');
  await expect(note.getByRole('img', { name: 'Hunter', exact: true })).toHaveCount(1);
  await page.mouse.move(1, 1);
  await page.getByLabel('Badge class', { exact: true }).selectOption('0');
  await helmet.hover();
  await expect(note).toContainText('the selected armor set');
  await expect(note).toContainText('Titan · 0%');
  await page.mouse.move(1, 1);
  await page.getByLabel('Badge class', { exact: true }).selectOption('2');
  await helmet.hover();
  await expect(helmet.locator('..')).toHaveClass(/cell-complete/);
  await expect(note).toHaveCount(0);
});

test('table headers expose guardian and content identifiers without repeating shared collectible IDs', async ({ page }) => {
  await setup(page, { offline: false, calls: 0, extended: true });
  await page.goto('#/seal/last_wish'); await ready(page);
  const guardian = page.locator('tbody tr').filter({ hasText: 'Ada' }).locator('th[scope="row"]');
  await expect(guardian).toHaveAttribute('data-guardian-id', '3_' + members[0]!.destinyUserInfo.membershipId);
  await expect(guardian).toHaveAttribute('data-membership-id', members[0]!.destinyUserInfo.membershipId);
  await expect(guardian).toHaveAttribute('data-membership-type', '3');
  const record = page.getByRole('button', { name: 'First challenge', exact: true }).locator('..');
  await expect(record).toHaveAttribute('data-record-hash', '42');
  await expect(page.getByRole('button', { name: 'Stage 1: Encounters', exact: true }).locator('..')).toHaveAttribute('data-objective-hash', '101');
  await page.getByRole('navigation', { name: 'Raid view' }).getByRole('link', { name: 'Badge', exact: true }).click();
  const weapon = page.getByRole('button', { name: 'Raid weapon', exact: true }).locator('..');
  await expect(weapon).toHaveAttribute('data-record-tooltip', 'header:collectible:201');
  await expect(weapon).toHaveAttribute('data-collectible-hashes', '201');
  await expect(page.getByRole('button', { name: 'Titan helmet', exact: true }).locator('..')).toHaveAttribute('data-collectible-hashes', '202 203');
});

test('destination and event navigation supports triumph-only and removed historical pages', async ({ page }) => {
  await setup(page, { offline: false, calls: 0 });
  await page.route('**/nodes.json', route => route.fulfill({ json: { ...nodes,
    '1663192739': { hash: 1663192739, children: { presentationNodes: [{ presentationNodeHash: 10 }] } },
    '10': { hash: 10, children: { records: [{ recordHash: 42 }] } },
    '4161172201': { hash: 4161172201, children: { records: [{ recordHash: 43 }] } },
    '2592822840': { hash: 2592822840, displayProperties: { name: 'Festival of the Lost' }, completionRecordHash: 99, children: { records: [{ recordHash: 42 }] } },
    '3598951881': { hash: 3598951881, displayProperties: { name: 'Solstice' }, completionRecordHash: 99, children: { records: [{ recordHash: 42 }] } },
    '3215903653': { hash: 3215903653, children: { presentationNodes: [{ presentationNodeHash: 4277365833 }] } },
    '4277365833': { hash: 4277365833, children: { records: [{ recordHash: 43 }] } },
  } }));
  await page.goto(''); await ready(page);
  const destinations = page.getByRole('region', { name: 'Destinations', exact: true });
  await expect(destinations.locator('.seal-card')).toHaveCount(7);
  await expect(page.getByRole('region', { name: 'Events', exact: true }).locator('.seal-card')).toHaveCount(8);
  const nessus = destinations.getByRole('link', { name: /Nessus/ });
  await expect(nessus).not.toContainText('title holders');
  await nessus.click();
  await expect(page).toHaveURL(/#\/triumphs\/nessus$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nessus triumphs');
  await expect(page.getByRole('navigation', { name: 'Destination view' }).getByRole('link', { name: 'Seal', exact: true })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: 'Completion', exact: true })).toBeVisible();
  await expect(page.locator('.table-legend')).not.toContainText('Title earned');
  await page.goto('#/seal/solstice');
  await expect(page.getByRole('navigation', { name: 'Event view' }).getByRole('link', { name: 'Seal', exact: true })).toBeVisible();
  await page.goto('#/triumphs/dawning_2021');
  await expect(page.getByRole('navigation', { name: 'Event view' }).getByRole('link', { name: '2021', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('navigation', { name: 'Events', exact: true }).getByRole('link')).toHaveCount(8);
  await expect(page.getByRole('navigation', { name: 'Events', exact: true }).getByRole('link', { name: 'The Dawning', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.legacy-notice')).toContainText('Legacy triumphs');
  await page.goto('#/triumphs/festival_of_the_lost_2021');
  await expect(page.locator('.view-unavailable')).toContainText('removed from Bungie’s manifest');
  await page.getByRole('navigation', { name: 'Event view' }).getByRole('link', { name: 'Seal', exact: true }).click();
  await expect(page).toHaveURL(/#\/seal\/festival_of_the_lost$/);
  const eventViews = page.getByRole('navigation', { name: 'Event view' });
  await expect(eventViews).toHaveCount(1);
  await expect(eventViews.getByText('All triumphs', { exact: true })).toHaveCount(0);
  await expect(eventViews.getByRole('link', { name: '2022', exact: true })).toBeVisible();
  await eventViews.getByRole('link', { name: '2021', exact: true }).click();
  await expect(page.locator('.view-unavailable')).toContainText('removed from Bungie’s manifest');
});

test('triumph tooltips list every seal membership without adding header text', async ({ page }) => {
  await setup(page, { offline: false, calls: 0 });
  await page.route('**/nodes.json', route => route.fulfill({ json: { ...nodes,
    '999': { hash: 999, displayProperties: { name: 'Moments of Triumph 2024' }, completionRecordHash: 1000, children: { records: [{ recordHash: 42 }, { recordHash: 42 }] } },
  } }));
  await page.route('**/records.json', route => route.fulfill({ json: { ...records,
    '1000': record(1000, 'Moments title', { titleInfo: { titlesByGender: { Male: 'MMXXIV' } } }),
  } }));
  await page.goto('#/seal/last_wish'); await ready(page);
  await expect(page.locator('thead')).not.toContainText('Moments of Triumph 2024');
  await page.getByRole('button', { name: 'First challenge', exact: true }).hover();
  const memberships = page.getByRole('tooltip').locator('.seal-memberships');
  await expect(memberships).toHaveText('This triumph is part of the Last Wish (Rivensbane) and Moments of Triumph 2024 (MMXXIV) seals.');
  await page.getByRole('button', { name: 'Banshee: First challenge: Encounters: 5/10' }).hover();
  await expect(memberships.locator('strong')).toHaveCount(2);
  await expect(memberships).toContainText('Moments of Triumph 2024');
  await page.getByRole('button', { name: 'Second challenge', exact: true }).hover();
  await expect(memberships).toHaveText('This triumph is part of the Last Wish (Rivensbane) seal.');
});

test('event headings and tab positions stay consistent across seal, yearly, and unavailable views', async ({ page }) => {
  await setup(page, { offline: false, calls: 0 });
  await page.route('**/nodes.json', route => route.fulfill({ json: { ...nodes,
    '2592822840': { hash: 2592822840, displayProperties: { name: 'Festival of the Lost', description: 'A description for the seal that should not move its navigation.' }, completionRecordHash: 99, children: { records: [{ recordHash: 42 }] } },
    '2330977699': { hash: 2330977699, children: { records: [{ recordHash: 43 }] } },
  } }));
  await page.route('**/records.json', route => route.fulfill({ json: { ...records, '99': record(99, 'Seal', { titleInfo: { titlesByGender: { Male: 'Ghost Writer' } } }) } }));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('#/seal/festival_of_the_lost'); await ready(page);
    const tabs = page.getByRole('navigation', { name: 'Event view' });
    await expect(page.locator('.seal-heading .eyebrow')).toHaveText('Events / Festival of the Lost / Seal requirements');
    const sealY = (await tabs.boundingBox())!.y;
    const sealHeadingHeight = (await page.locator('.seal-heading').boundingBox())!.height;
    const tabBounds = () => tabs.getByRole('link').evaluateAll(links => links.map(link => { const { x, y, width, height } = link.getBoundingClientRect(); return { x, y, width, height }; }));
    const before = await tabBounds();
    const expectStableTabs = async () => { const after = await tabBounds(); expect(after).toHaveLength(before.length); after.forEach((rect, i) => { for (const key of ['x', 'width', 'height'] as const) expect(rect[key]).toBeCloseTo(before[i]![key], 2); }); };
    await expect(page.locator('.view-description')).toBeVisible();
    await tabs.getByRole('link', { name: '2022', exact: true }).click();
    await expect(page.locator('.seal-heading .eyebrow')).toHaveText('Events / Festival of the Lost / 2022');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Festival of the Lost triumphs');
    await expect(page.locator('.view-description')).toHaveCount(0);
    expect(Math.abs((await tabs.boundingBox())!.y - sealY - ((await page.locator('.seal-heading').boundingBox())!.height - sealHeadingHeight))).toBeLessThan(1);
    await expectStableTabs();
    await tabs.getByRole('link', { name: '2021', exact: true }).click();
    await expect(page.locator('.seal-heading .eyebrow')).toHaveText('Events / Festival of the Lost / 2021');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Festival of the Lost triumphs');
    await expect(page.locator('.view-unavailable')).toContainText('removed from Bungie’s manifest');
    expect(Math.abs((await tabs.boundingBox())!.y - sealY - ((await page.locator('.seal-heading').boundingBox())!.height - sealHeadingHeight))).toBeLessThan(1);
    await expectStableTabs();
  }
});

test('gilding header text and decoration stay behind the sticky Guardian label', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 900 });
  await setup(page, { offline: false, calls: 0 });
  await page.route('**/records.json', route => route.fulfill({ json: { ...records, '43': { ...records['43'], forTitleGilding: true } } }));
  await page.goto('#/seal/last_wish'); await ready(page);
  await page.locator('.table-scroll table').evaluate(e => { (e as HTMLElement).style.minWidth = '1800px'; });
  const guardian = page.locator('thead .player-column');
  const gilding = page.locator('.heading-gilding');
  const button = gilding.locator('.heading-button');
  await expect(button).toHaveCSS('z-index', 'auto');
  expect(await gilding.evaluate(e => getComputedStyle(e, '::after').zIndex)).toBe('-1');
  const guardianBounds = (await guardian.boundingBox())!;
  const buttonBounds = (await button.boundingBox())!;
  const x = guardianBounds.x + guardianBounds.width / 2;
  await page.locator('.table-scroll').evaluate((e, scrollLeft) => { e.scrollLeft = scrollLeft; }, buttonBounds.x + buttonBounds.width / 2 - x);
  const moved = (await button.boundingBox())!;
  const point = { x: moved.x + moved.width / 2, y: moved.y + moved.height / 2 };
  expect(point.x).toBeGreaterThan(guardianBounds.x);
  expect(point.x).toBeLessThan(guardianBounds.x + guardianBounds.width);
  expect(await guardian.evaluate((e, point) => document.elementFromPoint(point.x, point.y)?.closest('th') === e, point)).toBe(true);
});

test('hidden and obscured gilding cells keep numbers, pips, and hover borders behind guardian names', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 900 });
  await setup(page, { offline: false, calls: 0 });
  const fillers = Array.from({ length: 8 }, (_, i) => record(2000 + i, `Extra ${i}`, { objectiveHashes: [102] }));
  await page.route('**/nodes.json', route => route.fulfill({ json: { ...nodes, [nodeHash]: { ...nodes[nodeHash], children: { records: [42, 43, ...fillers.map(r => r.hash)].map(recordHash => ({ recordHash })) } } } }));
  await page.route('**/records.json', route => route.fulfill({ json: { ...records, '42': { ...records['42'], forTitleGilding: true }, '43': { ...records['43'], forTitleGilding: true }, ...Object.fromEntries(fillers.map(r => [r.hash, r])) } }));
  await page.route('**/Platform/Destiny2/3/Profile/*/*', route => {
    const member = members.find(m => route.request().url().includes(m.destinyUserInfo.membershipId))!;
    return route.fulfill({ json: envelope({ profile: { data: { userInfo: member.destinyUserInfo } }, profileRecords: { data: { records: {
      '99': { state: 1 }, '42': { state: 28, objectives: [101, 103].map(objectiveHash => ({ objectiveHash, progress: 5, completionValue: 10, complete: false })) }, '43': { state: 12, objectives: [{ objectiveHash: 102, progress: 0, completionValue: 1, complete: false }] },
    } } } }) });
  });
  await page.goto('#/seal/last_wish'); await ready(page);
  await page.locator('.table-scroll table').evaluate(e => { (e as HTMLElement).style.minWidth = '1800px'; });
  const row = page.locator('tbody tr').filter({ hasText: 'Banshee' });
  const guardian = row.locator('.player-column');
  const guardianBounds = (await guardian.boundingBox())!;
  const right = guardianBounds.x + guardianBounds.width;
  for (const [label, text] of [['Banshee: First challenge: Encounters: 5/10', '5/10'], ['Banshee: Second challenge: Challenge: 0/1', '']]) {
    const button = page.getByRole('button', { name: label, exact: true });
    await page.locator('.table-scroll').evaluate(e => { e.scrollLeft = 0; });
    await expect(button).toHaveText(text!);
    await expect(button.locator('..').locator('.cell-status-watermark')).toHaveAttribute('data-condition', label!.includes('First challenge') ? 'hidden' : 'obscured');
    const initial = (await button.boundingBox())!;
    await page.locator('.table-scroll').evaluate((e, left) => { e.scrollLeft = left; }, initial.x + initial.width - right - 4);
    const bounds = (await button.boundingBox())!;
    await page.mouse.move(bounds.x + bounds.width - 2, bounds.y + bounds.height / 2);
    await expect(button).not.toHaveCSS('box-shadow', 'none');
    for (const x of [bounds.x + bounds.width / 2, bounds.x + 1]) {
      expect(x).toBeLessThan(right);
      expect(await guardian.evaluate((e, point) => document.elementFromPoint(point.x, point.y)?.closest('th') === e, { x, y: bounds.y + bounds.height / 2 })).toBe(true);
    }
  }
});

test('summary counts include totals, condense full completion, and keep seal rules on Seal', async ({ page }) => {
  await setup(page, { offline: false, calls: 0, extended: true });
  await page.goto('#/seal/last_wish'); await ready(page);
  const tooltip = page.getByRole('tooltip');
  const summary = (name: string) => page.locator('tbody tr').filter({ hasText: name }).locator('.summary-cell');
  await summary('Banshee').hover();
  await expect(tooltip.locator('.completion-counts')).toHaveText('0 of 2 triumphs complete1 triumph partially complete');
  await expect(tooltip.locator('.completion-rule')).toContainText('Seal');
  await summary('Ada').hover();
  await expect(tooltip.locator('.completion-counts')).toHaveText('All 2 triumphs complete');
  await expect(tooltip).not.toContainText('partially complete');
  await summary('Crow').hover();
  await expect(tooltip.locator('.completion-counts')).toContainText('0 of 2 triumphs complete');
  await expect(tooltip.locator('.completion-counts')).toContainText('2 triumphs with no public record');
  await page.goto('#/triumphs/last_wish');
  await summary('Banshee').hover();
  await expect(tooltip.locator('.completion-rule')).toHaveCount(0);
  await expect(tooltip).not.toContainText('earning the seal');
  await page.getByRole('navigation', { name: 'Raid view' }).getByRole('link', { name: 'Badge', exact: true }).click();
  await summary('Banshee').hover();
  await expect(tooltip.locator('.completion-counts')).toHaveText('1 of 2 items collected');
  await expect(tooltip).not.toContainText('partially collected');
  await summary('Ada').hover();
  await expect(tooltip.locator('.completion-counts')).toHaveText('All 2 items collected');
});

test('historical activity seals and Leviathan content share their parent navigation', async ({ page }) => {
  await setup(page, { offline: false, calls: 0 });
  const sealNode = (hash: number) => ({ hash, displayProperties: { name: 'Seal' }, completionRecordHash: 99, children: { records: [{ recordHash: 42 }] } });
  const recordsNode = (hash: number) => ({ hash, displayProperties: { name: 'Legacy' }, children: { records: [{ recordHash: 43 }] } });
  await page.route('**/nodes.json', route => route.fulfill({ json: { ...nodes,
    '3776992251': sealNode(3776992251), '581214566': sealNode(581214566), '1276693937': sealNode(1276693937), '1733555826': sealNode(1733555826),
    '475207334': sealNode(475207334), '2107507397': sealNode(2107507397),
    '636644708': recordsNode(636644708), '2675905563': recordsNode(2675905563), '1427965125': recordsNode(1427965125), '2558323083': recordsNode(2558323083), '2481808943': recordsNode(2481808943), '297242190': recordsNode(297242190), '1519064131': recordsNode(1519064131),
    '1881970629': { hash: 1881970629, children: { presentationNodes: [{ presentationNodeHash: 581214566 }, { presentationNodeHash: 1276693937 }, { presentationNodeHash: 2107507397 }] } },
    '3215903653': { hash: 3215903653, children: { presentationNodes: [636644708, 2675905563, 1427965125, 2558323083, 2481808943, 297242190, 1519064131].map(presentationNodeHash => ({ presentationNodeHash })) } },
  } }));
  await page.goto('#/seal/strikes'); await ready(page);
  const activities = page.getByRole('navigation', { name: 'Activities', exact: true });
  await expect(activities.getByRole('link')).toHaveCount(6);
  const activityViews = page.getByRole('navigation', { name: 'Activity view' });
  await activityViews.getByRole('link', { name: 'Season 12', exact: true }).click();
  await expect(page).toHaveURL(/#\/seal\/conqueror_12$/);
  await expect(page.locator('.legacy-notice')).toContainText('Legacy seal');
  await expect(activities.getByRole('link', { name: 'Strikes', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: 'Requirements', exact: true })).toBeVisible();
  await activityViews.getByRole('link', { name: 'Legacy strikes', exact: true }).click();
  await expect(page).toHaveURL(/#\/triumphs\/strikes_legacy$/);
  await expect(page.locator('.legacy-notice')).toContainText('Objective progress is likely missing');
  await page.goto('#/seal/trials');
  await activityViews.getByRole('link', { name: 'Season 12', exact: true }).click();
  await expect(page).toHaveURL(/#\/seal\/flawless_12$/);
  await page.goto('#/seal/crucible');
  await activityViews.getByRole('link', { name: 'Unbroken', exact: true }).click();
  await expect(page).toHaveURL(/#\/seal\/unbroken$/);
  await page.goto('#/triumphs/leviathan');
  const raids = page.getByRole('navigation', { name: 'Raids', exact: true });
  await expect(raids.getByRole('link')).toHaveCount(12);
  await expect(raids.getByRole('link', { name: 'Crown of Sorrow', exact: true })).toHaveCount(0);
  const raidViews = page.getByRole('navigation', { name: 'Raid view' });
  for (const [name, id] of [['Crown of Sorrow', 'crown'], ['Menagerie', 'menagerie'], ['Tribute Hall', 'tribute_hall'], ['Leviathan', 'leviathan']]) {
    await raidViews.getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp('#/triumphs/' + id + '$'));
    await expect(raids.getByRole('link', { name: 'Leviathan Legacy', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Leviathan triumphs');
  }
});

test('activity headings distinguish seals, named badges, and current triumphs with appropriate owner counts', async ({ page }) => {
  await setup(page, { offline: false, calls: 0, extended: true });
  await page.route('**/nodes.json', route => route.fulfill({ json: { ...nodes,
    '475207334': { hash: 475207334, displayProperties: { name: 'Crucible', description: 'Earn the Glorious title.', icon: root + 'icons/test-hunter.png' }, completionRecordHash: 99, children: { records: [{ recordHash: 42 }, { recordHash: 43 }] } },
    '3973313476': { hash: 3973313476, children: { records: [{ recordHash: 44 }] } },
    '2107507397': { hash: 2107507397, displayProperties: { name: 'Unbroken' }, completionRecordHash: 99, children: { records: [{ recordHash: 42 }] } },
    '1881970629': { hash: 1881970629, children: { presentationNodes: [{ presentationNodeHash: 2107507397 }] } },
    '701100740': { hash: 701100740, displayProperties: { name: 'Crucible Arsenal', icon: root + 'icons/test-titan.png' }, children: { presentationNodes: [{ presentationNodeHash: 4 }, { presentationNodeHash: 5 }] } },
    '4': { hash: 4, displayProperties: { name: 'Titan' }, children: { collectibles: [{ collectibleHash: 201 }] } },
    '5': { hash: 5, displayProperties: { name: 'Hunter' }, children: { collectibles: [{ collectibleHash: 201 }] } },
  } }));
  await page.route('**/records.json', route => route.fulfill({ json: { ...records,
    '99': record(99, 'Seal', { titleInfo: { titlesByGender: { Male: 'Glorious' } } }), '44': record(44, 'Extra current triumph', { objectiveHashes: [102] }),
  } }));
  await page.goto('#/seal/crucible'); await ready(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Glorious seal');
  await expect(page.locator('.heading-kind')).toHaveText('seal');
  await expect(page.locator('.heading-tally')).toHaveText('1title holders');
  await expect(page.locator('.heading-seal-icon')).toBeVisible();
  await expect(page.locator('.view-description')).toHaveText('Earn the Glorious title.');
  await expect(page.locator('.active-triumphs-notice')).toHaveCount(0);
  const icon = (await page.locator('.heading-seal-icon').boundingBox())!;
  const count = (await page.locator('.heading-tally .title-tally').boundingBox())!;
  expect(Math.abs(icon.height - count.height)).toBeLessThan(10);
  expect(count.x - icon.x - icon.width).toBeLessThanOrEqual(4);
  await expect(page.locator('.heading-tally .title-tally')).toHaveCSS('text-align', 'left');
  const tabs = page.getByRole('navigation', { name: 'Activity view' });
  await tabs.getByRole('link', { name: 'All triumphs', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Crucible triumphs');
  await expect(page.locator('.active-triumphs-notice')).toContainText('This view only shows active triumphs');
  await expect(page.locator('.heading-tally')).toHaveCount(0);
  await expect(page.locator('.view-description')).toHaveCount(0);
  await tabs.getByRole('link', { name: 'Badge', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Crucible Arsenal badge');
  await expect(page.locator('.active-triumphs-notice')).toHaveCount(0);
  await expect(page.locator('.heading-tally')).toHaveText('1badge owners');
  await expect(page.locator('.heading-seal-icon')).toHaveCount(0);
  await expect(page.locator('.heading-badge-icon')).toBeVisible();
  await expect(page.locator('.heading-badge-icon')).toHaveAttribute('src', 'https://www.bungie.net' + root + 'icons/test-titan.png');
  await expect(page.locator('.heading-badge-icon')).toHaveCSS('object-fit', 'contain');
});

test('dungeons and exotic missions expose seal, collection, full dungeon, and archived mission views', async ({ page }) => {
  await setup(page, { offline: false, calls: 0, extended: true });
  await page.route('**/nodes.json', route => route.fulfill({ json: { ...nodes,
    '854126634': { hash: 854126634, displayProperties: { name: 'Duality' }, completionRecordHash: 99, children: { records: [{ recordHash: 42 }, { recordHash: 43 }] } },
    '4032492628': { hash: 4032492628, children: { records: [{ recordHash: 44 }] } },
    '3487512928': { hash: 3487512928, displayProperties: { name: 'Dungeon: Duality' }, children: { presentationNodes: [{ presentationNodeHash: 4 }, { presentationNodeHash: 5 }] } },
    '4': { hash: 4, displayProperties: { name: 'Titan' }, children: { collectibles: [{ collectibleHash: 201 }, { collectibleHash: 202 }] } },
    '5': { hash: 5, displayProperties: { name: 'Hunter' }, children: { collectibles: [{ collectibleHash: 201 }, { collectibleHash: 203 }] } },
    '1347078175': { hash: 1347078175, children: { records: [{ recordHash: 42 }] } },
    '3818825440': { hash: 3818825440, children: { records: [{ recordHash: 42 }] } },
    '3108806378': { hash: 3108806378, children: { records: [{ recordHash: 43 }] } },
    '3215903653': { hash: 3215903653, children: { presentationNodes: [{ presentationNodeHash: 3108806378 }] } },
  } }));
  await page.route('**/records.json', route => route.fulfill({ json: { ...records,
    '99': record(99, 'Seal', { titleInfo: { titlesByGender: { Male: 'Discerptor' } } }),
    '44': record(44, 'Extra dungeon triumph', { objectiveHashes: [102] }),
    '846398159': record(846398159, 'Tell the Tale', { objectiveHashes: [102] }),
  } }));
  await page.goto(''); await ready(page);
  await expect(page.getByRole('region', { name: 'Dungeons', exact: true }).locator('.seal-card')).toHaveCount(11);
  await expect(page.getByRole('region', { name: 'Exotic missions', exact: true }).locator('.seal-card')).toHaveCount(16);
  await page.getByRole('region', { name: 'Dungeons', exact: true }).getByRole('link', { name: /Duality/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Discerptor seal');
  const dungeonViews = page.getByRole('navigation', { name: 'Dungeon view' });
  await dungeonViews.getByRole('link', { name: 'Badge', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dungeon: Duality badge');
  await expect(page.locator('thead')).toContainText('Raid weapon');
  await dungeonViews.getByRole('link', { name: 'Full dungeon', exact: true }).click();
  await expect(page).toHaveURL(/#\/raid\/duality$/);
  await expect(page.locator('.seal-heading .eyebrow')).toHaveText('Dungeons / Duality / Full dungeon');
  await expect(page.locator('thead')).toContainText('Extra dungeon triumph');
  await expect(page.locator('thead')).toContainText('Raid weapon');
  await expect(page.getByRole('button', { name: 'Dungeons', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await page.goto('#/triumphs/shattered_throne');
  await expect(dungeonViews.getByRole('link', { name: 'Seal', exact: true })).toHaveCount(0);
  await expect(page.locator('tbody tr')).toHaveCount(3);
  await page.goto('#/triumphs/the_whisper');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The Whisper triumphs');
  await expect(page.getByRole('navigation', { name: 'Exotic mission view' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Exotic missions', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await page.goto('#/triumphs/presage');
  await expect(page.locator('thead')).toContainText('Tell the Tale');
  await expect(page.locator('.active-triumphs-notice')).toContainText('This view only shows active triumphs');
  await page.getByRole('navigation', { name: 'Exotic mission view' }).getByRole('link', { name: 'Legacy triumphs', exact: true }).click();
  await expect(page).toHaveURL(/#\/triumphs\/presage_legacy$/);
  await expect(page.locator('.legacy-notice')).toContainText('Objective progress is likely missing');
  await expect(page.getByRole('navigation', { name: 'Exotic missions', exact: true }).getByRole('link', { name: 'Presage', exact: true })).toHaveAttribute('aria-current', 'page');
});

for (const hasVariables of [true, false]) {
  test(`Praxic page and Never De-Feated tooltips contain no unresolved {var: tokens (${hasVariables ? 'resolved' : 'unavailable'})`, async ({ page }) => {
    await setup(page, { offline: false, calls: 0 });
    await page.route('**/nodes.json', route => route.fulfill({ json: { ...nodes,
      '1504131436': { hash: 1504131436, displayProperties: { name: 'Equilibrium' }, completionRecordHash: 99, children: { records: [{ recordHash: 4184277958 }] } },
    } }));
    await page.route('**/records.json', route => route.fulfill({ json: { ...records, '4184277958': neverDefeated.record,
      '99': record(99, 'Seal', { titleInfo: { titlesByGender: { Male: 'Praxic' } } }),
    } }));
    await page.route('**/objectives.json', route => route.fulfill({ json: { ...objectives, ...neverDefeated.objectives } }));
    let profileRequests = 0;
    await page.route('**/Platform/Destiny2/3/Profile/*/*', route => {
      profileRequests++;
      const request = new URL(route.request().url());
      expect(request.searchParams.get('components')?.split(',')).toContain('1200');
      const member = members.find(m => request.pathname.includes(m.destinyUserInfo.membershipId))!;
      return route.fulfill({ json: envelope({ profile: { data: { userInfo: member.destinyUserInfo } }, profileRecords: { data: { records: { '99': { state: 4 } } } },
        characterRecords: { data: { a: { records: { '4184277958': { state: 4, intervalObjectives: [{ objectiveHash: 1670545459, progress: 2, completionValue: 5, complete: false }] } } } } },
        ...(hasVariables ? { characterStringVariables: { data: { a: { integerValuesByHash: { '713619738': 3 } } } } } : {}),
      }) });
    });

    await page.goto('#/seal/equilibrium'); await ready(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Praxic seal');
    await noUnresolvedVariables(page);
    const expected = `${hasVariables ? '3' : '?'} encounters completed with feats active`;
    await page.getByRole('button', { name: 'Never De-Feated', exact: true }).hover();
    await expect(page.getByRole('tooltip')).toContainText('? encounters completed with feats active');
    await noUnresolvedVariables(page);
    await page.getByRole('button', { name: /Banshee: Never De-Feated:/ }).hover();
    await expect(page.getByRole('tooltip')).toContainText(expected);
    await expect(page.getByRole('tooltip').locator('.objective-count')).toHaveText(/2\s*\/\s*5/);
    await noUnresolvedVariables(page);
    const fetched = profileRequests;
    await page.reload(); await ready(page);
    await page.getByRole('button', { name: 'Never De-Feated', exact: true }).hover();
    await expect(page.getByRole('tooltip')).toContainText('? encounters completed with feats active');
    await noUnresolvedVariables(page);
    expect(profileRequests).toBe(fetched);
  });
}

test('player triumph cells substitute values from the character supplying that player record', async ({ page }) => {
  await setup(page, { offline: false, calls: 0 });
  await page.route('**/nodes.json', route => route.fulfill({ json: { ...nodes,
    '1504131436': { hash: 1504131436, displayProperties: { name: 'Equilibrium' }, completionRecordHash: 99, children: { records: [{ recordHash: 4184277958 }] } },
  } }));
  await page.route('**/records.json', route => route.fulfill({ json: { ...records, '4184277958': neverDefeated.record,
    '99': record(99, 'Seal', { titleInfo: { titlesByGender: { Male: 'Praxic' } } }),
  } }));
  await page.route('**/objectives.json', route => route.fulfill({ json: { ...objectives, ...neverDefeated.objectives } }));
  await page.route('**/Platform/Destiny2/3/Profile/*/*', route => {
    const member = members.find(m => route.request().url().includes(m.destinyUserInfo.membershipId))!;
    const value = { Ada: 2, Banshee: 4, Crow: 0 }[member.destinyUserInfo.displayName]!;
    const progress = (value: number) => ({ state: 4, intervalObjectives: [{ objectiveHash: 1670545459, progress: value, completionValue: 5, complete: false }] });
    return route.fulfill({ json: envelope({ profile: { data: { userInfo: member.destinyUserInfo } }, profileRecords: { data: { records: { '99': { state: 4 } } } },
      profileStringVariables: { data: { integerValuesByHash: { '713619738': 99 } } },
      characterRecords: { data: { a: { records: { '4184277958': progress(1) } }, b: { records: { '4184277958': progress(3) } } } },
      characterStringVariables: { data: { a: { integerValuesByHash: { '713619738': 10 } }, b: { integerValuesByHash: { '713619738': value } } } },
    }) });
  });
  await page.goto('#/seal/equilibrium'); await ready(page);
  await page.getByRole('button', { name: 'Never De-Feated', exact: true }).hover();
  await expect(page.getByRole('tooltip')).toContainText('? encounters completed with feats active');
  for (const [name, value] of [['Ada', 2], ['Banshee', 4], ['Crow', 0]] as const) {
    const cell = page.getByRole('button', { name: `${name}: Never De-Feated: ${value} encounters completed with feats active: 3/5`, exact: true });
    await cell.hover();
    await expect(page.getByRole('tooltip')).toContainText(`${value} encounters completed with feats active`);
    await expect(page.getByRole('tooltip').locator('.objective-count')).toHaveText(/3\s*\/\s*5/);
    await cell.click();
    await expect(page.locator('.detail-panel')).toContainText(`${value} encounters completed with feats active`);
    await page.getByRole('button', { name: 'Close record details', exact: true }).click();
  }
  await page.reload(); await ready(page);
  await page.getByRole('button', { name: 'Banshee: Never De-Feated: 4 encounters completed with feats active: 3/5', exact: true }).hover();
  await expect(page.getByRole('tooltip')).toContainText('4 encounters completed with feats active');
});


test('Other groups individual ranks, commendations, and chronological checklist tabs with cached values', async ({ page }) => {
  const state = { offline: false, calls: 0, other: true }; await setup(page, state);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(''); await ready(page);
  const section = page.getByRole('region', { name: 'Other', exact: true });
  await expect(section.locator('.seal-card')).toHaveCount(8);
  await section.getByRole('link').filter({ hasText: 'Guardian ranks' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Guardian ranks');
  await expect(page.locator('.view-description')).toContainText('does not expose a season-by-season');
  await expect(page.locator('thead')).toContainText('Lifetime highest');
  await expect(page.locator('.summary-cell')).toHaveCount(0);
  await expect(page.locator('tbody tr').first()).toContainText('Ada');
  await expect(page.getByRole('button', { name: 'Ada: Current: Current: 11', exact: true })).toHaveText('11');
  await expect(page.getByRole('button', { name: 'Crow: Current: Rank unavailable.', exact: true })).toHaveText('—');
  await page.getByRole('link', { name: '2 · Explorer', exact: true }).click();
  await expect(page.locator('thead')).toContainText('First challenge');
  await expect(page.locator('.summary-cell')).toHaveCount(3);
  await page.getByRole('link', { name: 'Commendations', exact: true }).click();
  await expect(page.locator('.summary-cell')).toHaveCount(0);
  const ally = page.locator('.category-header-row th').filter({ hasText: 'Ally' });
  expect(await ally.evaluate(el => (el as HTMLElement).style.getPropertyValue('--commendation-color'))).toBe('rgb(54 163 137)');
  await page.getByRole('button', { name: 'Ada: Selfless: Selfless: 0', exact: true }).hover();
  await expect(page.getByRole('tooltip')).toContainText('Activities: Raids');
  await expect(page.getByRole('tooltip')).not.toContainText('Excluded');
  await page.goto('#/triumphs/checklists'); await ready(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Checklists');
  await expect(page.locator('.page-modes a')).toHaveCount(22);
  await expect(page.getByRole('button', { name: 'Banshee: Chest 1: not collected', exact: true })).toHaveText('·');
  await expect(page.getByRole('button', { name: 'Ada: Chest 1: collected', exact: true })).toHaveText('✓');
  const calls = state.calls;
  await page.reload(); await ready(page);
  expect(state.calls).toBe(calls);
  state.offline = true;
  await page.getByRole('button', { name: 'Refresh data', exact: true }).click(); await ready(page);
  await expect(page.getByRole('button', { name: 'Ada: Chest 1: collected', exact: true })).toHaveText('✓');
  expect(errors).toEqual([]);
});

test('Other collection pages use native groups, pattern objectives, and collected progress', async ({ page }) => {
  await setup(page, { offline: false, calls: 0 });
  const leaf = (hash: number, name: string, children: object) => ({ hash, displayProperties: { name }, children });
  await page.route('**/nodes.json', route => route.fulfill({ json: { ...nodes,
    '2744330515': leaf(2744330515, 'Exotic Catalysts', { presentationNodes: [{ presentationNodeHash: 17 }] }),
    '17': leaf(17, 'Kinetic Weapons', { records: [{ recordHash: 42 }] }),
    '127506319': leaf(127506319, 'Primary Weapon Patterns', { presentationNodes: [{ presentationNodeHash: 18 }] }),
    '18': leaf(18, 'Auto Rifles', { records: [{ recordHash: 43 }] }),
    '2214408526': leaf(2214408526, 'Weapons', { presentationNodes: [{ presentationNodeHash: 19 }, { presentationNodeHash: 20 }] }),
    '19': leaf(19, 'Kinetic', { collectibles: [{ collectibleHash: 201 }] }),
    '20': leaf(20, 'Energy', { collectibles: [{ collectibleHash: 203 }] }),
    '1789205056': leaf(1789205056, 'Armor', { presentationNodes: [{ presentationNodeHash: 21 }, { presentationNodeHash: 22 }] }),
    '21': leaf(21, 'Titan', { collectibles: [{ collectibleHash: 202 }] }),
    '22': leaf(22, 'Hunter', { collectibles: [{ collectibleHash: 203 }] }),
    '3509235358': leaf(3509235358, 'Mods', { presentationNodes: [{ presentationNodeHash: 23 }, { presentationNodeHash: 2154827630 }] }),
    '2154827630': leaf(2154827630, 'Legacy and Raid', { collectibles: [{ collectibleHash: 201 }] }),
    '23': leaf(23, 'Head', { collectibles: [{ collectibleHash: 202 }] }),
  } }));
  await page.route('**/records.json', route => route.fulfill({ json: { ...records, '43': { ...records['43'], recordTypeName: 'Weapon Pattern' } } }));
  await page.goto(''); await ready(page);
  const section = page.getByRole('region', { name: 'Other', exact: true });
  await expect(section.locator('.seal-card')).toHaveCount(8);
  await expect(section.locator('a[href="#/triumphs/exotic_weapons"]')).toContainText('2 items');
  for (const [id, name, group] of [['catalysts', 'Catalysts', 'Kinetic Weapons'], ['patterns', 'Patterns', 'Auto Rifles'], ['exotic_weapons', 'Exotic weapons', 'Kinetic'], ['exotic_armor', 'Exotic armor', 'Titan'], ['mods', 'Mods', 'Head']]) {
    await page.goto(`#/triumphs/${id}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
    await expect(page.locator('.category-header-row')).toContainText(group);
    await expect(page.locator('tbody tr')).toHaveCount(3);
    await expect(page.locator('thead')).not.toContainText('Requirements');
    if (id === 'mods') await expect(page.locator('.category-header-row')).toContainText('Last Wish');
    if (id === 'patterns') {
      await page.getByRole('button', { name: 'Second challenge', exact: true }).hover();
      await expect(page.getByRole('tooltip')).toContainText('1 pattern');
    } else if (id === 'exotic_weapons') {
      await expect(page.getByRole('columnheader', { name: 'Collected', exact: true })).toBeVisible();
      await page.getByLabel('Filter progress').selectOption('complete');
      await expect(page.locator('tbody tr')).toHaveCount(1);
      await expect(page.locator('tbody tr')).toContainText('Ada');
      await page.getByLabel('Filter progress').selectOption('all');
    }
  }
  await page.reload(); await ready(page);
  await expect(page.locator('.category-header-row')).toContainText('Head');
});

test('catalysts omit insertion columns while retaining full tooltips and original stage numbers', async ({ page }) => {
  await setup(page, { offline: false, calls: 0 });
  await page.route('**/nodes.json', route => route.fulfill({ json: { ...nodes, '2744330515': { hash: 2744330515, displayProperties: { name: 'Kinetic Weapons' }, children: { records: [{ recordHash: 42 }, { recordHash: 43 }] } } } }));
  await page.route('**/records.json', route => route.fulfill({ json: { ...records,
    '42': { ...records['42'], recordTypeName: 'Exotic Catalysts' },
    '43': { ...records['43'], recordTypeName: 'Exotic Catalysts', objectiveHashes: [102, 104, 105] },
  } }));
  await page.route('**/objectives.json', route => route.fulfill({ json: { ...objectives,
    '101': { ...objectives['101'], progressDescription: 'Insert the Catalyst', completionValue: 2 },
    '102': { ...objectives['102'], progressDescription: 'Insert the Catalyst', completionValue: 2 },
    '104': { hash: 104, progressDescription: 'Kills', completionValue: 10 },
    '105': { hash: 105, progressDescription: 'Precision kills', completionValue: 10 },
  } }));
  await page.goto('#/triumphs/catalysts'); await ready(page);
  await expect(page.getByRole('button', { name: 'First challenge', exact: true }).locator('..')).toHaveAttribute('colspan', '1');
  await expect(page.locator('.objective-header-row th')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Stage 2: Kills', exact: true })).toHaveText('2');
  await expect(page.getByRole('button', { name: 'Stage 3: Precision kills', exact: true })).toHaveText('3');
  await expect(page.locator('.objective-header-row')).not.toContainText('Insert');
  const row = page.locator('tbody tr').filter({ hasText: 'Banshee' });
  await expect(row.locator(':scope > th, :scope > td')).toHaveCount(5);
  await expect(page.getByRole('button', { name: 'Banshee: First challenge: Final encounter: 5/10', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'First challenge', exact: true }).hover();
  await expect(page.getByRole('tooltip')).toContainText('Insert the Catalyst');
  await expect(page.getByRole('tooltip')).toContainText('Final encounter');
  await page.getByRole('button', { name: 'Banshee: First challenge: Final encounter: 5/10', exact: true }).hover();
  await expect(page.getByRole('tooltip')).toContainText('Insert the Catalyst');
});

test('exotic weapons merge duplicate collection entries and explain crafting availability per guardian', async ({ page }) => {
  await setup(page, { offline: false, calls: 0 });
  await page.route('**/nodes.json', route => route.fulfill({ json: { ...nodes, '2214408526': { hash: 2214408526, displayProperties: { name: 'Kinetic' }, children: { collectibles: [{ collectibleHash: 201 }, { collectibleHash: 204 }] } } } }));
  await page.route('**/collectibles.json', route => route.fulfill({ json: Object.fromEntries([201, 204].map(hash => [String(hash), { hash, itemHash: 301, scope: 0, displayProperties: { name: 'Raid weapon' } }])) }));
  await page.route('**/records.json', route => route.fulfill({ json: { ...records, '43': record(43, 'Raid weapon', { recordTypeName: 'Weapon Pattern', objectiveHashes: [102] }) } }));
  await page.route('**/Platform/Destiny2/3/Profile/*/*', route => {
    const member = members.find(m => route.request().url().includes(m.destinyUserInfo.membershipId))!;
    if (member.destinyUserInfo.displayName === 'Crow') return route.fulfill({ json: envelope({ profile: { privacy: 2 }, profileRecords: { privacy: 2 } }) });
    const crafted = member.destinyUserInfo.displayName === 'Ada';
    return route.fulfill({ json: envelope({ profile: { data: { userInfo: member.destinyUserInfo } }, profileRecords: { data: { records: { '43': { state: crafted ? 1 : 4 } } } }, profileCollectibles: { data: { collectibles: { '201': { state: crafted ? 0 : 1 }, '204': { state: crafted ? 1 : 0 } } } } }) });
  });
  await page.goto('#/triumphs/exotic_weapons'); await ready(page);
  await expect(page.locator('.record-heading')).toHaveCount(1);
  await expect(page.locator('.record-heading')).toHaveAttribute('data-collectible-hashes', '201 204');
  await expect(page.locator('.record-heading')).toContainText('Pattern available');
  await expect(page.locator('.armor-ownership-cell')).toHaveCount(0);
  for (const name of ['Ada', 'Banshee']) await expect(page.getByRole('button', { name: `${name}: Raid weapon: collected`, exact: true })).toHaveText('✓');
  await page.locator('.record-heading button').hover();
  await expect(page.getByRole('tooltip')).toContainText('This weapon has a crafting pattern.');
  await page.getByRole('button', { name: 'Ada: Raid weapon: collected', exact: true }).hover();
  await expect(page.getByRole('tooltip')).toContainText('Craftable version unlocked — pattern acquired.');
  await page.getByRole('button', { name: 'Banshee: Raid weapon: collected', exact: true }).hover();
  await expect(page.getByRole('tooltip')).toContainText('Craftable version not unlocked — pattern not acquired.');
  await page.getByRole('button', { name: 'Crow: Raid weapon: no collection data', exact: true }).hover();
  await expect(page.getByRole('tooltip')).toContainText('pattern status unavailable');
  await page.getByLabel('Filter progress').selectOption('complete');
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await page.reload(); await ready(page);
  await expect(page.locator('.record-heading')).toHaveCount(1);
});

test('miscellaneous badges and seals navigate correctly, and Moments editions share one Other seals page', async ({ page }) => {
  await setup(page, { offline: false, calls: 0, extended: true });
  const sealNode = (hash: number, name: string) => ({ hash, displayProperties: { name }, completionRecordHash: 99, children: { records: [{ recordHash: 42 }, { recordHash: 43 }] } });
  await page.route('**/nodes.json', route => route.fulfill({ json: { ...nodes,
    '2904806741': { hash: 2904806741, displayProperties: { name: 'Destinations: Red War' }, children: { presentationNodes: [{ presentationNodeHash: 4 }, { presentationNodeHash: 5 }] } },
    '4': { hash: 4, displayProperties: { name: 'Titan' }, children: { collectibles: [{ collectibleHash: 201 }, { collectibleHash: 202 }] } },
    '5': { hash: 5, displayProperties: { name: 'Hunter' }, children: { collectibles: [{ collectibleHash: 201 }, { collectibleHash: 203 }] } },
    '3680676656': sealNode(3680676656, 'Lore'),
    '1210906304': sealNode(1210906304, 'Monument of Triumph'),
    '1194128730': sealNode(1194128730, 'Moments of Triumph: MMXIX'),
    '4024048810': { hash: 4024048810, displayProperties: { name: 'Monument triumphs' }, children: { records: [{ recordHash: 44 }] } },
    '1881970629': { hash: 1881970629, displayProperties: { name: 'Legacy Titles' }, children: { presentationNodes: [{ presentationNodeHash: 3680676656 }, { presentationNodeHash: 1194128730 }] } },
  } }));
  await page.route('**/records.json', route => route.fulfill({ json: { ...records, '99': { ...records['99'], objectiveHashes: [106] }, '44': record(44, 'Additional Monument challenge') } }));
  await page.route('**/objectives.json', route => route.fulfill({ json: { ...objectives, '106': { hash: 106, completionValue: 1 } } }));
  await page.goto(''); await ready(page);
  const badges = page.getByRole('region', { name: 'Other badges', exact: true });
  await expect(badges.locator('.seal-card')).toHaveCount(7);
  await expect(page.getByRole('region', { name: 'Other seals', exact: true }).locator('.seal-card')).toHaveCount(5);
  await expect(page.getByRole('region', { name: 'Other seals', exact: true }).locator('a[href="#/seal/monument_of_triumph"]')).toHaveCount(1);
  const redWar = badges.locator('a[href="#/badge/destination_red_war_badge"]');
  await expect(redWar).toContainText('1 badge owners');
  await redWar.click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Destinations: Red War badge');
  await expect(page.getByRole('navigation', { name: 'Badge view' }).getByRole('link')).toHaveCount(1);
  await expect(page.getByRole('columnheader', { name: 'Collected', exact: true })).toBeVisible();
  await expect(page.locator('.title-tally')).toContainText('badge owners');
  await page.goto('#/seal/chronicler');
  await expect(page.locator('.page-heading .eyebrow')).toContainText('Other seals / Chronicler');
  await expect(page.locator('.legacy-notice')).toContainText('Legacy seal');
  await page.goto('#/seal/monument_of_triumph');
  const tabs = page.getByRole('navigation', { name: 'Seal view', exact: true });
  await expect(tabs.getByRole('link', { name: 'Monument', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(tabs.getByRole('link')).toHaveCount(8);
  await expect(page.locator('.heading-kind')).toHaveText(' seal');
  const requirements = page.getByRole('button', { name: 'Requirements', exact: true });
  await requirements.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await requirements.focus();
  await expect(page.getByRole('tooltip')).toContainText('1 of 2 triumphs required');
  await tabs.getByRole('link', { name: '2019', exact: true }).click();
  await expect(page.locator('.page-heading .eyebrow')).toHaveText('Other seals / Moments of Triumph / 2019');
  await expect(tabs.getByRole('link', { name: '2019', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('navigation', { name: 'Other seals', exact: true }).getByRole('link', { name: /Moments of Triumph/ })).toHaveAttribute('aria-current', 'page');
  await page.reload(); await ready(page);
  await expect(tabs.getByRole('link', { name: '2019', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('Monument uses normal gilded status marks and shared headers for the underlying categories', async ({ page }) => {
  await setup(page, { offline: false, calls: 0 });
  const node = (hash: number, name: string, children: object) => ({ hash, completionRecordHash: 99, displayProperties: { name }, children });
  await page.route('**/nodes.json', route => route.fulfill({ json: { ...nodes,
    '1210906304': node(1210906304, 'Monument of Triumph', { records: [{ recordHash: 42 }, { recordHash: 44 }] }),
    '4024048810': node(4024048810, 'Monument of Triumph', { presentationNodes: [{ presentationNodeHash: 3 }] }),
    '3': node(3, 'Worlds', { presentationNodes: [{ presentationNodeHash: 4 }, { presentationNodeHash: 5 }] }),
    '4': node(4, 'Vistas', { records: [{ recordHash: 45 }, { recordHash: 46 }] }),
    '5': node(5, 'Patrol', { records: [{ recordHash: 47 }] }),
  } }));
  await page.route('**/records.json', route => route.fulfill({ json: { ...records,
    '99': { ...records['99'], titleInfo: { titlesByGender: { Male: 'Immortal' }, gildingTrackingRecordHash: 43 } },
    '44': record(44, 'Category requirement'), '45': record(45, 'First vista'), '46': record(46, 'Second vista'), '47': record(47, 'A patrol'),
  } }));
  await page.goto('#/seal/monument_of_triumph'); await ready(page);
  await expect(page.getByRole('button', { name: 'Gilded', exact: true })).toBeVisible();
  await expect(page.locator('thead')).not.toContainText('Times gilded');
  await expect(page.getByRole('button', { name: 'Ada: Gilded: Immortal is gilded.', exact: true })).toHaveText('✓');
  await expect(page.getByRole('button', { name: 'Banshee: Gilded: Immortal is not gilded.', exact: true })).toHaveText('·');
  await expect(page.getByRole('button', { name: 'Crow: Gilded: Gilding status unavailable.', exact: true })).toHaveText('—');
  await page.getByRole('link', { name: 'Monument triumphs', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Monument of Triumph triumphs');
  const headers = page.locator('.category-header-row th');
  await expect(headers.filter({ hasText: 'Worlds: Vistas' })).toHaveAttribute('colspan', '2');
  await expect(headers.filter({ hasText: 'Worlds: Patrol' })).toHaveAttribute('colspan', '1');
  await expect(page.getByRole('button', { name: 'Banshee: Gilded: Immortal is not gilded.', exact: true })).toHaveText('·');
});


test('Lifetime is first in Other and exposes the current section tabs with nested record groups', async ({ page }) => {
  await setup(page, { offline: false, calls: 0 });
  const node = (hash: number, name: string, children: object) => ({ hash, displayProperties: { name }, children });
  await page.route('**/nodes.json', route => route.fulfill({ json: { ...nodes,
    '2956802394': node(2956802394, 'Lifetime', { presentationNodes: [{ presentationNodeHash: 1995818321 }, { presentationNodeHash: 3436349154 }] }),
    '1995818321': node(1995818321, 'New Light', { presentationNodes: [{ presentationNodeHash: 10 }] }),
    '10': node(10, 'Progression', { records: [{ recordHash: 42 }] }),
    '3436349154': node(3436349154, 'Titan', { records: [{ recordHash: 43 }] }),
  } }));
  await page.goto(''); await ready(page);
  const other = page.getByRole('region', { name: 'Other', exact: true });
  await expect(other.locator('.seal-card').first()).toHaveAttribute('href', '#/triumphs/lifetime');
  await expect(other.locator('.seal-card').first()).toContainText('2 triumphs');
  await other.locator('.seal-card').first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lifetime');
  const tabs = page.getByRole('navigation', { name: 'View', exact: true });
  await expect(tabs.getByRole('link')).toHaveCount(8);
  await expect(tabs.getByRole('link', { name: 'All lifetime', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.category-header-row')).toContainText('Progression');
  await expect(page.locator('.category-header-row')).toContainText('Titan');
  await page.getByRole('button', { name: 'Other', exact: true }).click();
  await page.getByRole('button', { name: 'Other', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Other', exact: true }).getByRole('link').first()).toHaveAttribute('href', '#/triumphs/lifetime');
  await tabs.getByRole('link', { name: 'Titan', exact: true }).click();
  await expect(page.locator('.page-heading .eyebrow')).toHaveText('Other / Lifetime / Titan');
  await expect(page.locator('thead')).not.toContainText('First challenge');
  await expect(page.locator('thead')).toContainText('Second challenge');
  await expect(page.getByRole('navigation', { name: 'Other', exact: true }).getByRole('link').first()).toHaveAttribute('aria-current', 'page');
  await page.reload(); await ready(page);
  await expect(tabs.getByRole('link', { name: 'Titan', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('unreadable profile diagnostics are logged and persist after retry and reload', async ({ page }) => {
  const state = { offline: false, calls: 0, activeMembers: false };
  await setup(page, state);
  let fail = false;
  const warnings: string[] = [];
  page.on('console', message => { if (message.type() === 'warning') warnings.push(message.text()); });
  await page.route('**/Platform/Destiny2/3/Profile/*/*', route => fail && route.request().url().includes(members[1]!.destinyUserInfo.membershipId)
    ? route.fulfill({ status: 502, contentType: 'text/html', body: '<html>Temporary gateway failure</html>' })
    : route.fallback());
  const diagnostics = () => page.evaluate(() => new Promise<{ history: { status: number; bodyExcerpt: string }[]; errorInfo?: { status: number }; error?: string }>((resolve, reject) => {
    const open = indexedDB.open('clan-seal-tracker-v1');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result, request = db.transaction('entries', 'readonly').objectStore('entries').getAll();
      request.onerror = () => { db.close(); reject(request.error); };
      request.onsuccess = () => {
        const rows = request.result;
        const profile = rows.find(e => e.key === 'profile:3_4611686018485645581');
        const result = { history: rows.filter(e => e.key.startsWith('diagnostic:')).map(e => e.value), errorInfo: profile?.errorInfo, error: profile?.error };
        db.close(); resolve(result);
      };
    };
  }));
  await page.goto('#/seal/last_wish'); await ready(page);
  fail = true;
  state.activeMembers = true;
  await page.getByRole('button', { name: 'Refresh data', exact: true }).click(); await ready(page);
  const failed = await diagnostics();
  expect(failed.error).toBe('Bungie returned an unreadable response.');
  expect(failed.errorInfo?.status).toBe(502);
  expect(failed.history).toHaveLength(1);
  expect(failed.history[0]?.bodyExcerpt).toContain('Temporary gateway failure');
  expect(warnings.some(message => message.includes('[Clan Seal Tracker] Request failed'))).toBe(true);
  fail = false;
  await page.getByRole('button', { name: 'Retry profile: Banshee', exact: true }).click(); await ready(page);
  const recovered = await diagnostics();
  expect(recovered.errorInfo).toBeUndefined();
  expect(recovered.history).toHaveLength(1);
  await page.reload(); await ready(page);
  expect((await diagnostics()).history).toHaveLength(1);
});

test('status text and pip share check times and the previous profile pass summary', async ({ page }) => {
  await setup(page, { offline: false, calls: 0 });
  await page.goto('#/seal/last_wish'); await ready(page);
  await page.locator('.status-heading').hover();
  const tip = page.getByRole('tooltip');
  await expect(tip).toContainText('Game definitions: just now');
  await expect(tip).toContainText('Clan roster: just now');
  await expect(tip).toContainText('0 members online');
  await expect(tip).toContainText('2 profiles refreshed');
  await expect(tip).toContainText('0 profiles already up to date');
  await expect(tip).toContainText('1 profile is private');
  await page.getByRole('button', { name: 'Refresh data', exact: true }).click(); await ready(page);
  await page.getByRole('button', { name: 'Record sync status', exact: true }).focus();
  await expect(tip).toContainText('0 profiles refreshed');
  await expect(tip).toContainText('2 profiles already up to date');
  await expect(tip).toContainText('1 profile is private');
  await expect(tip).toContainText('Sync status');
});

test('objective tooltips render Destiny symbols, keep unknown tokens, and load the symbol font', async ({ page }) => {
  await setup(page, { offline: false, calls: 0 });
  const label = '[Hand Cannon][Headshot] Precision [Future Weapon] [Disruption][Shield-Piercing][Stagger]';
  await page.route('**/records.json', route => route.fulfill({ json: {
    ...records, '42': { ...records['42'], displayProperties: { ...records['42'].displayProperties, description: 'Use [Finisher]. Press [Back] to open the mission summary.' } },
  } }));
  await page.route('**/objectives.json', route => route.fulfill({ json: {
    ...objectives, '101': { ...objectives['101'], progressDescription: label },
  } }));
  await page.goto('#/seal/last_wish'); await ready(page);
  const tip = page.getByRole('tooltip');
  for (const target of [page.getByRole('columnheader', { name: `Stage 1: ${label}`, exact: true }), page.getByRole('button', { name: `Banshee: First challenge: ${label}: 5/10`, exact: true })]) {
    await target.hover();
    await expect(tip.getByRole('img', { name: 'Hand Cannon', exact: true })).toBeVisible();
    await expect(tip.getByRole('img', { name: 'Headshot', exact: true })).toBeVisible();
    for (const name of ['Disruption', 'Shield-Piercing', 'Stagger']) await expect(tip.getByRole('img', { name, exact: true })).toBeVisible();
    await expect(tip.getByRole('img', { name: 'Finisher', exact: true })).toHaveCount(0);
    await expect(tip).toContainText('Use [Finisher].');
    await expect(tip.locator('.destiny-action')).toHaveText(['Mission summary']);
    await expect(tip).toContainText('[Future Weapon]');
    await expect(tip).not.toContainText('[Headshot]');
    await expect(tip).not.toContainText('[Hand Cannon]');
  }
  expect(await page.evaluate(async () => {
    await document.fonts.load('16px DestinySymbols', '\ue103\ue142');
    return document.fonts.check('16px DestinySymbols', '\ue103\ue142');
  })).toBe(true);
});

test('hidden members route shows tenure, linked platforms, ownership, and CSV export', async ({ page }) => {
  await setup(page, { offline: false, calls: 0 });
  await page.route('**/Platform/Destiny2/Manifest/', route => route.fulfill({ json: envelope({ version: 'test-manifest', jsonWorldComponentContentPaths: { en: {
    DestinyPresentationNodeDefinition: root + 'nodes.json', DestinyRecordDefinition: root + 'records.json', DestinyObjectiveDefinition: root + 'objectives.json', DestinyCollectibleDefinition: root + 'collectibles.json', DestinyInventoryItemLiteDefinition: root + 'items.json', DestinySandboxPerkDefinition: root + 'perks.json', DestinySeasonDefinition: root + 'seasons.json',
  } } }) }));
  await page.route('**/seasons.json', route => route.fulfill({ json: { '10': { seasonNumber: 10, displayProperties: { name: 'Season of the Worthy' } } } }));
  await page.route('**/Platform/Destiny2/3/Profile/*/*', route => {
    const member = members.find(m => route.request().url().includes(m.destinyUserInfo.membershipId))!;
    return route.fulfill({ json: envelope(member === members[2] ? { profile: { privacy: 2 }, profileRecords: { privacy: 2 } } : { profile: { data: { userInfo: member.destinyUserInfo, versionsOwned: 1025, seasonHashes: [10], eventCardHashesOwned: [3841872876] } }, profileRecords: { data: { records: {} } } }) });
  });
  await page.goto('members'); await ready(page);
  await expect(page.getByRole('heading', { name: 'Test Clan members', exact: true })).toBeVisible();
  await expect(page.locator('.members-table tbody tr')).toHaveCount(3);
  await expect(page.locator('.members-table tbody th')).toHaveText(['Crow', 'Ada', 'Banshee']);
  const ada = page.locator('.members-table tbody tr').filter({ has: page.getByRole('link', { name: 'Ada', exact: true }) });
  await expect(ada.getByLabel('The Final Shape: owned', { exact: true })).toHaveText('✓');
  await expect(ada.getByLabel('Season of the Worthy (10): owned', { exact: true })).toHaveText('✓');
  await expect(page.getByRole('columnheader', { name: 'Event cards', exact: true })).toHaveCount(0);
  await expect(ada).toContainText('Steam Guardian');
  await expect(page.locator('.seal-nav a[href="#/members"]')).toHaveCount(0);
  const groupBorders = await page.locator('.members-table .category-header-row th').evaluateAll(cells => cells.map(cell => getComputedStyle(cell).borderRightWidth));
  expect(groupBorders.every(width => width === '2px')).toBe(true);
  const columnBorders = await page.locator('.members-table .record-header-row th').evaluateAll(cells => cells.map(cell => ({ width: getComputedStyle(cell).borderRightWidth, grouped: cell.classList.contains('group-end') })));
  expect(columnBorders.every(cell => cell.width === (cell.grouped ? '2px' : '1px'))).toBe(true);
  const bodyBorders = await ada.locator('td').evaluateAll(cells => cells.map(cell => ({ width: getComputedStyle(cell).borderRightWidth, grouped: cell.classList.contains('group-end') })));
  expect(bodyBorders.every(cell => cell.width === (cell.grouped ? '2px' : '1px'))).toBe(true);
  await expect(page.locator('.members-table .record-header-row .group-end')).toHaveCount(4);
  await expect(ada.locator('.group-end')).toHaveCount(4);
  await page.getByLabel('Search members').fill('Ada');
  await expect(page.locator('.members-table tbody tr')).toHaveCount(1);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('members.csv');
  const { readFile } = await import('node:fs/promises');
  const csv = await readFile((await file.path())!, 'utf8');
  expect(csv).toContain('Bungie name');
  expect(csv).toContain('Ada');
  expect(csv).not.toContain('Banshee');
  expect(csv).not.toContain('Solstice');
  await page.goto('#/'); await ready(page);
  await page.goto('#/members'); await ready(page);
  await expect(page.getByRole('heading', { name: 'Test Clan members', exact: true })).toBeVisible();
});

test('members sticky header rows stay aligned and the name divider continues through the body', async ({ page }) => {
  await setup(page, { offline: false, calls: 0 });
  await page.goto('#/members'); await ready(page);
  const scroll = page.locator('.members-scroll');
  await expect(scroll).toHaveCSS('border-top-left-radius', '6px');
  await expect(page.locator('.members-table')).toHaveCSS('border-top-left-radius', '6px');
  await expect(page.locator('.members-table thead th').first()).toHaveCSS('border-top-left-radius', '5px');
  await scroll.evaluate(element => { element.style.maxHeight = '150px'; });
  const borders = await page.locator('.members-table .player-column').evaluateAll(cells => cells.map(cell => getComputedStyle(cell).borderRightWidth));
  expect(borders.every(width => width === '2px')).toBe(true);
  for (const top of [0, 4, 12, 40]) {
    await scroll.evaluate((element, top) => { element.scrollTop = top; }, top);
    const gap = await scroll.evaluate(element => {
      const group = element.querySelector('.category-header-row th[scope="colgroup"]')!.getBoundingClientRect();
      const column = element.querySelector('.record-header-row th')!.getBoundingClientRect();
      return column.top - group.bottom;
    });
    expect(Math.abs(gap)).toBeLessThanOrEqual(1);
  }
});

test('seal summary columns have normal dividers and the table clips rounded corners', async ({ page }) => {
  await setup(page, { offline: false, calls: 0 });
  await page.goto('#/seal/last_wish'); await ready(page);
  const widths = await page.locator('.table-scroll .progress-column').evaluateAll(cells => cells.map(cell => getComputedStyle(cell).borderRightWidth));
  expect(widths.every(width => width === '1px')).toBe(true);
  await expect(page.locator('.table-frame')).toHaveCSS('border-top-left-radius', '6px');
  await expect(page.locator('.table-frame')).toHaveCSS('overflow', 'hidden');
  await expect(page.locator('.table-scroll table')).toHaveCSS('border-top-left-radius', '6px');
  await expect(page.locator('.table-scroll thead th').first()).toHaveCSS('border-top-left-radius', '5px');
  await expect(page.locator('.table-scroll')).toHaveCSS('overflow-x', 'auto');
  for (const offset of [0, 30]) {
    await page.locator('.table-scroll').evaluate((element, offset) => { element.scrollLeft = offset; element.scrollTop = offset; }, offset);
    const cornerClipped = await page.locator('.table-frame').evaluate(frame => {
      const rect = frame.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + .5, rect.top + .5);
      return !hit || !frame.contains(hit);
    });
    expect(cornerClipped).toBe(true);
  }
});

test('members Guardians share a tooltip across class subcolumns and retain duplicate and missing classes', async ({ page }) => {
  await setup(page, { offline: false, calls: 0 });
  await page.route('**/Platform/Destiny2/3/Profile/*/*', route => {
    expect(new URL(route.request().url()).searchParams.get('components')?.split(',')).toContain('200');
    const member = members.find(m => route.request().url().includes(m.destinyUserInfo.membershipId))!;
    const characters = member === members[0] ? { data: {
      'titan-1': { classType: 0, light: 2005, dateLastPlayed: '2026-10-30T12:00:00Z' },
      'titan-2': { classType: 0, light: 1980, dateLastPlayed: '2026-10-29T12:00:00Z' },
    } } : member === members[1] ? { data: { hunter: { classType: 1, light: 1999 } } } : { privacy: 2 };
    return route.fulfill({ json: envelope({ profile: { data: { userInfo: member.destinyUserInfo } }, profileRecords: { data: { records: {} } }, characters }) });
  });
  await page.goto('#/members'); await ready(page);
  const ada = page.locator('.members-table tbody tr').filter({ has: page.getByRole('link', { name: 'Ada', exact: true }) });
  await expect(ada.locator('.guardian-power')).toHaveText(['2005', '·', '·']);
  const crow = page.locator('.members-table tbody tr').filter({ has: page.getByRole('link', { name: 'Crow', exact: true }) });
  await expect(crow.locator('.guardian-power')).toHaveText(['—', '—', '—']);
  const tip = page.getByRole('tooltip');
  const titan = ada.locator('.guardian-power').nth(0);
  await titan.evaluate(element => element.scrollIntoView({ inline: 'center', block: 'nearest' }));
  await titan.hover();
  await expect(tip.getByRole('table', { name: 'Guardians on this account' }).locator('tbody tr')).toHaveCount(2);
  await expect(tip.locator('tbody th')).toHaveText(['Titan', 'Titan']);
  await expect(tip).toContainText('2005'); await expect(tip).toContainText('1980');
  const position = await tip.boundingBox();
  await ada.locator('.guardian-power').nth(1).hover();
  expect(await tip.boundingBox()).toEqual(position);
  await ada.locator('.guardian-power').nth(2).getByRole('button').focus();
  await expect(tip.locator('tbody tr')).toHaveCount(2);
  await crow.locator('.guardian-power').first().hover();
  await expect(tip).toContainText('Guardian information is private.');
  await page.getByRole('columnheader', { name: 'Titan', exact: true }).getByRole('button').hover();
  await expect(tip).toContainText('Multiple guardians of the same class are listed separately.');
  const before = await tip.boundingBox();
  await page.getByRole('columnheader', { name: 'Hunter', exact: true }).getByRole('button').hover();
  expect(await tip.boundingBox()).toEqual(before);
});
