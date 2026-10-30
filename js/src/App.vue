<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import config from '../.generated/config.json';
import catalogJson from '../.generated/catalog.json';
import { BungieTransport } from './api';
import { CacheStore } from './storage';
import { eachLimited, TrackerRepository } from './repository';
import { buildSeal, recordCell, selectRecord, sealAwarded } from './domain';
import { profileFresh } from './policy';
import type { Definitions, Heading, LoadResult, PageConfig, PlayerData, Profile, Roster } from './types';

const catalog = catalogJson as PageConfig[];
const store = new CacheStore();
const repository = new TrackerRepository(store, new BungieTransport(config.apiKey), config.clanId, config.language);
const definitions = shallowRef<Definitions>();
const roster = shallowRef<Roster>();
const players = shallowRef<Record<string, PlayerData>>({});
const busy = ref(true), phase = ref('Starting tracker…'), issues = ref<string[]>([]), storageWarning = ref('');
const rosterState = ref(''), definitionsState = ref('');
const hash = ref(window.location.hash);
const search = ref(''), filter = ref('all'), sort = ref('progress');
const preferencesReady = ref(false);
const detail = ref<{ player: string; heading: string; text: string }>();
const routeId = computed(() => hash.value.startsWith('#/seal/') ? hash.value.slice(7) : '');
const isHome = computed(() => !hash.value || hash.value === '#' || hash.value === '#/');
const seals = computed(() => definitions.value ? catalog.map(page => buildSeal(page, definitions.value!)) : []);
const selected = computed(() => seals.value.find(seal => seal.page.id === routeId.value));
const known = computed(() => Object.values(players.value).filter(p => !!p.profile?.profileRecords?.data));
const resolved = computed(() => Object.values(players.value).filter(p => p.status !== 'loading').length);
const failedCount = computed(() => Object.values(players.value).filter(p => p.status === 'unavailable').length);
const staleCount = computed(() => Object.values(players.value).filter(p => p.status === 'stale' || p.status === 'private').length);
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
      if (sort.value === 'name') return a.name.localeCompare(b.name);
      if (a.hasData !== b.hasData) return a.hasData ? -1 : 1;
      if (sort.value === 'progress' && a.complete !== b.complete) return a.complete ? 1 : -1;
      return b.fraction - a.fraction || a.name.localeCompare(b.name);
    });
});
const changedHash = () => { hash.value = window.location.hash; detail.value = undefined; };
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
  busy.value = true; issues.value = []; phase.value = 'Loading definitions and clan roster…';
  try {
    const [d, r] = await Promise.all([repository.definitions(acceptDefinitions, force), repository.roster(acceptRoster, force)]);
    acceptDefinitions(d);
    if (r.entry) { roster.value = r.entry.value; await hydrate(r.entry.value); }
    rosterState.value = r.status;
    issues.value = [d.error, r.error].filter((v): v is string => !!v);
    if (r.entry) {
      phase.value = 'Updating public profiles…';
      await eachLimited(r.entry.value.members, async member => {
        const result = await repository.profile(member, cached => applyProfile(member, cached), force);
        applyProfile(member, result);
      });
    }
    phase.value = 'Ready';
  } catch {
    issues.value = [...issues.value, 'The tracker could not finish loading. Retry to continue.'];
    phase.value = 'Loading stopped';
  } finally { busy.value = false; storageWarning.value = store.warning; }
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
function showDetail(player: string, heading: Heading, text: string) { detail.value = { player, heading: heading.name, text }; }
watch([search, filter, sort], () => { if (preferencesReady.value) void store.setPreference('table', { search: search.value, filter: filter.value, sort: sort.value }); });
watch(selected, seal => { document.title = seal ? `${seal.title} · Clan Seal Tracker` : 'Clan Seal Tracker'; });
onMounted(async () => {
  window.addEventListener('hashchange', changedHash);
  try {
    const preferences = await store.preference('table', { search: '', filter: 'all', sort: 'progress' });
    search.value = typeof preferences.search === 'string' ? preferences.search : '';
    filter.value = ['all', 'complete', 'incomplete', 'unavailable'].includes(preferences.filter) ? preferences.filter : 'all';
    sort.value = ['progress', 'highest', 'name'].includes(preferences.sort) ? preferences.sort : 'progress';
  } finally { preferencesReady.value = true; busy.value = false; void load(); }
});
onUnmounted(() => window.removeEventListener('hashchange', changedHash));
</script>

<template>
  <header class="topbar">
    <a href="#/" class="brand"><span class="brand-mark" aria-hidden="true">◇</span><span>CLAN <strong>SEAL TRACKER</strong></span></a>
    <span class="version-tag">BROWSER EDITION <span class="live-dot"></span></span>
  </header>
  <div class="shell">
    <aside class="sidebar" aria-label="Clan navigation">
      <div class="clan-emblem" aria-hidden="true">◇<span>✦</span></div>
      <p class="eyebrow">YOUR CLAN</p>
      <h2>{{ roster?.name ?? (busy ? 'Loading clan…' : 'Clan unavailable') }}</h2>
      <p class="muted small">{{ roster ? `${roster.members.length} guardians` : busy ? 'Connecting to Bungie' : 'Check the connection notice' }}</p>
      <a href="#/" class="nav-home" :class="{ active: isHome }">Overview <span>↗</span></a>
      <p class="eyebrow nav-label">RAID SEALS</p>
      <nav class="seal-nav">
        <a v-for="page in catalog" :key="page.id" :href="`#/seal/${page.id}`" :class="{ active: routeId === page.id }" :aria-current="routeId === page.id ? 'page' : undefined"><span>{{ page.name }}</span><span aria-hidden="true">›</span></a>
      </nav>
      <div class="sidebar-bottom"><span class="small">Stored in this browser</span><button class="text-button" :disabled="busy" @click="clearCache">Clear API cache</button></div>
    </aside>
    <main id="main">
      <div class="utility-line"><span class="eyebrow">CLAN / {{ isHome ? 'OVERVIEW' : 'RAID SEALS' }}</span><button class="refresh" :disabled="busy" @click="load(true)"><span aria-hidden="true">↻</span> {{ busy ? 'Updating…' : 'Refresh data' }}</button></div>
      <section class="sync-strip" role="status" aria-live="polite"><span class="status-dot" :class="{ loading: busy }"></span><span>{{ busy ? phase : issues.length ? 'Using available data' : 'Cache ready' }}</span><span class="muted">{{ resolved }} / {{ roster?.members.length ?? '—' }} profiles checked</span><span v-if="staleCount" class="warning-text">{{ staleCount }} stale / private</span><span v-if="failedCount" class="warning-text">{{ failedCount }} unavailable</span></section>
      <div v-if="issues.length || storageWarning" class="notice" role="alert"><p v-for="issue in issues" :key="issue">{{ issue }}</p><p v-if="storageWarning">{{ storageWarning }}</p><p v-if="definitions">Showing the last complete definitions{{ definitionsState === 'stale' ? ' (stale)' : '' }}. {{ rosterState === 'stale' ? 'The clan roster is also stale.' : '' }}</p></div>
      <template v-if="isHome">
        <section class="page-heading"><p class="eyebrow">THE NEXT TITLE IS A TEAM EFFORT</p><h1>Your clan. Every triumph.</h1><p class="lede">See who’s close, find a fireteam, and make the next run count.</p></section>
        <div class="overview-stats"><div><strong>{{ roster?.members.length ?? '—' }}</strong><span>Clan guardians</span></div><div><strong>{{ known.length }}</strong><span>Profiles with public data</span></div><div><strong>{{ seals.filter(s => !s.unavailable).length || '—' }}</strong><span>Raid seals to explore</span></div></div>
        <div class="section-title"><h2>Raid seals</h2><p class="muted">A title worth chasing.</p></div>
        <div class="seal-grid">
          <a v-for="(page, i) in catalog" :key="page.id" :href="`#/seal/${page.id}`" class="seal-card" :style="{ '--card-hue': `${135 + i * 22}` }">
            <span class="card-top"><span class="card-icon" aria-hidden="true">◇</span><span class="eyebrow">RAID {{ String(i + 1).padStart(2, '0') }}</span></span>
            <h3>{{ seals[i]?.title ?? page.name }}</h3><p>{{ page.name }}</p>
            <div class="card-bottom"><span v-if="seals[i]?.unavailable">Unavailable in current manifest</span><span v-else-if="definitions">{{ titleCount(seals[i]!) }} known titles <span class="muted">/ {{ known.length }} loaded</span></span><span v-else>Loading definitions…</span><span aria-hidden="true">↗</span></div>
          </a>
        </div>
        <p class="footnote">Counts cover loaded profiles, including any retained stale data. This first release covers seal requirements; badges, extra triumphs, and other page types remain in the PHP version.</p>
      </template>
      <template v-else-if="selected && !selected.unavailable">
        <section class="page-heading seal-heading"><div><p class="eyebrow">{{ selected.page.name }} / SEAL REQUIREMENTS</p><h1>{{ selected.title }}</h1><p class="lede">{{ selected.description || 'Track every requirement, one guardian at a time.' }}</p></div><div class="title-tally"><strong>{{ titleCount(selected) }}</strong><span>known title holders</span></div></section>
        <div class="table-tools"><label class="search"><span aria-hidden="true">⌕</span><input v-model="search" aria-label="Search guardians" placeholder="Search guardians…" type="search"></label><label><span class="sr-only">Filter progress</span><select v-model="filter" aria-label="Filter progress"><option value="all">All guardians</option><option value="incomplete">Requirements incomplete</option><option value="complete">Requirements complete</option><option value="unavailable">No public data</option></select></label><label><span class="sr-only">Sort guardians</span><select v-model="sort" aria-label="Sort guardians"><option value="progress">Closest next · completed last</option><option value="highest">Highest progress first</option><option value="name">Guardian name</option></select></label></div>
        <div class="table-caption"><span>{{ rows.length }} guardians shown</span><span>✓ Complete <span class="legend-progress">●</span> In progress <span class="muted">— No record</span></span></div>
        <div class="table-scroll" tabindex="0" aria-label="Scrollable seal progress table">
          <table><thead><tr><th scope="col" class="player-column">Guardian</th><th scope="col" class="progress-column">Requirements</th><th v-for="heading in selected.headings" :key="heading.hash" scope="col" :title="`${heading.name}\n${heading.description}`"><span>{{ heading.label }}</span><small v-if="heading.gilding">Gilding</small><small v-if="heading.scope === 1">Per character</small></th></tr></thead>
            <tbody><tr v-for="row in rows" :key="row.id" :class="{ 'row-complete': row.complete }"><th scope="row" class="player-column"><span class="player-name">{{ row.name }} <span v-if="row.earned" class="earned" title="Title requirement complete" aria-label="Title requirement complete">✦</span></span><span class="player-meta" :class="{ 'warning-text': ['stale', 'private', 'unavailable'].includes(row.status) }" :title="row.error || age(row.fetchedAt)">{{ statusLabel(row) }}<span v-if="row.fetchedAt"> · {{ age(row.fetchedAt) }}</span></span><button v-if="['private', 'unavailable', 'stale'].includes(row.status)" class="retry" :disabled="busy" @click="retryPlayer(row.id)">Retry profile</button></th><td class="progress-column"><template v-if="row.hasData"><strong>{{ Math.round(row.fraction * 100) }}<small>%</small></strong><span class="mini-progress"><span :style="{ width: `${row.fraction * 100}%` }"></span></span></template><span v-else class="muted">{{ row.status === 'loading' ? 'Loading…' : 'No data' }}</span></td><td v-for="(cell, i) in row.cells" :key="selected.headings[i]!.hash" :class="{ 'cell-complete': cell.complete, 'cell-progress': cell.fraction > 0 && !cell.complete, 'cell-missing': cell.missing, 'cell-unowned': cell.unowned }"><button class="cell-button" :title="cell.detail" :aria-label="`${row.name}: ${selected.headings[i]!.name}: ${cell.complete ? 'complete' : cell.missing ? 'no record' : cell.text === '·' ? 'incomplete' : cell.text}`" @click="showDetail(row.name, selected!.headings[i]!, cell.detail)">{{ cell.text }}</button></td></tr><tr v-if="!rows.length"><td :colspan="selected.headings.length + 2" class="empty-state">{{ !roster ? (busy ? 'Loading clan roster…' : 'Clan roster is unavailable. See the connection notice above.') : busy ? 'Loading guardians…' : 'No guardians match this view.' }}<button v-if="search || filter !== 'all'" class="text-button" @click="search = ''; filter = 'all'">Reset filters</button></td></tr></tbody>
          </table>
        </div>
        <aside v-if="detail" class="detail-panel" aria-live="polite"><button class="detail-close" aria-label="Close record details" @click="detail = undefined">×</button><p class="eyebrow">{{ detail.player }}</p><h3>{{ detail.heading }}</h3><p class="detail-text">{{ detail.text }}</p></aside>
        <p class="footnote">Progress averages each requirement’s objectives, matching the legacy calculation. A missing record is shown separately from an incomplete one. Click a cell for objective details.</p>
      </template>
      <section v-else-if="!isHome" class="empty-state"><h1>{{ selected?.unavailable ? selected.page.name : definitions ? 'Page not found' : 'Loading seal definitions…' }}</h1><p>{{ selected?.unavailable || (!definitions && !busy ? 'Definitions could not be loaded. Check the connection and retry.' : '') }}</p><a href="#/">Back to overview</a></section>
      <footer><span>CLAN SEAL TRACKER <span class="muted">/ JavaScript MVP</span></span><span>Public Bungie data · cached locally · not affiliated with Bungie</span></footer>
    </main>
  </div>
</template>
