<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import RecordDetails from './RecordDetails.vue';
import ClassIcon from './ClassIcon.vue';
import CellConditions from './CellConditions.vue';
import ClanEmblem from './ClanEmblem.vue';
import GuardianDetails from './GuardianDetails.vue';
import config from '../.generated/config.json';
import catalogJson from '../.generated/catalog.json';
import { BungieTransport } from './api';
import { CacheStore } from './storage';
import { eachLimited, TrackerRepository } from './repository';
import { buildSeal, headingCell, bestBadgeClass, sealAwarded } from './domain';
import type { PageMode } from './domain';
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
const badgeClass = ref('best');
const badgeClasses = computed(() => selected.value?.headings.find(h => new Set(h.collectibleHashes).size > 1)?.classNames ?? []);
const preferencesReady = ref(false);
const sidebarCollapsed = ref(false);
const detail = shallowRef<{ player: string; heading: Heading; cell: Cell }>();
type TooltipContent = { kind: 'record'; player?: string; heading: Heading; cell?: Cell; groupKey?: string; objectiveHash?: string } | { kind: 'guardian'; guardian: PlayerData; memberships?: UserInfo[]; loading: boolean; error?: string } | { kind: 'sync' };
const tooltip = shallowRef<TooltipContent & { id: number; anchor: DOMRect; style: Record<string, string> }>();
const tooltipElement = ref<HTMLElement>();
const groupHeader = ref<HTMLElement>();
const topbar = ref<HTMLElement>();
let topbarObserver: ResizeObserver | undefined;
const groupHeaderHeight = ref(64);
const playerColumnWidth = ref(206);
let headerObserver: ResizeObserver | undefined;
let tooltipSerial = 0;
const objectiveColumns = (heading: Heading) => Math.max(1, heading.objectives.length);
const hasStages = computed(() => selected.value?.headings.some(h => objectiveColumns(h) > 1));
const columnGroups = computed(() => {
  const groups: { name: string; columns: number }[] = [];
  for (const heading of selected.value?.headings ?? []) {
    const name = heading.group ?? 'Triumphs';
    const last = groups.at(-1);
    if (last?.name === name) last.columns += objectiveColumns(heading);
    else groups.push({ name, columns: objectiveColumns(heading) });
  }
  return groups;
});
const hasColumnGroups = computed(() => columnGroups.value.some(g => g.name !== 'Triumphs'));
const headerRows = computed(() => 1 + Number(hasStages.value) + Number(hasColumnGroups.value));
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
function showTooltip(event: Event, heading: Heading, cell?: Cell, player?: string, objectiveHash?: string) {
  const element = (event.currentTarget as HTMLElement).closest<HTMLElement>('[data-record-tooltip]');
  const groupKey = element?.dataset.recordTooltip;
  if (groupKey && tooltip.value?.kind === 'record' && tooltip.value.groupKey === groupKey) {
    tooltip.value = { ...tooltip.value, objectiveHash };
    return;
  }
  const id = ++tooltipSerial;
  const parts = groupKey ? [...document.querySelectorAll<HTMLElement>('[data-record-tooltip]')].filter(el => el.dataset.recordTooltip === groupKey) : [event.currentTarget as HTMLElement];
  const bounds = parts.map(el => el.getBoundingClientRect());
  const left = Math.min(...bounds.map(r => r.left)), top = Math.min(...bounds.map(r => r.top));
  const right = Math.max(...bounds.map(r => r.right)), bottom = Math.max(...bounds.map(r => r.bottom));
  tooltip.value = { kind: 'record', heading, cell, player, groupKey, objectiveHash, id, anchor: new DOMRect(left, top, right - left, bottom - top), style: { left: '0px', top: '0px', visibility: 'hidden' } };
  void positionTooltip(id);
}
function leaveRecordTooltip(event: MouseEvent | FocusEvent) {
  const next = event.relatedTarget instanceof Element ? event.relatedTarget.closest<HTMLElement>('[data-record-tooltip]') : undefined;
  if (tooltip.value?.kind === 'record' && next?.dataset.recordTooltip === tooltip.value.groupKey) return;
  closeTooltip();
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
    headerObserver = new ResizeObserver(() => {
      groupHeaderHeight.value = element.getBoundingClientRect().height;
      const playerColumn = element.closest('table')?.querySelector('.player-column');
      if (playerColumn) playerColumnWidth.value = playerColumn.getBoundingClientRect().width;
    });
    headerObserver.observe(element);
    const playerColumn = element.closest('table')?.querySelector('.player-column');
    if (playerColumn) headerObserver.observe(playerColumn);
  }
});
const routeMode = computed<PageMode>(() => /^#\/(badge|raid|triumphs)\//.exec(hash.value)?.[1] as PageMode || 'seal');
const routeId = computed(() => /^#\/(?:seal|badge|raid|triumphs)\/(.+)$/.exec(hash.value)?.[1] ?? '');
const isHome = computed(() => !hash.value || hash.value === '#' || hash.value === '#/');
const seals = computed(() => definitions.value ? catalog.map(page => buildSeal(page, definitions.value!)) : []);
const catalogGroups = [{ name: 'Raids', pages: catalog.filter(p => p.category !== 'Activities') }, { name: 'Activities', pages: catalog.filter(p => p.category === 'Activities') }];
const sealsById = computed(() => Object.fromEntries(seals.value.map(s => [s.page.id, s])));
function pageMode(page: PageConfig): PageMode {
  if (routeMode.value === 'seal' || routeMode.value === 'badge' && page.badgeNodeHash) return routeMode.value;
  return page.category === 'Activities' ? 'triumphs' : 'raid';
}
const selected = computed(() => { const page = catalog.find(p => p.id === routeId.value); return page && definitions.value ? buildSeal(page, definitions.value, routeMode.value) : undefined; });
const pageModes = computed<PageMode[]>(() => selected.value ? ['seal', ...(selected.value.page.badgeNodeHash ? ['badge' as const] : []), selected.value.page.category === 'Activities' ? 'triumphs' : 'raid'] : []);
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
    const hasData = routeMode.value === 'badge' ? !!(p.profile?.profileCollectibles?.data || p.profile?.characterCollectibles?.data) : !!p.profile?.profileRecords?.data;
    const classIndex = badgeClass.value === 'best' ? bestBadgeClass(p.profile, seal.headings) : Math.max(0, Number(badgeClass.value));
    const cells = seal.headings.map(h => headingCell(p.profile, h, classIndex, seal.headings));
    const score = cells.reduce((sum, cell, i) => sum + (seal.headings[i]!.skip ? 0 : cell.fraction), 0);
    const fraction = scored.length ? score / scored.length : 0;
    return { id, ...p, name: nameOf(p), cells, fraction, hasData, complete: hasData && scored.length > 0 && fraction >= 1, earned: routeMode.value === 'badge' ? false : sealAwarded(p.profile, seal) };
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
      <ClanEmblem :emblem="roster?.emblem" :name="roster?.name ?? 'Clan'" />
      <p v-if="!sidebarCollapsed" class="eyebrow">YOUR CLAN</p>
      <h2 class="clan-name" :class="{ 'clan-name-short': (roster?.name.length ?? 0) <= 16 }">{{ roster?.name ?? (busy ? 'Loading clan…' : 'Clan unavailable') }}</h2>
      <div id="clan-menu" v-show="!sidebarCollapsed" class="sidebar-content">
      <p class="muted small">{{ roster ? `${roster.members.length} guardians` : busy ? 'Connecting to Bungie' : 'Check the connection notice' }}</p>
      <a href="#/" class="nav-home" :class="{ active: isHome }">Overview <span>↗</span></a>
      <template v-for="group in catalogGroups" :key="group.name">
      <p class="eyebrow nav-label">{{ group.name }}</p>
      <nav class="seal-nav" :aria-label="group.name">
        <a v-for="page in group.pages" :key="page.id" :href="`#/${pageMode(page)}/${page.id}`" :class="{ active: routeId === page.id }" :aria-current="routeId === page.id ? 'page' : undefined"><span>{{ page.name }}</span><svg class="nav-chevron" aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="m7 4 6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg></a>
      </nav>
      </template>
      <div class="sidebar-bottom"><span class="small">Stored in this browser</span><button class="text-button" :disabled="busy" @click="clearCache">Clear API cache</button></div>
      </div>
    </aside>
    <main id="main">
      <div v-if="issues.length || storageWarning" class="notice" role="alert"><p v-for="issue in issues" :key="issue">{{ issue }}</p><p v-if="storageWarning">{{ storageWarning }}</p><p v-if="definitions">Showing the last complete definitions{{ definitionsState === 'stale' ? ' (stale)' : '' }}. {{ rosterState === 'stale' ? 'The clan roster is also stale.' : '' }}</p></div>
      <template v-if="isHome">
        <section class="page-heading"><p class="eyebrow">THE NEXT TITLE IS A TEAM EFFORT</p><h1>Your clan. Every triumph.</h1><p class="lede">See who’s close, find a fireteam, and make the next run count.</p></section>
        <div class="overview-stats"><div><strong>{{ roster?.members.length ?? '—' }}</strong><span>Clan guardians</span></div><div><strong>{{ known.length }}</strong><span>Profiles with public data</span></div><div><strong>{{ seals.filter(s => !s.unavailable).length || '—' }}</strong><span>Seals to explore</span></div></div>
        <section v-for="group in catalogGroups" :key="group.name" class="catalog-section" :aria-label="group.name === 'Raids' ? 'Raid seals' : 'Activity seals'">
        <div class="section-title"><h2>{{ group.name === 'Raids' ? 'Raid seals' : 'Activity seals' }}</h2><p class="muted">A title worth chasing.</p></div>
        <div class="seal-grid">
          <a v-for="(page, i) in group.pages" :key="page.id" :href="`#/seal/${page.id}`" class="seal-card" :style="{ '--card-hue': `${135 + i * 22}` }">
            <span class="card-top"><span class="card-icon" aria-hidden="true">◇</span><span class="eyebrow">{{ group.name === 'Raids' ? 'RAID' : 'ACTIVITY' }} {{ String(i + 1).padStart(2, '0') }}</span></span>
            <h3>{{ sealsById[page.id]?.title ?? page.name }}</h3><p>{{ page.name }}</p>
            <div class="card-bottom"><span v-if="sealsById[page.id]?.unavailable">Unavailable in current manifest</span><span v-else-if="definitions">{{ titleCount(sealsById[page.id]!) }} title holders <span class="muted">/ {{ known.length }} loaded</span></span><span v-else>Loading definitions…</span><span aria-hidden="true">↗</span></div>
          </a>
        </div>
        </section>
        <p class="footnote">Counts cover loaded profiles, including any retained stale data. Choose a raid or activity to explore its seal and triumphs, with collection badges where available.</p>
      </template>
      <template v-else-if="selected && !selected.unavailable">
        <section class="page-heading seal-heading"><div><p class="eyebrow">{{ selected.page.name }} / {{ routeMode === 'badge' ? 'COLLECTION BADGE' : routeMode === 'raid' ? 'FULL RAID' : routeMode === 'triumphs' ? 'TRIUMPHS' : 'SEAL REQUIREMENTS' }}</p><h1>{{ selected.title }}</h1><p class="lede">{{ selected.description || 'Track every requirement, one guardian at a time.' }}</p></div><div v-if="routeMode !== 'badge'" class="title-tally"><strong>{{ titleCount(selected) }}</strong><span>title holders</span></div></section>
        <nav class="page-modes" :aria-label="selected.page.category === 'Activities' ? 'Activity view' : 'Raid view'"><a v-for="mode in pageModes" :key="mode" :href="`#/${mode}/${selected.page.id}`" :aria-current="routeMode === mode ? 'page' : undefined">{{ mode === 'seal' ? 'Seal' : mode === 'badge' ? 'Badge' : mode === 'triumphs' ? 'Triumphs' : 'Full raid' }}</a></nav>
        <div class="table-tools"><label class="search"><svg class="search-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg><input v-model="search" aria-label="Search guardians" placeholder="Search guardians…" type="search"></label><label class="select-control"><span class="sr-only">Filter progress</span><select v-model="filter" aria-label="Filter progress"><option value="all">All guardians</option><option value="incomplete">Requirements incomplete</option><option value="complete">Requirements complete</option><option value="unavailable">No public data</option></select></label><label class="select-control"><span class="sr-only">Sort guardians</span><select v-model="sort" aria-label="Sort guardians"><option value="progress">Closest next · completed last</option><option value="highest">Highest progress first</option><option value="name">Guardian name</option><option value="tenure">Clan tenure · longest first</option></select></label><label v-if="routeMode !== 'seal' && badgeClasses.length" class="select-control"><span class="sr-only">Badge class</span><select v-model="badgeClass" aria-label="Badge class"><option value="best">Best class set</option><option v-for="(name, i) in badgeClasses" :key="name" :value="String(i)">{{ name }} set</option></select></label></div>
        <div class="table-caption"><span>{{ rows.length }} guardians shown</span><span>✓ Complete <span class="legend-progress">●</span> In progress <span class="muted">— No record</span></span></div>
        <div class="table-scroll" tabindex="0" :aria-label="`Scrollable ${routeMode} progress table`" :style="{ '--group-header-height': `${groupHeaderHeight}px`, '--category-header-height': hasColumnGroups ? '32px' : '0px', '--player-column-width': `${playerColumnWidth}px` }" @scroll="closeTooltip">
          <table>
            <thead>
              <tr v-if="hasColumnGroups" class="category-header-row">
                <th scope="col" class="player-column" :rowspan="headerRows">Guardian</th><th scope="col" class="progress-column" :rowspan="headerRows">Requirements</th>
                <th v-for="(group, i) in columnGroups" :key="i" scope="colgroup" :colspan="group.columns"><span class="category-title">{{ group.name }}</span></th>
              </tr>
              <tr ref="groupHeader" class="record-header-row">
                <th v-if="!hasColumnGroups" scope="col" class="player-column" :rowspan="headerRows">Guardian</th>
                <th v-if="!hasColumnGroups" scope="col" class="progress-column" :rowspan="headerRows">Requirements</th>
                <th v-for="heading in selected.headings" :key="heading.hash" :scope="objectiveColumns(heading) > 1 ? 'colgroup' : 'col'" :colspan="objectiveColumns(heading)" :rowspan="hasStages && objectiveColumns(heading) === 1 ? 2 : 1" class="record-heading" :class="{ 'heading-gilding': heading.gilding, 'heading-unscored': heading.skip }" :data-record-tooltip="`header:${heading.hash}`" @mouseenter="showTooltip($event, heading)" @mouseleave="leaveRecordTooltip" @focusin="showTooltip($event, heading)" @focusout="leaveRecordTooltip">
                  <button class="heading-button" :aria-describedby="tooltip ? 'record-tooltip' : undefined" @keydown.esc="closeTooltip">{{ heading.label }}</button>
                  <svg v-if="heading.skip" class="unscored-marker" viewBox="0 0 16 16" role="img" aria-label="Not counted toward completion"><path d="m8 2 6 6-6 6-6-6Z" fill="none" stroke="currentColor" stroke-width="1.5" /></svg>
                </th>
              </tr>
              <tr v-if="hasStages" class="objective-header-row">
                <template v-for="heading in selected.headings" :key="heading.hash">
                  <th v-for="(objective, stage) in (objectiveColumns(heading) > 1 ? heading.objectives : [])" :key="objective.hash" scope="col" class="objective-heading" :class="{ 'record-end': stage === heading.objectives.length - 1 }" :data-record-tooltip="`header:${heading.hash}`" @mouseenter="showTooltip($event, heading, undefined, undefined, String(objective.hash))" @mouseleave="leaveRecordTooltip" @focusin="showTooltip($event, heading, undefined, undefined, String(objective.hash))" @focusout="leaveRecordTooltip"><button class="stage-button" :aria-label="`Stage ${stage + 1}: ${objective.progressDescription || objective.displayProperties?.description || heading.name}`" :aria-describedby="tooltip ? 'record-tooltip' : undefined" @keydown.esc="closeTooltip">{{ stage + 1 }}</button></th>
                </template>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.id" :class="{ 'row-complete': row.complete }">
                <th scope="row" class="player-column"><div class="guardian-row"><button class="guardian-button" :aria-label="`Guardian details: ${row.name}`" :aria-describedby="tooltip ? 'record-tooltip' : undefined" @mouseenter="showGuardianTooltip($event, row)" @mouseleave="closeTooltip" @focus="showGuardianTooltip($event, row)" @blur="closeTooltip" @keydown.esc="closeTooltip"><span class="player-name">{{ row.name }} <span v-if="row.earned" class="earned" aria-label="Title requirement complete">✦</span><span v-if="['stale', 'private', 'unavailable'].includes(row.status)" class="guardian-warning" :aria-label="statusLabel(row)">●</span></span></button><button v-if="['private', 'unavailable', 'stale'].includes(row.status)" class="retry" :disabled="busy" :aria-label="`Retry profile: ${row.name}`" @click="retryPlayer(row.id)">↻</button></div></th>
                <td class="progress-column"><template v-if="row.hasData"><strong>{{ Math.round(row.fraction * 100) }}<small>%</small></strong><span class="mini-progress"><span :style="{ width: `${row.fraction * 100}%` }"></span></span></template><span v-else class="muted">{{ row.status === 'loading' ? 'Loading…' : 'No data' }}</span></td>
                <template v-for="(cell, i) in row.cells" :key="selected.headings[i]!.hash">
                  <td v-if="cell.variants" class="record-end armor-ownership-cell" :class="{ 'cell-complete': cell.complete, 'cell-unclaimed': cell.unclaimed, 'cell-missing': cell.variants.every(v => v.missing) }" :data-record-tooltip="`player:${row.id}:${selected.headings[i]!.hash}`" @mouseenter="showTooltip($event, selected!.headings[i]!, cell, row.name)" @mouseleave="leaveRecordTooltip" @focusin="showTooltip($event, selected!.headings[i]!, cell, row.name)" @focusout="leaveRecordTooltip">
                    <button class="cell-button armor-ownership" :style="{ '--class-count': cell.variants.length }" :aria-describedby="tooltip ? 'record-tooltip' : undefined" :aria-label="`${row.name}: ${selected.headings[i]!.name}: ${cell.variants.some(v => v.complete) ? 'collected for ' + cell.variants.filter(v => v.complete).map(v => v.name).join(', ') : cell.variants.some(v => v.missing) ? 'collection data unavailable' : 'not collected'}`" @keydown.esc="closeTooltip" @click="showDetail(row.name, selected!.headings[i]!, cell)">
                      <span v-for="variant in cell.variants" :key="variant.name" class="class-slot" :data-class="variant.name"><ClassIcon v-if="variant.complete" :name="variant.name" :icon="variant.icon" /><span v-else-if="variant.missing" class="cell-missing" :aria-label="`${variant.name} data unavailable`">—</span></span>
                      <span v-if="cell.variants.every(v => !v.complete && !v.missing)" class="cell-zero ownership-empty">·</span>
                    </button>
                  </td>
                  <td v-else-if="cell.complete || !cell.objectives.length" :colspan="objectiveColumns(selected.headings[i]!)" :class="{ 'cell-complete': cell.complete, 'cell-unclaimed': cell.unclaimed, 'cell-progress': cell.fraction > 0 && !cell.complete, 'cell-missing': cell.missing, 'cell-zero': !cell.missing && cell.text === '·', 'cell-unowned': cell.unowned, 'cell-conditioned': !!cell.conditions?.length }" class="record-end" :data-record-tooltip="`player:${row.id}:${selected.headings[i]!.hash}`" @mouseenter="showTooltip($event, selected!.headings[i]!, cell, row.name)" @mouseleave="leaveRecordTooltip" @focusin="showTooltip($event, selected!.headings[i]!, cell, row.name)" @focusout="leaveRecordTooltip">
                    <button class="cell-button" :aria-describedby="tooltip ? 'record-tooltip' : undefined" :aria-label="`${row.name}: ${selected.headings[i]!.name}: ${cell.complete ? cell.unclaimed ? 'complete, unclaimed' : 'complete' : cell.missing ? 'no record' : 'incomplete'}`" @keydown.esc="closeTooltip" @click="showDetail(row.name, selected!.headings[i]!, cell)">{{ cell.text === '·' && cell.conditions?.some(c => c.code === 'hidden') ? '' : cell.text }}</button><CellConditions :conditions="cell.conditions" />
                  </td>
                  <template v-else>
                    <td v-for="(objective, j) in cell.objectives" :key="objective.hash" :class="{ 'cell-complete': objective.complete, 'cell-progress': objective.fraction > 0 && !objective.complete, 'cell-missing': objective.missing, 'cell-zero': !objective.missing && objective.text === '·', 'cell-unowned': cell.unowned, 'cell-conditioned': !!cell.conditions?.length, 'record-end': j === cell.objectives.length - 1 }" :data-record-tooltip="`player:${row.id}:${selected.headings[i]!.hash}`" @mouseenter="showTooltip($event, selected!.headings[i]!, cell, row.name, objective.hash)" @mouseleave="leaveRecordTooltip" @focusin="showTooltip($event, selected!.headings[i]!, cell, row.name, objective.hash)" @focusout="leaveRecordTooltip">
                      <button class="cell-button" :aria-describedby="tooltip ? 'record-tooltip' : undefined" :aria-label="`${row.name}: ${selected.headings[i]!.name}: ${objective.name}: ${objective.missing ? 'no record' : objective.complete ? 'complete' : `${objective.progress}/${objective.target}`}`" @keydown.esc="closeTooltip" @click="showDetail(row.name, selected!.headings[i]!, cell)">{{ objective.text === '·' && cell.conditions?.some(c => c.code === 'hidden') ? '' : objective.text }}</button><CellConditions :show-corner="j === cell.objectives.length - 1" :conditions="cell.conditions" />
                    </td>
                  </template>
                </template>
              </tr>
              <tr v-if="!rows.length"><td :colspan="tableColumns" class="empty-state">{{ !roster ? (busy ? 'Loading clan roster…' : 'Clan roster is unavailable. See the connection notice above.') : busy ? 'Loading guardians…' : 'No guardians match this view.' }}<button v-if="search || filter !== 'all'" class="text-button" @click="search = ''; filter = 'all'">Reset filters</button></td></tr>
            </tbody>
          </table>
        </div>
        <aside v-if="detail" class="detail-panel" aria-live="polite"><button class="detail-close" aria-label="Close record details" @click="detail = undefined">×</button><RecordDetails :heading="detail.heading" :cell="detail.cell" :player="detail.player" /></aside>
        <p class="footnote"><template v-if="routeMode === 'raid' || routeMode === 'badge'">Collection progress uses one whole class set (the most complete by default). Shared items count for every class. </template>Progress averages scored requirements.<template v-if="selected.page.category === 'Activities'"> Labelled gilding requirements are included in this view’s percentage.</template> Day-one triumphs do not affect the percentage. A missing record is shown separately from an incomplete one. Corner markers explain content locks and visibility conditions on hover. Click a cell for objective details.</p>
      </template>
      <section v-else-if="!isHome" class="empty-state"><h1>{{ selected?.unavailable ? selected.page.name : definitions ? 'Page not found' : 'Loading seal definitions…' }}</h1><p>{{ selected?.unavailable || (!definitions && !busy ? 'Definitions could not be loaded. Check the connection and retry.' : '') }}</p><a href="#/">Back to overview</a></section>
      <Teleport to="body">
        <div v-if="tooltip" id="record-tooltip" ref="tooltipElement" class="record-tooltip" role="tooltip" :style="tooltip.style"><RecordDetails v-if="tooltip.kind === 'record'" :heading="tooltip.heading" :cell="tooltip.cell" :player="tooltip.player" :active-objective-hash="tooltip.objectiveHash" /><GuardianDetails v-else-if="tooltip.kind === 'guardian'" :guardian="tooltip.guardian" :name="nameOf(tooltip.guardian)" :memberships="tooltip.memberships" :loading="tooltip.loading" :error="tooltip.error" :freshness="`${statusLabel(tooltip.guardian)} · ${age(tooltip.guardian.fetchedAt)}`" /><div v-else class="record-details sync-details"><h3>Sync status</h3><ul class="sync-legend"><li v-for="status in syncLegend" :key="status.color" :class="[`sync-${status.color}`, { current: syncColor === status.color }]"><span class="status-dot" aria-hidden="true"></span><div><span class="sync-legend-label">{{ status.label }}</span><p>{{ status.description }}</p></div></li></ul></div></div>
      </Teleport>
      <footer><span>CLAN SEAL TRACKER <span class="muted">/ JavaScript MVP</span></span><span>Public Bungie data · cached locally · not affiliated with Bungie</span></footer>
    </main>
  </div>
</template>
