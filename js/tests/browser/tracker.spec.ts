import { expect, test, type Page } from '@playwright/test';
const root = '/common/destiny2_content/';
const nodeHash = '1486062207';
const record = (hash: number, name: string, extra = {}) => ({ hash, displayProperties: { name, description: `${name} description` }, scope: 0, ...extra });
const nodes = { [nodeHash]: { hash: Number(nodeHash), displayProperties: { name: 'Last Wish' }, completionRecordHash: 99, children: { records: [{ recordHash: 42 }, { recordHash: 43 }] } } };
const records = { '99': record(99, 'Seal', { titleInfo: { titlesByGender: { Male: 'Rivensbane' } } }), '42': record(42, 'First challenge', { objectiveHashes: [101, 103] }), '43': record(43, 'Second challenge', { objectiveHashes: [102] }) };
const objectives = { '103': { hash: 103, completionValue: 10, progressDescription: 'Final encounter' }, '101': { hash: 101, completionValue: 10, progressDescription: 'Encounters' }, '102': { hash: 102, completionValue: 1, progressDescription: 'Challenge' } };
const members = ['Ada', 'Banshee', 'Crow'].map((name, i) => ({ destinyUserInfo: { membershipType: 3, membershipId: `461168601848564558${i}`, displayName: name, bungieGlobalDisplayName: name }, isOnline: false, lastOnlineStatusChange: '1', joinDate: ['2020-06-01T12:00:00Z', '2022-06-01T12:00:00Z', '2018-06-01T12:00:00Z'][i], memberType: [5, 3, 2][i] }));
const envelope = (Response: unknown) => ({ ErrorCode: 1, ErrorStatus: 'Success', ThrottleSeconds: 0, Response });
async function setup(page: Page, state: { offline: boolean; calls: number; originError?: boolean; delay?: number; profileGate?: Promise<void>; extended?: boolean }) {
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://www.bungie.net/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (/\/icons\/test-(titan|hunter)\.png$/.test(path)) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><path fill="white" d="M16 4 28 26H4Z"/></svg>' });
    state.calls++;
    if (state.delay) await new Promise(resolve => setTimeout(resolve, state.delay));
    if (state.offline) return route.abort('failed');
    if (state.originError && path.includes('/Members/')) return route.fulfill({ status: 500, json: { ErrorCode: 2107, ErrorStatus: 'OriginHeaderDoesNotMatchKey' } });
    if (path === '/Platform/Destiny2/Manifest/') return route.fulfill({ json: envelope({ version: 'test-manifest', jsonWorldComponentContentPaths: { en: { DestinyPresentationNodeDefinition: root + 'nodes.json', DestinyRecordDefinition: root + 'records.json', DestinyObjectiveDefinition: root + 'objectives.json', DestinyCollectibleDefinition: root + 'collectibles.json', DestinyInventoryItemLiteDefinition: root + 'items.json', DestinySandboxPerkDefinition: root + 'perks.json' } } }) });
    if (path === root + 'nodes.json') return route.fulfill({ json: state.extended ? { ...nodes, '1525933460': { children: { records: [{ recordHash: 901 }, { recordHash: 902 }] } }, '1086048586': { displayProperties: { name: 'Badge', description: 'Raid collection' }, children: { presentationNodes: [{ presentationNodeHash: 4 }, { presentationNodeHash: 5 }] } }, '4': { displayProperties: { name: 'Titan', icon: root + 'icons/test-titan.png' }, children: { collectibles: [{ collectibleHash: 201 }, { collectibleHash: 202 }] } }, '5': { displayProperties: { name: 'Hunter', icon: root + 'icons/test-hunter.png' }, children: { collectibles: [{ collectibleHash: 201 }, { collectibleHash: 203 }] } } } : nodes });
    if (path === root + 'records.json') return route.fulfill({ json: state.extended ? { ...records, '901': record(901, 'Woven Wish', { displayProperties: { name: 'Woven Wish', description: 'Complete with a fireteam made entirely of Strand subclasses.' } }), '902': record(902, 'Day one', { displayProperties: { name: 'Day one', description: 'Complete within the first 24 hours of release.' } }) } : records });
    if (path === root + 'items.json') return route.fulfill({ json: { '301': { displayProperties: { name: 'Raid weapon' }, itemType: 3, itemTypeDisplayName: 'Scout Rifle' }, '302': { displayProperties: { name: 'Armor' }, itemType: 2, itemTypeDisplayName: 'Helmet' } } });
    if (path === root + 'perks.json') return route.fulfill({ json: { '401': { displayProperties: { name: 'Mod perk', description: 'Improves the augment.' } } } });
    if (path === root + 'collectibles.json') return route.fulfill({ json: { '201': { hash: 201, scope: 0, itemHash: 301, sourceString: 'Source: Last Wish Raid', displayProperties: { name: 'Raid weapon' } }, '202': { hash: 202, scope: 1, itemHash: 302, displayProperties: { name: 'Titan helmet' } }, '203': { hash: 203, scope: 1, itemHash: 302, displayProperties: { name: 'Hunter helmet' } } } });
    if (path === root + 'objectives.json') return route.fulfill({ json: objectives });
    if (path.includes('/Members/')) return route.fulfill({ json: envelope({ results: members, hasMore: false }) });
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
      return route.fulfill({ json: envelope({ profile: { data: { userInfo: member.destinyUserInfo } }, profileCollectibles: { data: { collectibles: { '201': { state: complete ? 0 : 1 }, '202': { state: complete ? 0 : 1 }, '203': { state: 0 } } } }, profileRecords: { data: { records: { '99': { state: complete ? 1 : 4 }, '42': { state: complete ? 1 : 4, objectives: [{ objectiveHash: 101, completionValue: 10, progress: complete ? 10 : 5, complete }, { objectiveHash: 103, completionValue: 10, progress: complete ? 10 : 5, complete }] }, '43': { state: complete ? 1 : 4, objectives: [{ objectiveHash: 102, completionValue: 1, progress: complete ? 1 : 0, complete }] } } } } }) });
    }
    throw new Error(`Unmocked API route: ${path}`);
  });
}
async function ready(page: Page) { await expect(page.getByRole('button', { name: 'Refresh data', exact: true })).toBeEnabled({ timeout: 20_000 }); }

test('clan overview, seal table, filters, sort, details, and persisted preferences', async ({ page }) => {
  const state = { offline: false, calls: 0 }; await setup(page, state);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(''); await ready(page);
  await expect(page.locator('.sidebar h2')).toHaveText('Test Clan');
  await expect(page.locator('.sync-strip')).toContainText('3 / 3');
  await page.locator('.seal-card').first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rivensbane');
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

test('warm reload needs no network, and failed refresh retains rows with stale labels', async ({ page }) => {
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
  await expect(page.getByRole('tooltip')).toContainText('Stale');
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
  await expect(page.getByRole('tooltip').getByRole('heading')).toHaveText('First challenge');
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
  expect(await page.locator('.sidebar').evaluate(e => e.getBoundingClientRect().height)).toBeLessThan(220);
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
  const state: { offline: boolean; calls: number; profileGate?: Promise<void> } = { offline: false, calls: 0 };
  await setup(page, state); await page.goto('#/seal/last_wish'); await ready(page);
  await expect(page.locator('.status-counts')).toContainText('3 / 3 profiles');
  let finish!: () => void;
  state.profileGate = new Promise<void>(resolve => { finish = resolve; });
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
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Last Wish badge');
  await expect(page.locator('thead')).toContainText('Raid weapon');
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
  await expect(armor.getByRole('row').nth(2)).toHaveText('Set Complete');
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
  await expect(page.locator('thead')).toContainText('Not scored');
  await expect(page.locator('thead')).toContainText('Raid weapon');
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
  await expect(page.getByRole('region', { name: 'Raid seals', exact: true }).locator('.seal-card')).toHaveCount(10);
  await expect(page.getByRole('region', { name: 'Activity seals', exact: true }).locator('.seal-card')).toHaveCount(6);
  for (const raid of additions) {
    await page.locator('.seal-nav').getByRole('link', { name: raid.name, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(raid.title);
    const views = page.getByRole('navigation', { name: 'Raid view' });
    await views.getByRole('link', { name: 'Badge', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(raid.name + ' badge');
    await views.getByRole('link', { name: 'Full raid', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(raid.title);
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
  await expect(page.getByRole('region', { name: 'Activity seals', exact: true }).locator('.seal-card')).toHaveCount(6);
  for (const activity of activities) {
    await page.getByRole('navigation', { name: 'Activities', exact: true }).getByRole('link', { name: activity.name, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(activity.title);
    const views = page.getByRole('navigation', { name: 'Activity view' });
    await expect(views.getByRole('link', { name: 'Badge', exact: true })).toHaveCount(activity.badge ? 1 : 0);
    await expect(page.locator('thead')).toContainText('Gilding');
    await expect(page.getByRole('button', { name: 'Extra activity triumph', exact: true })).toHaveCount(0);
    await views.getByRole('link', { name: 'Triumphs', exact: true }).click();
    await expect(page).toHaveURL(new RegExp('#/triumphs/' + activity.id + '$'));
    await expect(page.getByRole('button', { name: 'Extra activity triumph', exact: true })).toHaveCount(activity.extra ? 1 : 0);
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
  await expect(cell.locator('.condition-more')).toHaveText('+');
  await expect(page.locator('tbody tr').filter({ hasText: 'Banshee' }).locator('.cell-conditions')).toHaveCount(1);
  await button.hover();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip.locator('.record-conditions strong')).toHaveText(['Content locked', 'Hidden in game', 'Obscured in game']);
  await expect(tooltip).toContainText('such as required DLC');
  await expect(tooltip.locator('.objective-count').first()).toHaveText(/5\s*\/\s*10/);
  await expect(page.locator('tbody tr').filter({ hasText: 'Banshee' }).locator('.progress-column')).toContainText('75');
  await expect(page.locator('tbody tr').filter({ hasText: 'Ada' }).locator('.cell-conditions')).toHaveCount(0);
});
