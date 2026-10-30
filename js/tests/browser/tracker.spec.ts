import { expect, test, type Page } from '@playwright/test';
const root = '/common/destiny2_content/';
const nodeHash = '1486062207';
const record = (hash: number, name: string, extra = {}) => ({ hash, displayProperties: { name, description: `${name} description` }, scope: 0, ...extra });
const nodes = { [nodeHash]: { hash: Number(nodeHash), displayProperties: { name: 'Last Wish' }, completionRecordHash: 99, children: { records: [{ recordHash: 42 }, { recordHash: 43 }] } } };
const records = { '99': record(99, 'Seal', { titleInfo: { titlesByGender: { Male: 'Rivensbane' } } }), '42': record(42, 'First challenge', { objectiveHashes: [101, 103] }), '43': record(43, 'Second challenge', { objectiveHashes: [102] }) };
const objectives = { '103': { hash: 103, completionValue: 10, progressDescription: 'Final encounter' }, '101': { hash: 101, completionValue: 10, progressDescription: 'Encounters' }, '102': { hash: 102, completionValue: 1, progressDescription: 'Challenge' } };
const members = ['Ada', 'Banshee', 'Crow'].map((name, i) => ({ destinyUserInfo: { membershipType: 3, membershipId: `461168601848564558${i}`, displayName: name, bungieGlobalDisplayName: name }, isOnline: false, lastOnlineStatusChange: '1', joinDate: ['2020-06-01T12:00:00Z', '2022-06-01T12:00:00Z', '2018-06-01T12:00:00Z'][i], memberType: [5, 3, 2][i] }));
const envelope = (Response: unknown) => ({ ErrorCode: 1, ErrorStatus: 'Success', ThrottleSeconds: 0, Response });
async function setup(page: Page, state: { offline: boolean; calls: number; originError?: boolean; delay?: number; profileGate?: Promise<void> }) {
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://www.bungie.net/**', async route => {
    const path = new URL(route.request().url()).pathname;
    state.calls++;
    if (state.delay) await new Promise(resolve => setTimeout(resolve, state.delay));
    if (state.offline) return route.abort('failed');
    if (state.originError && path.includes('/Members/')) return route.fulfill({ status: 500, json: { ErrorCode: 2107, ErrorStatus: 'OriginHeaderDoesNotMatchKey' } });
    if (path === '/Platform/Destiny2/Manifest/') return route.fulfill({ json: envelope({ version: 'test-manifest', jsonWorldComponentContentPaths: { en: { DestinyPresentationNodeDefinition: root + 'nodes.json', DestinyRecordDefinition: root + 'records.json', DestinyObjectiveDefinition: root + 'objectives.json' } } }) });
    if (path === root + 'nodes.json') return route.fulfill({ json: nodes });
    if (path === root + 'records.json') return route.fulfill({ json: records });
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
      return route.fulfill({ json: envelope({ profile: { data: { userInfo: member.destinyUserInfo } }, profileRecords: { data: { records: { '99': { state: complete ? 1 : 4 }, '42': { state: complete ? 1 : 4, objectives: [{ objectiveHash: 101, completionValue: 10, progress: complete ? 10 : 5, complete }, { objectiveHash: 103, completionValue: 10, progress: complete ? 10 : 5, complete }] }, '43': { state: complete ? 1 : 4, objectives: [{ objectiveHash: 102, completionValue: 1, progress: complete ? 1 : 0, complete }] } } } } }) });
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
  await expect(page.locator('.seal-nav')).toBeHidden();
  expect(await page.locator('main').evaluate(e => e.getBoundingClientRect().width)).toBeGreaterThan(width);
  await page.screenshot({ path: 'test-results/collapsed-sidebar.png', fullPage: true });
  await page.reload(); await ready(page);
  await expect(page.getByRole('button', { name: 'Expand side menu', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/mobile-collapsed-sidebar.png', fullPage: true });
  await page.getByRole('button', { name: 'Expand side menu', exact: true }).click();
  await expect(page.locator('.seal-nav')).toBeVisible();
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
