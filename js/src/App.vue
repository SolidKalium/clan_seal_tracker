<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import RecordDetails from './RecordDetails.vue';
import GuardianDetails from './GuardianDetails.vue';
import config from '../.generated/config.json';
import catalogJson from '../.generated/catalog.json';
import { BungieTransport } from './api';
import { CacheStore } from './storage';
import { eachLimited, TrackerRepository } from './repository';
import { buildSeal, recordCell, selectRecord, sealAwarded } from './domain';
import { profileFresh } from './policy';
import { compareClanTenure } from './clan';
import type { Cell, Definitions, Heading, LoadResult, PageConfig, PlayerData, Profile, Roster, UserInfo } from './types';

const catalog = catalogJson as PageConfig[];
const store = new CacheStore();
const repository = new TrackerRepository(store, new BungieTransport(config.apiKey), config.clanId, config.language);
const definitions = shallowRef<Definitions>();
const roster = shallowRef<Roster>();
const players = shallowRef<Record<string, PlayerData>>({});
const busy = ref(true), phase = ref('Starting tracker…'), issues = ref<string[]>([]), storageWarning = ref('');
const rosterState = ref(''), definitionsState = ref('');
const profileSyncActive = ref(false), profileSyncDone = ref(0), profileSyncTotal = ref(0);
const hash = ref(window.location.hash);
const search = ref(''), filter = ref('all'), sort = ref('progress');
const preferencesReady = ref(false);
const sidebarCollapsed = ref(false);
const detail = shallowRef<{ player: string; heading: Heading; cell: Cell }>();
type TooltipContent = { kind: 'record'; player?: string; heading: Heading; cell?: Cell } | { kind: 'guardian'; guardian: PlayerData; memberships?: UserInfo[]; loading: boolean; error?: string } | { kind: 'sync' };
const tooltip = shallowRef<TooltipContent & { id: number; anchor: DOMRect; style: Record<string, string> }>();
const tooltipElement = ref<HTMLElement>();
const groupHeader = ref<HTMLElement>();
const topbar = ref<HTMLElement>();
let topbarObserver: ResizeObserver | undefined;
const groupHeaderHeight = ref(64);
let headerObserver: ResizeObserver | undefined;
let tooltipSerial = 0;
const objectiveColumns = (heading: Heading) => Math.max(1, heading.objectives.length);
const hasStages = computed(() => selected.value?.headings.some(h => objectiveColumns(h) > 1));
const tableColumns = computed(() => 2 + (selected.value?.headings.reduce((sum, h) => sum + objectiveColumns(h), 0) ?? 0));
function closeTooltip() { tooltip.value = undefined; }
async function positionTooltip(id: number) {
  await nextTick();
  const tip = tooltip.value;
  if (!tip || tip.id !== id || !tooltipElement.value) return;
  const rect = tip.anchor;
  const bounds = tooltipElement.value.getBoundingClientRect();
  const left = Math.max(10, Math.min(rect.left + rect.width / 2 - bounds.width / 2, window.innerWidth - bounds.width - 10));
  const top = rect.bottom + bounds.height + 12 < window.innerHeight ? rect.bottom + 8 : Math.max(10, rect.top - bounds.height - 8);
  tooltip.value = { ...tip, style: { left: `${left}px`, top: `${top}px`, visibility: 'visible' } };
}
async function openTooltip(event: Event, content: TooltipContent) {
  const id = ++tooltipSerial;
  tooltip.value = { ...content, id, anchor: (event.currentTarget as HTMLElement).getBoundingClientRect(), style: { left: '0px', top: '0px', visibility: 'hidden' } };
  await positionTooltip(id);
  return id;
}
function showTooltip(event: Event, heading: Heading, cell?: Cell, player?: string) {
  return openTooltip(event, { kind: 'record', heading, cell, player });
}
async function showGuardianTooltip(event: Event, guardian: PlayerData) {
  const id = await openTooltip(event, { kind: 'guardian', guardian, loading: true });
  try {
    const memberships = await repository.memberships(guardian.member.destinyUserInfo);
    if (tooltip.value?.id === id && tooltip.value.kind === 'guardian') tooltip.value = { ...tooltip.value, memberships, loading: false };
  } catch {
    if (tooltip.value?.id === id && tooltip.value.kind === 'guardian') tooltip.value = { ...tooltip.value, loading: false, error: 'Additional platform names are unavailable.' };
  }
  await positionTooltip(id);
}
watch(topbar, element => {
  topbarObserver?.disconnect();
  if (element) {
    topbarObserver = new ResizeObserver(() => document.documentElement.style.setProperty('--header-height', `${element.getBoundingClientRect().height}px`));
    topbarObserver.observe(element);
  }
});
watch(groupHeader, element => {
  headerObserver?.disconnect();
  if (element) {
    headerObserver = new ResizeObserver(() => { groupHeaderHeight.value = element.getBoundingClientRect().height; });
    headerObserver.observe(element);
  }
});
const routeId = computed(() => hash.value.startsWith('#/seal/') ? hash.value.slice(7) : '');
const isHome = computed(() => !hash.value || hash.value === '#' || hash.value === '#/');
const seals = computed(() => definitions.value ? catalog.map(page => buildSeal(page, definitions.value!)) : []);
const selected = computed(() => seals.value.find(seal => seal.page.id === routeId.value));
const known = computed(() => Object.values(players.value).filter(p => !!p.profile?.profileRecords?.data));
const resolved = computed(() => Object.values(players.value).filter(p => p.status !== 'loading').length);
const failedCount = computed(() => Object.values(players.value).filter(p => p.status === 'unavailable').length);
const staleCount = computed(() => Object.values(players.value).filter(p => p.status === 'stale' || p.status === 'private').length);
const syncColor = computed(() => busy.value ? 'amber' : issues.value.length || failedCount.value ? 'red' : staleCount.value || storageWarning.value ? 'amber' : 'green');
const syncLegend = [
  { color: 'green', label: 'Records synced', description: 'Available records are up to date.' },
  { color: 'amber', label: 'Updating or needs attention', description: 'Records are updating, stale, private, or stored only for this session.' },
  { color: 'red', label: 'Some records unavailable', description: 'A request failed. Check the error details or retry.' },
];

const nameOf = (p: PlayerData) => p.profile?.profile?.data?.userInfo.bungieGlobalDisplayName || p.member.destinyUserInfo.bungieGlobalDisplayName || p.member.destinyUserInfo.displayName;
const memberKey = (p: { destinyUserInfo: { membershipType: number; membershipId: string } }) => `${p.destinyUserInfo.membershipType}_${p.destinyUserInfo.membershipId}`;
const titleCount = (seal: typeof seals.value[number]) => known.value.filter(p => sealAwarded(p.profile, seal)).length;
const rows = computed(() => {
  const seal = selected.value;
  if (!seal) return [];
  const scored = seal.headings.filter(h => !h.skip);
  return Object.entries(players.value).map(([id, p]) => {
    const hasData = !!p.profile?.profileRecords?.data;
    const cells = seal.headings.map(h => recordCell(p.profile ? selectRecord(p.profile, h) : undefined, h));
    const score = cells.reduce((sum, cell, i) => sum + (seal.headings[i]!.skip ? 0 : cell.fraction), 0);
    const fraction = scored.length ? score / scored.length : 0;
    return { id, ...p, name: nameOf(p), cells, fraction, hasData, complete: hasData && scored.length > 0 && fraction >= 1, earned: sealAwarded(p.profile, seal) };
  }).filter(row => row.name.toLowerCase().includes(search.value.trim().toLowerCase()) && (filter.value === 'all' || (filter.value === 'complete' ? row.complete : filter.value === 'incomplete' ? row.hasData && !row.complete : !row.hasData)))
    .sort((a, b) => {
      if (sort.value === 'tenure') return compareClanTenure(a.member, b.member) || a.name.localeCompare(b.name);
      if (sort.value === 'name') return a.name.localeCompare(b.name);
      if (a.hasData !== b.hasData) return a.hasData ? -1 : 1;
      if (sort.value === 'progress' && a.complete !== b.complete) return a.complete ? 1 : -1;
      return b.fraction - a.fraction || a.name.localeCompare(b.name);
    });
});
const changedHash = () => { hash.value = window.location.hash; detail.value = undefined; closeTooltip(); };
const age = (time?: number) => {
  if (!time) return 'Not cached';
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60_000));
  return minutes < 1 ? 'just now' : minutes < 60 ? `${minutes}m ago` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ago` : `${Math.floor(minutes / 1440)}d ago`;
};
const statusLabel = (p: PlayerData) => p.status === 'private' && p.profile?.profileRecords?.data ? 'Private · older data' : p.status === 'private' ? 'Private' : p.status === 'unavailable' ? 'Unavailable' : p.status === 'loading' ? 'Loading' : p.status === 'stale' ? 'Stale' : 'Up to date';
function applyProfile(member: PlayerData['member'], result: LoadResult<Profile>) {
  players.value = { ...players.value, [memberKey(member)]: { member, profile: result.entry?.value, status: result.status, fetchedAt: result.entry?.fetchedAt, error: result.error } };
  storageWarning.value = store.warning;
}
async function hydrate(rosterValue: Roster) {
  const next: Record<string, PlayerData> = {};
  await Promise.all(rosterValue.members.map(async member => {
    const old = players.value[memberKey(member)];
    const entry = await store.get<Profile>(`profile:${memberKey(member)}`);
    next[memberKey(member)] = old ? { ...old, member } : entry ? { member, profile: entry.value, fetchedAt: entry.fetchedAt, error: entry.error, status: entry.private ? 'private' : profileFresh(entry, member) ? 'cached' : 'stale' } : { member, status: 'loading' };
  }));
  players.value = next;
}
function acceptDefinitions(result: LoadResult<Definitions>) {
  if (result.entry) definitions.value = result.entry.value;
  definitionsState.value = result.status;
}
function acceptRoster(result: LoadResult<Roster>) {
  if (result.entry) { roster.value = result.entry.value; void hydrate(result.entry.value); }
  rosterState.value = result.status;
}
async function load(force = false) {
  if (busy.value) return;
  busy.value = true; issues.value = []; profileSyncActive.value = false; profileSyncDone.value = 0; profileSyncTotal.value = 0; phase.value = 'Checking definitions and clan roster…';
  try {
    const [d, r] = await Promise.all([repository.definitions(acceptDefinitions, force), repository.roster(acceptRoster, force)]);
    acceptDefinitions(d);
    if (r.entry) { roster.value = r.entry.value; await hydrate(r.entry.value); }
    rosterState.value = r.status;
    issues.value = [d.error, r.error].filter((v): v is string => !!v);
    if (r.entry) {
      phase.value = 'Checking profiles…';
      profileSyncTotal.value = r.entry.value.members.length; profileSyncDone.value = 0; profileSyncActive.value = true;
      await eachLimited(r.entry.value.members, async member => {
        const result = await repository.profile(member, cached => applyProfile(member, cached), force);
        applyProfile(member, result);
        profileSyncDone.value++;
      });
    }
    phase.value = 'Ready';
  } catch {
    issues.value = [...issues.value, 'The tracker could not finish loading. Retry to continue.'];
    phase.value = 'Loading stopped';
  } finally { profileSyncActive.value = false; busy.value = false; storageWarning.value = store.warning; }
}
async function clearCache() {
  if (busy.value || !window.confirm('Clear cached Bungie data and download it again? Your filters and preferences will be kept.')) return;
  busy.value = true; phase.value = 'Clearing API cache…';
  try {
    await store.clearCache();
    definitions.value = undefined; roster.value = undefined; players.value = {}; detail.value = undefined;
  } finally { busy.value = false; }
  await load();
}
async function retryPlayer(id: string) {
  const player = players.value[id];
  if (!player || busy.value) return;
  busy.value = true; phase.value = 'Retrying profile…';
  try { applyProfile(player.member, await repository.profile(player.member, cached => applyProfile(player.member, cached), true)); }
  finally { busy.value = false; phase.value = 'Ready'; }
}
function showDetail(player: string, heading: Heading, cell: Cell) { closeTooltip(); detail.value = { player, heading, cell }; }
watch([search, filter, sort], () => { if (preferencesReady.value) void store.setPreference('table', { search: search.value, filter: filter.value, sort: sort.value }); });
watch(sidebarCollapsed, value => { closeTooltip(); if (preferencesReady.value) void store.setPreference('sidebarCollapsed', value); });
watch(selected, seal => { document.title = seal ? `${seal.title} · Clan Seal Tracker` : 'Clan Seal Tracker'; });
onMounted(async () => {
  window.addEventListener('hashchange', changedHash);
  window.addEventListener('resize', closeTooltip);
  window.addEventListener('scroll', closeTooltip);
  try {
    const preferences = await store.preference('table', { search: '', filter: 'all', sort: 'progress' });
    sidebarCollapsed.value = await store.preference('sidebarCollapsed', false) === true;
    search.value = typeof preferences.search === 'string' ? preferences.search : '';
    filter.value = ['all', 'complete', 'incomplete', 'unavailable'].includes(preferences.filter) ? preferences.filter : 'all';
    sort.value = ['progress', 'highest', 'name', 'tenure'].includes(preferences.sort) ? preferences.sort : 'progress';
  } finally { preferencesReady.value = true; busy.value = false; void load(); }
});
onUnmounted(() => { window.removeEventListener('hashchange', changedHash); window.removeEventListener('resize', closeTooltip); window.removeEventListener('scroll', closeTooltip); headerObserver?.disconnect(); topbarObserver?.disconnect(); closeTooltip(); });
</script>

<template>
  <header ref="topbar" class="topbar">
    <a href="#/" class="brand"><span class="brand-mark" aria-hidden="true">◇</span><span>CLAN <strong>SEAL TRACKER</strong></span></a>
    <div class="header-status">
      <section class="sync-strip" :class="{ 'sync-busy': busy }" role="status" aria-live="polite">

        <div class="status-copy"><div class="status-primary"><button class="sync-indicator" :class="[`sync-${syncColor}`, { 'is-updating': busy }]" aria-label="Record sync status" :aria-describedby="tooltip?.kind === 'sync' ? 'record-tooltip' : undefined" @mouseenter="openTooltip($event, { kind: 'sync' })" @mouseleave="closeTooltip" @focus="openTooltip($event, { kind: 'sync' })" @blur="closeTooltip" @keydown.esc="closeTooltip"><span class="status-dot" aria-hidden="true"></span></button><span class="status-heading">{{ busy ? 'Syncing records' : issues.length || failedCount ? 'Sync incomplete' : 'Records synced' }}</span></div><span class="status-counts"><template v-if="busy">{{ phase }}<span v-if="profileSyncActive"> · {{ profileSyncDone }} / {{ profileSyncTotal }} done</span></template><template v-else>{{ resolved }} / {{ roster?.members.length ?? '—' }} profiles<span v-if="staleCount"> · {{ staleCount }} stale / private</span><span v-if="failedCount"> · {{ failedCount }} unavailable</span></template></span></div>
      </section>
      <button class="refresh" :disabled="busy" :aria-label="busy ? 'Updating…' : 'Refresh data'" title="Refresh data" @click="load(true)"><span aria-hidden="true">↻</span><span class="refresh-label">{{ busy ? 'Updating…' : 'Refresh data' }}</span></button>
    </div>
  </header>
  <div class="shell" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <aside class="sidebar" aria-label="Clan navigation">
      <button class="sidebar-toggle" :aria-label="sidebarCollapsed ? 'Expand side menu' : 'Collapse side menu'" :aria-expanded="!sidebarCollapsed" aria-controls="clan-menu" :title="sidebarCollapsed ? 'Expand side menu' : 'Collapse side menu'" @click="sidebarCollapsed = !sidebarCollapsed"><svg viewBox="0 0 20 20" aria-hidden="true" :class="{ reversed: sidebarCollapsed }"><path d="m12 4-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg></button>
      <div class="clan-emblem" aria-hidden="true">◇<span>✦</span></div>
      <p v-if="!sidebarCollapsed" class="eyebrow">YOUR CLAN</p>
      <h2 class="clan-name" :class="{ 'clan-name-short': (roster?.name.length ?? 0) <= 16 }">{{ roster?.name ?? (busy ? 'Loading clan…' : 'Clan unavailable') }}</h2>
      <div id="clan-menu" v-show="!sidebarCollapsed" class="sidebar-content">
      <p class="muted small">{{ roster ? `${roster.members.length} guardians` : busy ? 'Connecting to Bungie' : 'Check the connection notice' }}</p>
      <a href="#/" class="nav-home" :class="{ active: isHome }">Overview <span>↗</span></a>
      <p class="eyebrow nav-label">RAID SEALS</p>
      <nav class="seal-nav">
        <a v-for="page in catalog" :key="page.id" :href="`#/seal/${page.id}`" :class="{ active: routeId === page.id }" :aria-current="routeId === page.id ? 'page' : undefined"><span>{{ page.name }}</span><svg class="nav-chevron" aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="m7 4 6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg></a>
      </nav>
      <div class="sidebar-bottom"><span class="small">Stored in this browser</span><button class="text-button" :disabled="busy" @click="clearCache">Clear API cache</button></div>
      </div>
    </aside>
    <main id="main">
      <div v-if="issues.length || storageWarning" class="notice" role="alert"><p v-for="issue in issues" :key="issue">{{ issue }}</p><p v-if="storageWarning">{{ storageWarning }}</p><p v-if="definitions">Showing the last complete definitions{{ definitionsState === 'stale' ? ' (stale)' : '' }}. {{ rosterState === 'stale' ? 'The clan roster is also stale.' : '' }}</p></div>
      <template v-if="isHome">
        <section class="page-heading"><p class="eyebrow">THE NEXT TITLE IS A TEAM EFFORT</p><h1>Your clan. Every triumph.</h1><p class="lede">See who’s close, find a fireteam, and make the next run count.</p></section>
        <div class="overview-stats"><div><strong>{{ roster?.members.length ?? '—' }}</strong><span>Clan guardians</span></div><div><strong>{{ known.length }}</strong><span>Profiles with public data</span></div><div><strong>{{ seals.filter(s => !s.unavailable).length || '—' }}</strong><span>Raid seals to explore</span></div></div>
        <div class="section-title"><h2>Raid seals</h2><p class="muted">A title worth chasing.</p></div>
        <div class="seal-grid">
          <a v-for="(page, i) in catalog" :key="page.id" :href="`#/seal/${page.id}`" class="seal-card" :style="{ '--card-hue': `${135 + i * 22}` }">
            <span class="card-top"><span class="card-icon" aria-hidden="true">◇</span><span class="eyebrow">RAID {{ String(i + 1).padStart(2, '0') }}</span></span>
            <h3>{{ seals[i]?.title ?? page.name }}</h3><p>{{ page.name }}</p>
            <div class="card-bottom"><span v-if="seals[i]?.unavailable">Unavailable in current manifest</span><span v-else-if="definitions">{{ titleCount(seals[i]!) }} title holders <span class="muted">/ {{ known.length }} loaded</span></span><span v-else>Loading definitions…</span><span aria-hidden="true">↗</span></div>
          </a>
        </div>
        <p class="footnote">Counts cover loaded profiles, including any retained stale data. This first release covers seal requirements; badges, extra triumphs, and other page types remain in the PHP version.</p>
      </template>
      <template v-else-if="selected && !selected.unavailable">
        <section class="page-heading seal-heading"><div><p class="eyebrow">{{ selected.page.name }} / SEAL REQUIREMENTS</p><h1>{{ selected.title }}</h1><p class="lede">{{ selected.description || 'Track every requirement, one guardian at a time.' }}</p></div><div class="title-tally"><strong>{{ titleCount(selected) }}</strong><span>title holders</span></div></section>
        <div class="table-tools"><label class="search"><svg class="search-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg><input v-model="search" aria-label="Search guardians" placeholder="Search guardians…" type="search"></label><label class="select-control"><span class="sr-only">Filter progress</span><select v-model="filter" aria-label="Filter progress"><option value="all">All guardians</option><option value="incomplete">Requirements incomplete</option><option value="complete">Requirements complete</option><option value="unavailable">No public data</option></select></label><label class="select-control"><span class="sr-only">Sort guardians</span><select v-model="sort" aria-label="Sort guardians"><option value="progress">Closest next · completed last</option><option value="highest">Highest progress first</option><option value="name">Guardian name</option><option value="tenure">Clan tenure · longest first</option></select></label></div>
        <div class="table-caption"><span>{{ rows.length }} guardians shown</span><span>✓ Complete <span class="legend-progress">●</span> In progress <span class="muted">— No record</span></span></div>
        <div class="table-scroll" tabindex="0" aria-label="Scrollable seal progress table" :style="{ '--group-header-height': `${groupHeaderHeight}px` }" @scroll="closeTooltip">
          <table>
            <thead>
              <tr ref="groupHeader" class="record-header-row">
                <th scope="col" class="player-column" :rowspan="hasStages ? 2 : 1">Guardian</th>
                <th scope="col" class="progress-column" :rowspan="hasStages ? 2 : 1">Requirements</th>
                <th v-for="heading in selected.headings" :key="heading.hash" :scope="objectiveColumns(heading) > 1 ? 'colgroup' : 'col'" :colspan="objectiveColumns(heading)" :rowspan="hasStages && objectiveColumns(heading) === 1 ? 2 : 1" class="record-heading">
                  <button class="heading-button" :aria-describedby="tooltip ? 'record-tooltip' : undefined" @mouseenter="showTooltip($event, heading)" @mouseleave="closeTooltip" @focus="showTooltip($event, heading)" @blur="closeTooltip" @keydown.esc="closeTooltip">{{ heading.label }}</button>
                  <small v-if="heading.gilding">Gilding</small>
                </th>
              </tr>
              <tr v-if="hasStages" class="objective-header-row">
                <template v-for="heading in selected.headings" :key="heading.hash">
                  <th v-for="(objective, stage) in (objectiveColumns(heading) > 1 ? heading.objectives : [])" :key="objective.hash" scope="col" class="objective-heading" :class="{ 'record-end': stage === heading.objectives.length - 1 }"><button class="stage-button" :aria-label="`Stage ${stage + 1}: ${objective.progressDescription || objective.displayProperties?.description || heading.name}`" :aria-describedby="tooltip ? 'record-tooltip' : undefined" @mouseenter="showTooltip($event, heading)" @mouseleave="closeTooltip" @focus="showTooltip($event, heading)" @blur="closeTooltip" @keydown.esc="closeTooltip">{{ stage + 1 }}</button></th>
                </template>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.id" :class="{ 'row-complete': row.complete }">
                <th scope="row" class="player-column"><div class="guardian-row"><button class="guardian-button" :aria-label="`Guardian details: ${row.name}`" :aria-describedby="tooltip ? 'record-tooltip' : undefined" @mouseenter="showGuardianTooltip($event, row)" @mouseleave="closeTooltip" @focus="showGuardianTooltip($event, row)" @blur="closeTooltip" @keydown.esc="closeTooltip"><span class="player-name">{{ row.name }} <span v-if="row.earned" class="earned" aria-label="Title requirement complete">✦</span><span v-if="['stale', 'private', 'unavailable'].includes(row.status)" class="guardian-warning" :aria-label="statusLabel(row)">●</span></span></button><button v-if="['private', 'unavailable', 'stale'].includes(row.status)" class="retry" :disabled="busy" :aria-label="`Retry profile: ${row.name}`" @click="retryPlayer(row.id)">↻</button></div></th>
                <td class="progress-column"><template v-if="row.hasData"><strong>{{ Math.round(row.fraction * 100) }}<small>%</small></strong><span class="mini-progress"><span :style="{ width: `${row.fraction * 100}%` }"></span></span></template><span v-else class="muted">{{ row.status === 'loading' ? 'Loading…' : 'No data' }}</span></td>
                <template v-for="(cell, i) in row.cells" :key="selected.headings[i]!.hash">
                  <td v-if="cell.complete || !cell.objectives.length" :colspan="objectiveColumns(selected.headings[i]!)" :class="{ 'cell-complete': cell.complete, 'cell-progress': cell.fraction > 0 && !cell.complete, 'cell-missing': cell.missing, 'cell-zero': !cell.missing && cell.text === '·', 'cell-unowned': cell.unowned }" class="record-end">
                    <button class="cell-button" :aria-describedby="tooltip ? 'record-tooltip' : undefined" :aria-label="`${row.name}: ${selected.headings[i]!.name}: ${cell.complete ? 'complete' : cell.missing ? 'no record' : 'incomplete'}`" @mouseenter="showTooltip($event, selected!.headings[i]!, cell, row.name)" @mouseleave="closeTooltip" @focus="showTooltip($event, selected!.headings[i]!, cell, row.name)" @blur="closeTooltip" @keydown.esc="closeTooltip" @click="showDetail(row.name, selected!.headings[i]!, cell)">{{ cell.text }}</button>
                  </td>
                  <template v-else>
                    <td v-for="(objective, j) in cell.objectives" :key="objective.hash" :class="{ 'cell-complete': objective.complete, 'cell-progress': objective.fraction > 0 && !objective.complete, 'cell-missing': objective.missing, 'cell-zero': !objective.missing && objective.text === '·', 'cell-unowned': cell.unowned, 'record-end': j === cell.objectives.length - 1 }">
                      <button class="cell-button" :aria-describedby="tooltip ? 'record-tooltip' : undefined" :aria-label="`${row.name}: ${selected.headings[i]!.name}: ${objective.name}: ${objective.missing ? 'no record' : objective.complete ? 'complete' : `${objective.progress}/${objective.target}`}`" @mouseenter="showTooltip($event, selected!.headings[i]!, cell, row.name)" @mouseleave="closeTooltip" @focus="showTooltip($event, selected!.headings[i]!, cell, row.name)" @blur="closeTooltip" @keydown.esc="closeTooltip" @click="showDetail(row.name, selected!.headings[i]!, cell)">{{ objective.text }}</button>
                    </td>
                  </template>
                </template>
              </tr>
              <tr v-if="!rows.length"><td :colspan="tableColumns" class="empty-state">{{ !roster ? (busy ? 'Loading clan roster…' : 'Clan roster is unavailable. See the connection notice above.') : busy ? 'Loading guardians…' : 'No guardians match this view.' }}<button v-if="search || filter !== 'all'" class="text-button" @click="search = ''; filter = 'all'">Reset filters</button></td></tr>
            </tbody>
          </table>
        </div>
        <aside v-if="detail" class="detail-panel" aria-live="polite"><button class="detail-close" aria-label="Close record details" @click="detail = undefined">×</button><RecordDetails :heading="detail.heading" :cell="detail.cell" :player="detail.player" /></aside>
        <p class="footnote">Progress averages each requirement’s objectives, matching the legacy calculation. A missing record is shown separately from an incomplete one. Click a cell for objective details.</p>
      </template>
      <section v-else-if="!isHome" class="empty-state"><h1>{{ selected?.unavailable ? selected.page.name : definitions ? 'Page not found' : 'Loading seal definitions…' }}</h1><p>{{ selected?.unavailable || (!definitions && !busy ? 'Definitions could not be loaded. Check the connection and retry.' : '') }}</p><a href="#/">Back to overview</a></section>
      <Teleport to="body">
        <div v-if="tooltip" id="record-tooltip" ref="tooltipElement" class="record-tooltip" role="tooltip" :style="tooltip.style"><RecordDetails v-if="tooltip.kind === 'record'" :heading="tooltip.heading" :cell="tooltip.cell" :player="tooltip.player" /><GuardianDetails v-else-if="tooltip.kind === 'guardian'" :guardian="tooltip.guardian" :name="nameOf(tooltip.guardian)" :memberships="tooltip.memberships" :loading="tooltip.loading" :error="tooltip.error" :freshness="`${statusLabel(tooltip.guardian)} · ${age(tooltip.guardian.fetchedAt)}`" /><div v-else class="record-details sync-details"><h3>Sync status</h3><ul class="sync-legend"><li v-for="status in syncLegend" :key="status.color" :class="[`sync-${status.color}`, { current: syncColor === status.color }]"><span class="status-dot" aria-hidden="true"></span><div><span class="sync-legend-label">{{ status.label }}</span><p>{{ status.description }}</p></div></li></ul></div></div>
      </Teleport>
      <footer><span>CLAN SEAL TRACKER <span class="muted">/ JavaScript MVP</span></span><span>Public Bungie data · cached locally · not affiliated with Bungie</span></footer>
    </main>
  </div>
</template>
