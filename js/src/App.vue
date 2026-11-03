<script setup lang="ts">
import FriendIcon from './FriendIcon.vue';
import PlayerAffiliations from './PlayerAffiliations.vue';
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import { clanMembershipPlatform } from './members';
import { FriendDirectory, type FriendClan } from './friends';
import { PlayerLogin, type PlayerAccount } from './auth';
import RecordDetails from './RecordDetails.vue';
import MembersPage from './MembersPage.vue';
import ClanPicker from './ClanPicker.vue';
import { ClanDirectory, readClanSelection, recentClans, type ClanChoice } from './clanSearch';
import CharacterDetails from './CharacterDetails.vue';
import { displayObjectives } from './displayObjectives';
import ViewTabs from './ViewTabs.vue';
import CompletionDetails from './CompletionDetails.vue';
import { completionCounts } from './completion';
import { resolveStringVariables, playerStringVariables, resolveHeadingStrings, resolveSealStrings } from './stringVariables';
import type { CompletionCounts } from './completion';
import ClassIcon from './ClassIcon.vue';
import SealWatermark from './SealWatermark.vue';
import CellConditions from './CellConditions.vue';
import ClanEmblem from './ClanEmblem.vue';
import GuardianDetails from './GuardianDetails.vue';
import config from '../.generated/config.json';
import catalogJson from '../.generated/catalog.json';
import { BungieTransport } from './api';
import { CacheStore } from './storage';
import { eachLimited, TrackerRepository } from './repository';
import { buildSeal, buildSealTemplate, selectRecord, headingCell, bestBadgeClass, badgeOwnership, formatClasses, sealAwarded } from './domain';
import type { PageMode, BadgeOwnership } from './domain';
import { profileFresh } from './policy';
import { combinePlayers, friendMembers, type PlayerList } from './playerLists';
import { collapseCrossSaveMembers, compareClanTenure } from './clan';
import type { Cell, Definitions, Heading, LoadResult, PageConfig, PlayerData, Profile, Roster, UserInfo, Seal } from './types';

const catalog = catalogJson as PageConfig[];
const store = new CacheStore();
const transport = new BungieTransport(config.apiKey, diagnostic => store.recordDiagnostic(diagnostic));
const account = shallowRef<PlayerAccount>();
const ownClan = shallowRef<ClanChoice>();
const loginNotice = ref('');
const playerList = ref<PlayerList>('clan');
const login = new PlayerLogin(config as { apiKey: string; oauthClientId?: string; oauthRedirectUri?: string }, undefined, message => { if (account.value) void signOut(message); else loginNotice.value = message; });
const friendDirectory = new FriendDirectory(login, transport);
const friendClans = shallowRef<FriendClan[]>([]);
const friendsLoading = ref(false), friendsError = ref('');
let friendsGeneration = 0;
let loginExpiryTimer: ReturnType<typeof setTimeout> | undefined;
const fallbackClan: ClanChoice = { id: config.clanId, name: `Clan ${config.clanId}` };
const clanSelection = shallowRef(readClanSelection(undefined, fallbackClan));
const clanPickerOpen = ref(false);
const clanDirectory = new ClanDirectory(transport);
let repository = new TrackerRepository(store, transport, config.clanId, config.language, login);
let clanGeneration = 0;
const passPreferenceKey = (id = repository.clanId) => playerList.value === 'clan' ? `lastProfilePass:v2:${id}` : `lastProfilePass:v3:${playerList.value}:${account.value?.membershipId}:${playerList.value === 'combined' ? ownClan.value?.id ?? 'none' : ''}`;
const definitions = shallowRef<Definitions>();
const roster = shallowRef<Roster>();
const players = shallowRef<Record<string, PlayerData>>({});
const displayedPlayers = computed(() => collapseCrossSaveMembers(Object.values(players.value)));
const linkedPlatforms = shallowRef<Record<string, UserInfo[]>>({});
const retryingPlayer = ref<string>();
const busy = ref(true), phase = ref('Starting tracker…'), issues = ref<string[]>([]), storageWarning = ref('');
const rosterState = ref(''), definitionsState = ref('');
const profileSyncActive = ref(false), profileSyncDone = ref(0), profileSyncTotal = ref(0);
const manifestCheckedAt = ref<number>(), clanCheckedAt = ref<number>();
const lastProfilePass = ref<{ completedAt: number; loaded: number; reused: number; private: number; unavailable: number }>();
const locationHash = () => window.location.hash || (/\/members\/?$/.test(window.location.pathname) ? '#/members' : '');
const hash = ref(locationHash());
const isMembers = computed(() => /^#\/members\/?$/.test(hash.value));
const search = ref(''), filter = ref('all'), sort = ref('progress');
const badgeClass = ref('best');
const badgeClasses = computed(() => selected.value?.headings.find(h => new Set(h.collectibleHashes).size > 1)?.classNames ?? []);
const preferencesReady = ref(false);
const sidebarCollapsed = ref(false);
const detail = shallowRef<{ player: string; heading: Heading; cell: Cell }>();
type TooltipContent = { kind: 'characters'; player?: PlayerData; groupKey: string } | { kind: 'record'; player?: string; heading: Heading; cell?: Cell; groupKey?: string; objectiveHash?: string } | { kind: 'guardian'; guardian: PlayerData; earnedTitle?: string; earnedBadge?: BadgeOwnership & { name: string }; memberships?: UserInfo[]; loading: boolean; error?: string } | { kind: 'summary'; seal: Seal; label: string; player?: string; counts?: CompletionCounts; badge: boolean; broader: boolean } | { kind: 'sync' } | { kind: 'note'; text: string };
const tooltip = shallowRef<TooltipContent & { id: number; anchor: DOMRect; style: Record<string, string> }>();
const tooltipElement = ref<HTMLElement>();
const groupHeader = ref<HTMLElement>();
const topbar = ref<HTMLElement>();
let topbarObserver: ResizeObserver | undefined;
const groupHeaderHeight = ref(64);
const playerColumnWidth = ref(206);
let headerObserver: ResizeObserver | undefined;
let tooltipSerial = 0;
function headingIdentifiers(heading: Heading) {
  return {
    ...(heading.checklist ? { 'data-checklist-hash': heading.checklist.hash, 'data-checklist-entry-hash': heading.checklist.entryHash } : heading.metric && heading.metric !== 'gildingCount' && heading.metric !== 'gilded' ? { 'data-metric-key': heading.metricKey } : heading.collectibleHashes
      ? { 'data-collectible-hashes': [...new Set(heading.alternativeCollectibleHashes ?? heading.collectibleHashes)].join(' ') }
      : { 'data-record-hash': heading.hash }),
    'data-objective-hashes': heading.objectives.map(o => o.hash).join(' ') || undefined,
  };
}
const objectiveColumns = (heading: Heading) => Math.max(1, displayObjectives(heading, heading.objectives).length);
const hasStages = computed(() => selected.value?.headings.some(h => objectiveColumns(h) > 1));
const columnGroups = computed(() => {
  const groups: { name: string; columns: number; color?: string }[] = [];
  for (const heading of selected.value?.headings ?? []) {
    const name = heading.group ?? 'Triumphs';
    const last = groups.at(-1);
    if (last?.name === name) last.columns += objectiveColumns(heading);
    else groups.push({ name, columns: objectiveColumns(heading), color: heading.color });
  }
  return groups;
});
const hasColumnGroups = computed(() => columnGroups.value.some(g => g.name !== 'Triumphs'));
const headerRows = computed(() => 1 + Number(hasStages.value) + Number(hasColumnGroups.value));
const tableColumns = computed(() => (metricView.value ? 1 : 2) + (selected.value?.headings.reduce((sum, h) => sum + objectiveColumns(h), 0) ?? 0));
function closeTooltip() { tooltip.value = undefined; }
async function positionTooltip(id: number) {
  await nextTick();
  const tip = tooltip.value;
  if (!tip || tip.id !== id || !tooltipElement.value) return;
  const rect = tip.anchor;
  const bounds = tooltipElement.value.getBoundingClientRect();
  const left = Math.max(10, Math.min(tip.kind === 'note' && rect.width === 0 ? rect.left + 12 : rect.left + rect.width / 2 - bounds.width / 2, window.innerWidth - bounds.width - 10));
  const top = rect.bottom + bounds.height + 12 < window.innerHeight ? rect.bottom + 8 : Math.max(10, rect.top - bounds.height - 8);
  tooltip.value = { ...tip, style: { left: `${left}px`, top: `${top}px`, visibility: 'visible' } };
}
async function openTooltip(event: Event, content: TooltipContent) {
  const id = ++tooltipSerial;
  const anchor = content.kind === 'note' && event instanceof MouseEvent
    ? new DOMRect(event.clientX, event.clientY, 0, 0)
    : (event.currentTarget as HTMLElement).getBoundingClientRect();
  tooltip.value = { ...content, id, anchor, style: { left: '0px', top: '0px', visibility: 'hidden' } };
  await positionTooltip(id);
  return id;
}
function showCharacterTooltip(event: Event, player?: PlayerData) {
  const element = (event.currentTarget as HTMLElement).closest<HTMLElement>('[data-character-group]')!;
  const groupKey = element.dataset.characterGroup!;
  if (tooltip.value?.kind === 'characters' && tooltip.value.groupKey === groupKey) return;
  const parts = [...element.closest('table')!.querySelectorAll<HTMLElement>('[data-character-group]')].filter(part => part.dataset.characterGroup === groupKey);
  const bounds = parts.map(part => part.getBoundingClientRect());
  const left = Math.min(...bounds.map(r => r.left)), top = Math.min(...bounds.map(r => r.top));
  const right = Math.max(...bounds.map(r => r.right)), bottom = Math.max(...bounds.map(r => r.bottom));
  const id = ++tooltipSerial;
  tooltip.value = { kind: 'characters', player, groupKey, id, anchor: new DOMRect(left, top, right - left, bottom - top), style: { left: '0px', top: '0px', visibility: 'hidden' } };
  void positionTooltip(id);
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
  const earnedTitle = selected.value && routeMode.value !== 'badge' && sealAwarded(guardian.profile, selected.value) ? selected.value.title : undefined;
  const badge = selected.value && routeMode.value === 'badge' ? badgeOwnership(guardian.profile, selected.value.headings) : undefined;
  const earnedBadge = badge?.completeClasses.length ? { ...badge, name: selected.value!.page.name } : undefined;
  const id = await openTooltip(event, { kind: 'guardian', guardian, earnedTitle, earnedBadge, loading: true });
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
const routeMode = computed<PageMode>(() => {
  const mode = /^#\/(badge|raid|triumphs)\//.exec(hash.value)?.[1] as PageMode || 'seal';
  const id = /^#\/(?:seal|badge|raid|triumphs)\/(.+)$/.exec(hash.value)?.[1];
  const page = catalog.find(p => p.id === id);
  if (page?.category === 'Other badges') return 'badge';
  if (mode === 'seal' && page && !page.sealNodeHash) return 'triumphs';
  return mode === 'triumphs' && page && hasDuplicateTriumphs(page) ? 'seal' : mode;
});
const routeId = computed(() => /^#\/(?:seal|badge|raid|triumphs)\/(.+)$/.exec(hash.value)?.[1] ?? '');
const groupedPage = computed(() => { const page = catalog.find(p => p.id === routeId.value); return page && (page.parentPageId || catalog.some(p => p.parentPageId === page.id)) ? catalog.find(p => p.id === (page.parentPageId ?? page.id)) : undefined; });
const pageEditions = computed(() => groupedPage.value ? [groupedPage.value, ...catalog.filter(p => p.parentPageId === groupedPage.value!.id).sort((a, b) => groupedPage.value?.category === 'Events' ? (b.tabLabel ?? '').localeCompare(a.tabLabel ?? '') : 0)] : []);
const isHome = computed(() => !hash.value || hash.value === '#' || hash.value === '#/');
const seals = computed(() => definitions.value ? catalog.map(page => buildSeal(page, definitions.value!, 'seal')) : []);
const catalogGroups = [
  { name: 'Raids', title: 'Raid seals', kind: 'Raid', category: 'Raid seals' },
  { name: 'Dungeons', title: 'Dungeons', kind: 'Dungeon', category: 'Dungeons' },
  { name: 'Exotic missions', title: 'Exotic missions', kind: 'Exotic mission', category: 'Exotic missions' },
  { name: 'Activities', title: 'Activity seals', kind: 'Activity', category: 'Activities' },
  { name: 'Expansions', title: 'Expansion seals', kind: 'Expansion', category: 'Expansions' },
  { name: 'Destinations', title: 'Destinations', kind: 'Destination', category: 'Destinations' },
  { name: 'Events', title: 'Events', kind: 'Event', category: 'Events' },
  { name: 'Seasons & Episodes', title: 'Seasons & Episodes', kind: 'Release', category: 'Seasons & Episodes' },
  { name: 'Other badges', title: 'Other badges', kind: 'Badge', category: 'Other badges' },
  { name: 'Other seals', title: 'Other seals', kind: 'Seal', category: 'Other seals' },
  { name: 'Other', title: 'Other', kind: 'Other', category: 'Other' },
].map((group, index) => ({ ...group, id: `sidebar-section-${index}`, pages: catalog.filter(p => p.category === group.category && !p.parentPageId) }));
const openSections = ref<string[]>([]);
watch(() => catalog.find(p => p.id === routeId.value)?.category, category => {
  openSections.value = [category ?? 'Raid seals'];
}, { immediate: true });
function toggleSection(category: string) {
  openSections.value = openSections.value.includes(category)
    ? openSections.value.filter(value => value !== category)
    : [...openSections.value, category];
}
const sealsById = computed(() => Object.fromEntries(seals.value.map(s => [s.page.id, s])));
function hasDuplicateTriumphs(page: PageConfig): boolean {
  if (!page.sealNodeHash || !definitions.value) return false;
  const seal = buildSeal(page, definitions.value), full = buildSeal(page, definitions.value, 'triumphs');
  return !seal.unavailable && !full.unavailable && seal.headings.length === full.headings.length
    && seal.headings.every(h => full.headings.some(other => other.hash === h.hash));
}
function pageMode(page: PageConfig): PageMode {
  if (page.category === 'Other badges') return 'badge';
  if (routeMode.value === 'seal' && page.sealNodeHash || routeMode.value === 'badge' && page.badgeNodeHash) return routeMode.value;
  return hasDuplicateTriumphs(page) ? 'seal' : ['Raid seals', 'Dungeons'].includes(page.category) && page.sealNodeHash ? 'raid' : 'triumphs';
}
const selectedTemplate = computed(() => { const page = catalog.find(p => p.id === routeId.value); return page && definitions.value ? buildSealTemplate(page, definitions.value, routeMode.value) : undefined; });
const selected = computed(() => selectedTemplate.value ? resolveSealStrings(selectedTemplate.value, {}) : undefined);
const currentPage = computed(() => catalog.find(p => p.id === routeId.value));
const viewPage = computed(() => groupedPage.value ?? currentPage.value);

const headingTitle = computed(() => routeMode.value === 'badge'
  ? resolveStringVariables(definitions.value?.nodes[currentPage.value?.badgeNodeHash ?? '']?.displayProperties.name || currentPage.value?.name || '')
  : routeMode.value === 'seal' ? selected.value?.title ?? viewPage.value?.name : currentPage.value?.id === 'monument_of_triumph' ? 'Monument of Triumph' : viewPage.value?.name);
const headingKind = computed(() => currentPage.value?.category === 'Other' && !currentPage.value?.sealNodeHash ? undefined : routeMode.value === 'badge' ? 'badge' : routeMode.value === 'seal' && currentPage.value?.sealNodeHash ? 'seal' : routeMode.value === 'triumphs' ? 'triumphs' : undefined);
const badgeOwnerCount = computed(() => selected.value ? displayedPlayers.value.filter(p => badgeOwnership(p.profile, selected.value!.headings).completeClasses.length > 0).length : 0);
const activeTriumphsOnly = computed(() => routeMode.value === 'triumphs' && !currentPage.value?.parentPageId && !selected.value?.legacy && pageEditions.value.some(page => page.parentPageId && sealsById.value[page.id]?.legacy));
const viewDescription = computed(() => currentPage.value?.category === 'Other' && !currentPage.value?.sealNodeHash || routeMode.value === 'seal' || routeMode.value === 'badge' ? selected.value?.description : '');
const breadcrumb = computed(() => {
  const page = viewPage.value;
  if (!page) return '';
  const category = catalogGroups.find(group => group.category === page.category)?.name ?? page.category;
  const view = currentPage.value?.tabLabel ?? ({ seal: 'Seal requirements', badge: 'Collection badge', raid: viewPage.value?.category === 'Dungeons' ? 'Full dungeon' : 'Full raid', triumphs: 'All triumphs' }[routeMode.value]);
  return `${category} / ${page.name} / ${view}`;
});
const viewLabel = computed(() => ({ 'Raid seals': 'Raid view', Activities: 'Activity view', Expansions: 'Expansion view', Destinations: 'Destination view', Events: 'Event view', Other: 'View', 'Other badges': 'Badge view', 'Other seals': 'Seal view', Dungeons: 'Dungeon view', 'Exotic missions': 'Exotic mission view' }[viewPage.value?.category ?? ''] ?? 'Seasonal view'));
const viewTabs = computed(() => {
  const page = viewPage.value;
  if (!page) return [];
  if (page.category === 'Other badges') return [{ href: `#/badge/${page.id}`, label: 'Badge', active: true }];
  const modes: PageMode[] = [...(page.sealNodeHash ? ['seal' as const] : []), ...(page.badgeNodeHash ? ['badge' as const] : []), ...(['Raid seals', 'Dungeons'].includes(page.category) && page.sealNodeHash ? ['raid' as const] : hasDuplicateTriumphs(page) ? [] : ['triumphs' as const])];
  return [...modes.map(mode => ({ href: `#/${mode}/${page.id}`, label: mode === 'seal' && page.tabLabel && pageEditions.value.length > 1 ? page.tabLabel : page.id === 'monument_of_triumph' && mode === 'triumphs' ? 'Monument triumphs' : page.tabLabel && !page.sealNodeHash ? page.tabLabel : mode === 'seal' ? 'Seal' : mode === 'badge' ? 'Badge' : mode === 'raid' ? page.category === 'Dungeons' ? 'Full dungeon' : 'Full raid' : 'All triumphs', active: routeId.value === page.id && routeMode.value === mode })), ...pageEditions.value.filter(tab => tab.parentPageId).map(tab => ({ href: `#/${tab.sealNodeHash ? 'seal' : 'triumphs'}/${tab.id}`, label: tab.tabLabel!, active: routeId.value === tab.id }))];
});
const metricView = computed(() => !!selected.value?.headings.length && selected.value.headings.every(h => h.metric && h.metric !== 'gildingCount' && h.metric !== 'gilded'));
watch(metricView, () => { if (['complete', 'incomplete'].includes(filter.value)) filter.value = 'all'; });
const collectionView = computed(() => routeMode.value === 'badge' || !!selected.value?.headings.length && !metricView.value && selected.value.headings.every(h => h.collectibleHashes || h.checklist || h.metric));
const summaryLabel = computed(() => collectionView.value ? 'Collected' : routeMode.value === 'seal' ? 'Requirements' : 'Completion');
function showSummary(event: Event, player?: string, counts?: CompletionCounts) {
  if (selected.value) void openTooltip(event, { kind: 'summary', seal: selected.value, label: summaryLabel.value, player, counts, badge: routeMode.value === 'badge', broader: routeMode.value === 'raid' || routeMode.value === 'triumphs' });
}
const known = computed(() => displayedPlayers.value.filter(p => !!p.profile?.profileRecords?.data));
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
function otherPageSummary(page: PageConfig): string {
  if (page.id === 'checklists') return `${1 + catalog.filter(p => p.parentPageId === page.id).length} checklists`;
  if (page.id === 'guardian_ranks') return 'Ranks and commendations';
  const seal = sealsById.value[page.id];
  if (!seal) return 'Loading definitions…';
  const unit = seal.headings.some(h => h.collectibleHashes) ? 'items' : page.kind === 'seals' ? 'seals' : page.id === 'patterns' ? 'patterns' : page.id === 'catalysts' ? 'catalysts' : 'triumphs';
  return `${seal.headings.length} ${unit}`;
}
const rows = computed(() => {
  const seal = selected.value;
  if (!seal) return [];
  const scored = seal.headings.filter(h => !h.skip);
  const gildingIndex = seal.headings.findIndex(h => h.metric === 'gildingCount' || h.metric === 'gilded');
  return displayedPlayers.value.map(p => {
    const id = memberKey(p.member);
    let hasData = routeMode.value === 'badge' ? !!(p.profile?.profileCollectibles?.data || p.profile?.characterCollectibles?.data) : !!p.profile?.profileRecords?.data;
    const classIndex = badgeClass.value === 'best' ? bestBadgeClass(p.profile, seal.headings) : Math.max(0, Number(badgeClass.value));
    const headings = (selectedTemplate.value?.headings ?? seal.headings).map(h => {
      const record = p.profile && selectRecord(p.profile, h);
      const characterId = h.scope === 1 && record ? Object.entries(p.profile?.characterRecords?.data ?? {}).find(([, character]) => character.records[h.hash] === record)?.[0] : undefined;
      return resolveHeadingStrings(h, playerStringVariables(p.profile, characterId));
    });
    const cells = headings.map(h => headingCell(p.profile, h, classIndex, headings, badgeClass.value === 'best' ? 'best' : 'selected'));
    if (seal.page.category === 'Other') hasData = cells.some(c => !c.missing);
    const metricValue = cells[0]?.missing ? -1 : Number(cells[0]?.text ?? -1);
    const score = cells.reduce((sum, cell, i) => sum + (seal.headings[i]!.skip ? 0 : cell.fraction), 0);
    const fraction = scored.length ? score / scored.length : 0;
    const gildings = gildingIndex >= 0 && !cells[gildingIndex]!.missing ? (seal.headings[gildingIndex]!.metric === 'gilded' ? Number(cells[gildingIndex]!.complete) : Number(cells[gildingIndex]!.text)) : -1;
    const badge = routeMode.value === 'badge' ? badgeOwnership(p.profile, seal.headings) : undefined;
    const earned = badge ? badge.completeClasses.length > 0 : sealAwarded(p.profile, seal);
    const earnedLabel = badge ? `${seal.page.name} badge collected on ${badge.allClasses ? 'all 3 classes' : formatClasses(badge.completeClasses)}` : `${seal.title} title earned`;
    return { id, ...p, badge, earned, earnedLabel, name: nameOf(p), headings, cells, counts: completionCounts(seal.headings, cells), fraction, gildings, metricValue, hasData, complete: hasData && scored.length > 0 && fraction >= 1 };
  }).filter(row => row.name.toLowerCase().includes(search.value.trim().toLowerCase()) && (filter.value === 'all' || (filter.value === 'complete' ? row.complete : filter.value === 'incomplete' ? row.hasData && !row.complete : !row.hasData)))
    .sort((a, b) => {
      if (sort.value === 'tenure') return compareClanTenure(a.member, b.member) || a.name.localeCompare(b.name);
      if (sort.value === 'name') return a.name.localeCompare(b.name);
      if (a.hasData !== b.hasData) return a.hasData ? -1 : 1;
      if (metricView.value) return b.metricValue - a.metricValue || a.name.localeCompare(b.name);
      if (sort.value === 'progress' && a.complete !== b.complete) return a.complete ? 1 : -1;
      return b.fraction - a.fraction || b.gildings - a.gildings || (b.badge?.completeClasses.length ?? 0) - (a.badge?.completeClasses.length ?? 0) || a.name.localeCompare(b.name);
    });
});
const changedHash = () => { hash.value = locationHash(); detail.value = undefined; closeTooltip(); };
const age = (time?: number) => {
  if (!time) return 'Not cached';
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60_000));
  return minutes < 1 ? 'just now' : minutes < 60 ? `${minutes}m ago` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ago` : `${Math.floor(minutes / 1440)}d ago`;
};
const statusLabel = (p: PlayerData) => p.status === 'private' && p.profile?.profileRecords?.data ? 'Private · older data' : p.status === 'private' ? 'Private' : p.status === 'unavailable' ? 'Unavailable' : p.status === 'loading' ? 'Loading' : p.status === 'stale' ? 'Stale' : 'Up to date';
function applyProfile(member: PlayerData['member'], result: LoadResult<Profile>) {
  const previous = players.value[memberKey(member)];
  if (previous && JSON.stringify(previous.member) === JSON.stringify(member) && previous.profile === result.entry?.value && (previous.status === result.status || result.status === 'cached' && previous.status === 'fresh') && previous.fetchedAt === result.entry?.fetchedAt && previous.error === result.error) return;
  players.value = { ...players.value, [memberKey(member)]: { member, profile: result.entry?.value, status: result.status, fetchedAt: result.entry?.fetchedAt, error: result.error } };
  storageWarning.value = store.warning;
}
async function loadClanPlatforms(value: Roster, generation: number, repo: TrackerRepository) {
  await eachLimited(value.members.filter(member => !member.destinyUserInfo.crossSaveOverride), async member => {
    const key = memberKey(member);
    if (generation !== clanGeneration || linkedPlatforms.value[key]) return;
    try {
      const memberships = await repo.memberships(member.destinyUserInfo);
      if (generation === clanGeneration) linkedPlatforms.value = { ...linkedPlatforms.value, [key]: memberships };
    } catch { /* Keep the unlabelled row until linked platforms can be checked. */ }
  });
}
async function hydrate(rosterValue: Roster) {
  const generation = clanGeneration;
  const current = Object.values(players.value);
  if (current.length === rosterValue.members.length && rosterValue.members.every(member => {
    const old = players.value[memberKey(member)];
    return old && JSON.stringify(old.member) === JSON.stringify(member);
  })) return;
  const next: Record<string, PlayerData> = {};
  await Promise.all(rosterValue.members.map(async member => {
    const old = players.value[memberKey(member)];
    const entry = await repository.cachedProfile(member);
    next[memberKey(member)] = old ? { ...old, member } : entry ? { member, profile: entry.value, fetchedAt: entry.fetchedAt, error: entry.error, status: entry.private ? 'private' : profileFresh(entry, member) ? 'cached' : 'stale' } : { member, status: 'loading' };
  }));
  if (generation === clanGeneration) players.value = next;
}
let rosterHydration: Promise<void> = Promise.resolve();
function acceptDefinitions(result: LoadResult<Definitions>) {
  if (result.entry) { definitions.value = result.entry.value; manifestCheckedAt.value = result.entry.fetchedAt; }
  definitionsState.value = result.status;
}
function acceptRoster(result: LoadResult<Roster>) {
  if (result.entry) { roster.value = result.entry.value; clanCheckedAt.value = result.entry.fetchedAt; rosterHydration = hydrate(result.entry.value); }
  rosterState.value = result.status;
}
async function listRoster(repo: TrackerRepository, force: boolean, generation: number): Promise<LoadResult<Roster>> {
  if (playerList.value === 'clan') return repo.roster(result => { if (generation === clanGeneration) acceptRoster(result); }, force);
  const mode = playerList.value;
  const clanRepo = ownClan.value ? new TrackerRepository(store, transport, ownClan.value.id, config.language, login) : undefined;
  const [clanResult, friendResult] = await Promise.all([
    mode === 'combined' && clanRepo ? clanRepo.roster(() => {}, force) : Promise.resolve(undefined),
    (async () => {
      try {
        const friends = await friendDirectory.friendList(force);
        const members = await friendMembers(friends, user => repo.memberships(user), () => generation === clanGeneration);
        return { members, error: undefined as string | undefined };
      } catch { return { members: roster.value?.members.filter(member => member.isFriend) ?? [], error: 'Friends could not be refreshed. Check ReadUserData permission and your connection, then retry.' }; }
    })(),
  ]);
  const errors = [clanResult?.error, friendResult.error, mode === 'combined' && !ownClan.value ? 'No clan was found for your account; showing friends.' : undefined].filter(Boolean).join(' ');
  const clan = clanResult?.entry?.value;
  const value: Roster = { name: mode === 'friends' ? `${account.value?.name ?? 'My'}’s friends` : clan?.name ?? ownClan.value?.name ?? 'My clan and friends', emblem: clan?.emblem,
    members: mode === 'combined' ? combinePlayers(clan?.members ?? [], friendResult.members) : friendResult.members };
  return { entry: { key: 'session-player-list', value, fetchedAt: mode === 'friends' ? friendDirectory.friendCheckedAt ?? Date.now() : clanResult?.entry?.fetchedAt ?? friendDirectory.friendCheckedAt ?? Date.now() }, status: errors ? 'stale' : 'fresh', error: errors || undefined };
}
async function changePlayerList(mode: PlayerList) {
  if (mode !== 'clan' && !account.value || !['clan', 'friends', 'combined'].includes(mode)) return;
  if (playerList.value === mode) return;
  const generation = ++clanGeneration;
  playerList.value = mode; closeTooltip(); detail.value = undefined;
  roster.value = undefined; players.value = {}; linkedPlatforms.value = {};
  rosterHydration = Promise.resolve(); lastProfilePass.value = undefined; clanCheckedAt.value = undefined;
  search.value = ''; filter.value = 'all'; issues.value = []; profileSyncActive.value = false; busy.value = false;
  await store.setPreference('playerList', mode);
  if (generation === clanGeneration) await load();
}
async function load(force = false) {
  if (busy.value) return;
  const generation = clanGeneration, repo = repository;
  const current = () => generation === clanGeneration;
  retryingPlayer.value = undefined;
  busy.value = true; issues.value = []; profileSyncActive.value = false; profileSyncDone.value = 0; profileSyncTotal.value = 0; phase.value = playerList.value === 'clan' ? 'Checking definitions and clan roster…' : 'Checking definitions and friends…';
  try {
    const [d, r] = await Promise.all([
      repo.definitions(result => { if (current()) acceptDefinitions(result); }, force),
      listRoster(repo, force, generation),
    ]);
    if (!current()) return;
    acceptDefinitions(d);
    await rosterHydration;
    if (!current()) return;
    if (r.entry) { roster.value = r.entry.value; clanCheckedAt.value = r.entry.fetchedAt; await hydrate(r.entry.value); }
    if (!current()) return;
    rosterState.value = r.status;
    issues.value = [d.error, r.error].filter((v): v is string => !!v);
    if (r.entry) {
      void loadClanPlatforms(r.entry.value, generation, repo);
      // Friend and combined lists must not replace the visitor's selected clan.
      if (playerList.value === 'clan') {
        const selectedClan = { ...clanSelection.value.selected, name: r.entry.value.name, memberCount: r.entry.value.members.length };
        clanSelection.value = { selected: selectedClan, recent: recentClans(clanSelection.value.recent, selectedClan) };
        await store.setPreference('clanSelection', clanSelection.value);
      }
      if (!current()) return;
      phase.value = 'Checking profiles…';
      profileSyncTotal.value = r.entry.value.members.length; profileSyncDone.value = 0; profileSyncActive.value = true;
      const pass = { completedAt: 0, loaded: 0, reused: 0, private: 0, unavailable: 0 };
      await eachLimited(r.entry.value.members, async member => {
        if (!current()) return;
        const result = await repo.profile(member, cached => { if (current()) applyProfile(member, cached); }, false, force);
        if (!current()) return;
        if (result.status === 'fresh') pass.loaded++;
        else if (result.status === 'cached') pass.reused++;
        else if (result.status === 'private') pass.private++;
        else pass.unavailable++;
        applyProfile(member, result);
        profileSyncDone.value++;
      });
      if (!current()) return;
      pass.completedAt = Date.now();
      if (force || pass.loaded || pass.private || pass.unavailable || !lastProfilePass.value) {
        lastProfilePass.value = pass;
        await store.setPreference(passPreferenceKey(repo.clanId), pass);
      }
    }
    if (current()) phase.value = 'Ready';
  } catch {
    if (current()) { issues.value = [...issues.value, 'The tracker could not finish loading. Retry to continue.']; phase.value = 'Loading stopped'; }
  } finally { if (current()) { profileSyncActive.value = false; busy.value = false; storageWarning.value = store.warning; } }
}
async function loadFriends(force = false) {
  if (!account.value || friendsLoading.value) return;
  const generation = friendsGeneration;
  friendsLoading.value = true; friendsError.value = '';
  try {
    const result = await friendDirectory.load(force);
    if (generation !== friendsGeneration) return;
    friendClans.value = result.clans;
    if (result.failed) friendsError.value = `Could not check clans for ${result.failed} friends. Other suggestions are available.`;
  } catch {
    if (generation === friendsGeneration) friendsError.value = 'Could not load friends. Enable ReadUserData in the Bungie app permissions and sign in again, or retry if this was a connection error.';
  } finally { if (generation === friendsGeneration) friendsLoading.value = false; }
}
watch(clanPickerOpen, open => { if (open) void loadFriends(); });
function signIn() {
  loginNotice.value = '';
  try { window.location.assign(login.begin()); }
  catch (error) { loginNotice.value = error instanceof Error ? error.message : 'Cannot start login.'; }
}
async function signOut(message = '') {
  clearTimeout(loginExpiryTimer);
  ++friendsGeneration; friendDirectory.clear(); friendClans.value = []; friendsLoading.value = false; friendsError.value = '';
  login.end(); playerList.value = 'clan'; account.value = undefined; ownClan.value = undefined; loginNotice.value = message;
  // Invalidate pending callbacks and remove every private value from the UI immediately.
  ++clanGeneration; closeTooltip(); detail.value = undefined; players.value = {};
  repository = new TrackerRepository(store, transport, clanSelection.value.selected.id, config.language, login);
  rosterHydration = Promise.resolve(); busy.value = false; profileSyncActive.value = false;
  await load();
}
function checkLoginExpiry() { if (account.value && (!login.expiresAt || login.expiresAt <= Date.now())) void signOut('Your login expired. Sign in again to access your private progression.'); }
async function selectClan(clan: ClanChoice) {
  clan = { id: clan.id, name: clan.name, memberCount: clan.memberCount };
  clanPickerOpen.value = false;
  if (clan.id === repository.clanId) { if (playerList.value !== 'clan') await changePlayerList('clan'); return; }
  const generation = ++clanGeneration;
  playerList.value = 'clan';
  closeTooltip(); detail.value = undefined;
  clanSelection.value = { selected: clan, recent: recentClans(clanSelection.value.recent, clan) };
  repository = new TrackerRepository(store, transport, clan.id, config.language, login);
  roster.value = undefined; players.value = {}; linkedPlatforms.value = {}; rosterState.value = ''; clanCheckedAt.value = undefined;
  lastProfilePass.value = undefined; rosterHydration = Promise.resolve();
  issues.value = []; profileSyncActive.value = false; profileSyncDone.value = 0; profileSyncTotal.value = 0;
  search.value = ''; filter.value = 'all';
  busy.value = true; phase.value = 'Loading clan…';
  await store.setPreference('playerList', 'clan');
  await store.setPreference('clanSelection', clanSelection.value);
  const pass = await store.preference<typeof lastProfilePass.value>(passPreferenceKey(), undefined);
  if (generation !== clanGeneration) return;
  lastProfilePass.value = pass; busy.value = false;
  await load();
}
async function clearCache() {
  if (busy.value || !window.confirm('Clear cached Bungie data and download it again? Your filters and preferences will be kept.')) return;
  const generation = clanGeneration, preferenceKey = passPreferenceKey();
  busy.value = true; phase.value = 'Clearing API cache…';
  try {
    await store.clearCache();
    await login.store.clearCache();
    if (generation !== clanGeneration) return;
    lastProfilePass.value = undefined; manifestCheckedAt.value = undefined; clanCheckedAt.value = undefined;
    await store.setPreference(preferenceKey, null);
    if (repository.clanId === config.clanId) await store.setPreference('lastProfilePass:v2', null);
    if (generation !== clanGeneration) return;
    definitions.value = undefined; roster.value = undefined; players.value = {}; detail.value = undefined;
  } finally { if (generation === clanGeneration) busy.value = false; }
  if (generation === clanGeneration) await load();
}
async function retryPlayer(id: string) {
  const player = players.value[id];
  if (!player || busy.value) return;
  const generation = clanGeneration, repo = repository;
  retryingPlayer.value = id; busy.value = true; phase.value = 'Retrying profile…';
  try {
    const result = await repo.profile(player.member, cached => { if (generation === clanGeneration) applyProfile(player.member, cached); }, true);
    if (generation === clanGeneration) applyProfile(player.member, result);
  } finally { if (generation === clanGeneration) { retryingPlayer.value = undefined; busy.value = false; phase.value = 'Ready'; } }
}
function showDetail(player: string, heading: Heading, cell: Cell) { closeTooltip(); detail.value = { player, heading, cell }; }
watch([search, filter, sort], () => { if (preferencesReady.value) void store.setPreference('table', { search: search.value, filter: filter.value, sort: sort.value }); });
watch(sidebarCollapsed, value => { closeTooltip(); if (preferencesReady.value) void store.setPreference('sidebarCollapsed', value); });
watch([selected, isMembers], ([seal, members]) => { document.title = members ? 'Members · Clan Seal Tracker' : seal ? `${seal.title} · Clan Seal Tracker` : 'Clan Seal Tracker'; });
onMounted(async () => {
  window.addEventListener('hashchange', changedHash);
  window.addEventListener('focus', checkLoginExpiry);
  document.addEventListener('visibilitychange', checkLoginExpiry);
  window.addEventListener('resize', closeTooltip);
  window.addEventListener('scroll', closeTooltip);
  try {
    let signedInNow = false;
    try { signedInNow = await login.initialize(); account.value = login.account; }
    catch (error) { loginNotice.value = error instanceof Error ? error.message : 'Login could not finish.'; }
    hash.value = locationHash();
    if (account.value) {
      loginExpiryTimer = setTimeout(checkLoginExpiry, Math.min(2_147_483_647, Math.max(0, (login.expiresAt ?? 0) - Date.now())));
      try { ownClan.value = await login.clan(transport); } catch { loginNotice.value = 'Signed in, but your clan could not be found. You can choose a clan below.'; }
    }
    const preferences = await store.preference('table', { search: '', filter: 'all', sort: 'progress' });
    clanSelection.value = readClanSelection(await store.preference('clanSelection', undefined), fallbackClan);
    if (signedInNow && ownClan.value) {
      clanSelection.value = { selected: ownClan.value, recent: recentClans(clanSelection.value.recent, ownClan.value) };
      await store.setPreference('clanSelection', clanSelection.value);
    }
    const savedList = await store.preference<string>('playerList', 'clan');
    playerList.value = account.value && ['friends', 'combined'].includes(savedList) ? savedList as PlayerList : 'clan';
    repository = new TrackerRepository(store, transport, clanSelection.value.selected.id, config.language, login);
    lastProfilePass.value = await store.preference<typeof lastProfilePass.value>(passPreferenceKey(), playerList.value === 'clan' && clanSelection.value.selected.id === config.clanId ? await store.preference('lastProfilePass:v2', undefined) : undefined);
    sidebarCollapsed.value = await store.preference('sidebarCollapsed', false) === true;
    search.value = typeof preferences.search === 'string' ? preferences.search : '';
    filter.value = ['all', 'complete', 'incomplete', 'unavailable'].includes(preferences.filter) ? preferences.filter : 'all';
    sort.value = ['progress', 'highest', 'name', 'tenure'].includes(preferences.sort) ? preferences.sort : 'progress';
  } finally { preferencesReady.value = true; busy.value = false; void load(); void loadFriends(); }
});
onUnmounted(() => { clearTimeout(loginExpiryTimer); window.removeEventListener('focus', checkLoginExpiry); document.removeEventListener('visibilitychange', checkLoginExpiry); window.removeEventListener('hashchange', changedHash); window.removeEventListener('resize', closeTooltip); window.removeEventListener('scroll', closeTooltip); headerObserver?.disconnect(); topbarObserver?.disconnect(); closeTooltip(); });
</script>

<template>
  <header ref="topbar" class="topbar">
    <a href="#/" class="brand"><span class="brand-mark" aria-hidden="true">◇</span><span>CLAN <strong>SEAL TRACKER</strong></span></a>
    <div class="header-status">
      <section class="sync-strip" :class="{ 'sync-busy': busy }" role="status" aria-live="polite">

        <div class="status-copy"><div class="tooltip-only status-primary" @mouseenter="openTooltip($event, { kind: 'sync' })" @mouseleave="closeTooltip"><button class="tooltip-only sync-indicator" :class="[`sync-${syncColor}`, { 'is-updating': busy }]" aria-label="Record sync status" :aria-describedby="tooltip?.kind === 'sync' ? 'record-tooltip' : undefined" @focus="openTooltip($event, { kind: 'sync' })" @blur="closeTooltip" @keydown.esc="closeTooltip"><span class="status-dot" aria-hidden="true"></span></button><span class="status-heading">{{ busy ? 'Syncing records' : issues.length || failedCount ? 'Sync incomplete' : 'Records synced' }}</span></div><span class="status-counts"><template v-if="busy">{{ phase }}<span v-if="profileSyncActive"> · {{ profileSyncDone }} / {{ profileSyncTotal }} done</span></template><template v-else>{{ resolved }} / {{ roster?.members.length ?? '—' }} profiles<span v-if="staleCount"> · {{ staleCount }} stale / private</span><span v-if="failedCount"> · {{ failedCount }} unavailable</span></template></span></div>
      </section>
      <button class="refresh" :class="{ 'is-refreshing': busy }" :aria-busy="busy" :disabled="busy" :aria-label="busy ? 'Updating…' : 'Refresh data'" title="Refresh data" @click="load(true)"><span class="refresh-icon" aria-hidden="true">↻</span><span class="refresh-label">{{ busy ? 'Updating…' : 'Refresh data' }}</span></button>
    </div>
  </header>
  <div class="shell" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <aside class="sidebar" aria-label="Clan navigation">
      <button class="sidebar-toggle" :aria-label="sidebarCollapsed ? 'Expand side menu' : 'Collapse side menu'" :aria-expanded="!sidebarCollapsed" aria-controls="clan-menu" :title="sidebarCollapsed ? 'Expand side menu' : 'Collapse side menu'" @click="sidebarCollapsed = !sidebarCollapsed"><svg viewBox="0 0 20 20" aria-hidden="true" :class="{ reversed: sidebarCollapsed }"><path d="m12 4-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg></button>
      <label v-show="!sidebarCollapsed" class="player-list-control select-control control-field"><span>Players</span><select aria-label="Players to show" :value="playerList" :disabled="!preferencesReady" @change="changePlayerList(($event.target as HTMLSelectElement).value as PlayerList)"><option value="clan">Selected clan</option><option value="friends" :disabled="!account">My friends</option><option value="combined" :disabled="!account">My clan and friends</option></select></label>
      <div class="sidebar-identity-icons" :class="{ 'is-combined': playerList === 'combined' }">
        <FriendIcon v-if="sidebarCollapsed && playerList !== 'clan'" class="sidebar-friend-icon" aria-label="Friends" />
        <span v-if="sidebarCollapsed && playerList === 'combined'" class="sidebar-identity-plus" aria-hidden="true">+</span>
        <div class="sidebar-clan-identity">
          <ClanEmblem v-if="playerList !== 'friends'" class="sidebar-clan-icon" :emblem="roster?.emblem" :name="roster?.name ?? 'Clan'" />
          <div class="sidebar-identity-name">
            <p v-if="!sidebarCollapsed" class="eyebrow identity-eyebrow"><span v-if="playerList !== 'friends'">CLAN</span><span v-if="playerList === 'combined'" class="identity-label-plus">+</span><template v-if="playerList !== 'clan'"><FriendIcon class="identity-friend-icon" aria-hidden="true" /><span>FRIENDS</span></template></p>
            <h2 class="clan-name" :data-clan-id="playerList === 'clan' ? clanSelection.selected.id : playerList === 'combined' ? ownClan?.id : undefined" :class="{ 'clan-name-short': (roster?.name.length ?? 0) <= 16 }"><template v-if="playerList === 'friends' && account"><span class="friend-owner">{{ account.name.trimEnd() }}’s</span> <span class="friend-list-label">friends</span></template><template v-else>{{ roster?.name ?? (playerList === 'clan' ? clanSelection.selected.name : playerList === 'combined' ? ownClan?.name ?? 'My clan and friends' : 'My friends') }}</template></h2>
          </div>
        </div>
      </div>
      <div class="sidebar-actions">
      <button v-if="playerList !== 'friends'" class="clan-picker-button" :class="{ 'clan-picker-collapsed': sidebarCollapsed }" aria-label="Choose clan" :disabled="!preferencesReady" @click="clanPickerOpen = true"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg><span v-if="!sidebarCollapsed">Choose clan</span></button>
      <div class="login-controls" :class="{ 'login-collapsed': sidebarCollapsed }">
        <template v-if="account"><span v-if="!sidebarCollapsed" class="login-name" :data-bungie-membership-id="account.membershipId" :data-membership-id="account.primary?.membershipId" :data-membership-type="account.primary?.membershipType"><span class="login-display-name">{{ account.name }}</span><span v-if="account.nameCode" class="login-name-code">#{{ account.nameCode }}</span></span><button v-if="!sidebarCollapsed" type="button" aria-label="Sign out" @click="signOut()"><span aria-hidden="true">↪</span><span v-if="!sidebarCollapsed">Sign out</span></button></template>
        <button v-else type="button" aria-label="Sign in with Bungie" :disabled="!preferencesReady" @click="signIn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/></svg><span v-if="!sidebarCollapsed">Sign in with Bungie</span></button>
      </div>
      </div>
      <p v-if="loginNotice" class="login-notice" role="status">{{ loginNotice }}</p>
      <div id="clan-menu" v-show="!sidebarCollapsed" class="sidebar-content">
      <p class="muted small">{{ roster ? `${displayedPlayers.length} guardians` : busy ? 'Connecting to Bungie' : 'Check the connection notice' }}</p>
      <a href="#/" class="nav-home" :class="{ active: isHome }">Overview <span>↗</span></a>
      <div v-for="group in catalogGroups" :key="group.name" class="sidebar-section">
      <button class="eyebrow section-toggle" :aria-expanded="openSections.includes(group.category)" :aria-controls="group.id" @click="toggleSection(group.category)"><span>{{ group.name }}</span><svg viewBox="0 0 20 20" aria-hidden="true" :class="{ expanded: openSections.includes(group.category) }"><path d="m7 4 6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg></button>
      <nav v-show="openSections.includes(group.category)" :id="group.id" class="seal-nav" :aria-label="group.name">
        <a v-for="page in group.pages" :key="page.id" :href="`#/${pageMode(page)}/${page.id}`" :class="{ active: (routeId === page.id || groupedPage?.id === page.id) }" :aria-current="(routeId === page.id || groupedPage?.id === page.id) ? 'page' : undefined"><span>{{ page.name }}<small v-if="sealsById[page.id]?.legacy" class="legacy-label">Legacy</small></span><svg class="nav-chevron" aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="m7 4 6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg></a>
      </nav>
      </div>
      <div class="sidebar-bottom"><span class="small">Stored in this browser</span><button class="text-button" :disabled="busy" @click="clearCache">Clear API cache</button></div>
      </div>
    </aside>
    <main id="main">
      <div v-if="issues.length || storageWarning" class="notice" role="alert"><p v-for="issue in issues" :key="issue">{{ issue }}</p><p v-if="storageWarning">{{ storageWarning }}</p><p v-if="definitions">Showing the last complete definitions{{ definitionsState === 'stale' ? ' (stale)' : '' }}. {{ rosterState === 'stale' ? 'The clan roster is also stale.' : '' }}</p></div>
      <template v-if="!isHome && currentPage">
        <section class="page-heading seal-heading"><div><p class="eyebrow">{{ breadcrumb }}</p><h1>{{ headingTitle }}<span v-if="headingKind" class="heading-kind">{{ ' ' + headingKind }}</span></h1></div><div v-if="headingKind === 'seal' || headingKind === 'badge'" class="heading-tally"><img v-if="selected?.icon" class="heading-owner-icon" :class="`heading-${headingKind}-icon`" :src="`https://www.bungie.net${selected.icon}`" alt=""><div class="title-tally"><strong>{{ headingKind === 'badge' ? badgeOwnerCount : selected ? titleCount(selected) : '—' }}</strong><span>{{ headingKind === 'badge' ? 'badge owners' : 'title holders' }}</span></div></div></section>
        <ViewTabs :label="viewLabel" :tabs="viewTabs" />
      </template>
      <MembersPage v-if="isMembers" :key="clanSelection.selected.id" :players="displayedPlayers" :combined="playerList === 'combined'" :clan-emblem="roster?.emblem" :clan-name="roster?.name" :memberships="user => repository.memberships(user)" :entitlements="() => repository.memberEntitlements()" :tooltip-id="tooltip?.kind === 'characters' ? 'record-tooltip' : undefined" @show-guardian="showGuardianTooltip" @show-characters="showCharacterTooltip" @close-tooltip="closeTooltip" />
      <template v-else-if="isHome">
        <section class="page-heading"><p class="eyebrow">THE NEXT TITLE IS A TEAM EFFORT</p><h1>Your clan. Every triumph.</h1><p class="lede">See who’s close, plan you fireteam, and make the next run count.</p></section>
        <div class="overview-stats"><div><strong>{{ roster?.members.length ?? '—' }}</strong><span>Clan guardians</span></div><div><strong>{{ known.length }}</strong><span>Profiles with public data</span></div><div><strong>{{ seals.filter(s => s.page.sealNodeHash && !s.unavailable).length || '—' }}</strong><span>Seals to explore</span></div></div>
        <section v-for="group in catalogGroups" :key="group.name" class="catalog-section" :aria-label="group.title">
        <div class="section-title"><h2>{{ group.title }}</h2></div>
        <div class="seal-grid">
          <a v-for="(page, i) in group.pages" :key="page.id" :href="`#/${page.category === 'Other badges' ? 'badge' : page.sealNodeHash ? 'seal' : 'triumphs'}/${page.id}`" class="seal-card" :style="{ '--card-hue': `${135 + i * 22}` }">
            <SealWatermark :icon="sealsById[page.id]?.icon" />
            <span class="card-top"><span class="card-icon" aria-hidden="true">◇</span><span class="eyebrow">{{ page.seasonNumber ? `SEASON ${page.seasonNumber}` : group.kind.toUpperCase() + (group.category === 'Raid seals' ? ` ${String(i + 1).padStart(2, '0')}` : '') }}<span v-if="sealsById[page.id]?.legacy"> · LEGACY</span></span></span>
            <h3>{{ sealsById[page.id]?.title ?? page.name }}</h3><p>{{ page.name }}</p>
            <div class="card-bottom"><span v-if="sealsById[page.id]?.unavailable">Unavailable in current manifest</span><span v-else-if="definitions && page.sealNodeHash">{{ titleCount(sealsById[page.id]!) }} title holders</span><span v-else-if="definitions && page.category === 'Other badges'">{{ displayedPlayers.filter(p => badgeOwnership(p.profile, sealsById[page.id]?.headings ?? []).completeClasses.length > 0).length }} badge owners</span><span v-else-if="page.category === 'Other'">{{ otherPageSummary(page) }}</span><span v-else-if="definitions">{{ sealsById[page.id]?.headings.length ?? 0 }} triumphs</span><span v-else>Loading definitions…</span><span aria-hidden="true">↗</span></div>
          </a>
        </div>
        </section>
        <p class="footnote">Counts cover loaded profiles, including any retained stale data. Choose a raid, dungeon, exotic mission, activity, expansion, season, or episode to explore its seal and triumphs, with collection badges where available.</p>
      </template>
      <template v-else-if="selected && !selected.unavailable">

        <p v-if="activeTriumphsOnly" class="legacy-notice active-triumphs-notice">Active triumphs · This view only shows active triumphs. Legacy triumphs are listed in separate tabs.</p>
        <p v-if="selected.legacy && selected.page.sealNodeHash" class="legacy-notice">Legacy seal · Bungie lists this seal under Legacy Titles; it can no longer be earned. Archived progress remains visible, and individual rewards may still be obtainable.</p>
        <p v-if="selected.legacy && !selected.page.sealNodeHash" class="legacy-notice">Legacy triumphs · Archived by Bungie. Objective progress is likely missing; only completion status may remain. Availability of individual triumphs and rewards can differ.</p>
        <p v-if="viewDescription" class="lede view-description">{{ viewDescription }}</p>
        <div class="table-tools"><label class="search control-field"><svg class="search-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg><input v-model="search" aria-label="Search guardians" placeholder="Search guardians…" type="search"></label><label class="select-control control-field"><span class="sr-only">Filter progress</span><select v-model="filter" aria-label="Filter progress"><option value="all">All guardians</option><option v-if="!metricView" value="incomplete">Requirements incomplete</option><option v-if="!metricView" value="complete">Requirements complete</option><option value="unavailable">No public data</option></select></label><label class="select-control control-field"><span class="sr-only">Sort guardians</span><select v-model="sort" aria-label="Sort guardians"><option value="progress">{{ metricView ? 'Highest first' : 'Closest next · completed last' }}</option><option v-if="!metricView" value="highest">Highest progress first</option><option value="name">Guardian name</option><option value="tenure">Clan tenure · longest first</option></select></label><label v-if="routeMode !== 'seal' && badgeClasses.length" class="select-control control-field"><span class="sr-only">Badge class</span><select v-model="badgeClass" aria-label="Badge class"><option value="best">Best class set</option><option v-for="(name, i) in badgeClasses" :key="name" :value="String(i)">{{ name }} set</option></select></label></div>
        <div class="table-caption"><span>{{ rows.length }} guardians shown</span><span v-if="!metricView" class="table-legend"><span v-if="routeMode !== 'badge' && selected.page.sealNodeHash" class="legend-group-end">✦ Title earned</span><template v-else-if="routeMode === 'badge'"><span>✦ Badge collected</span><span class="earned-gold legend-group-end">✦ All 3 classes</span></template><span>✓ {{ collectionView ? 'Collected' : 'Complete' }}</span><span><span class="legend-progress">●</span> In progress</span><span><span class="legend-zero" aria-hidden="true">·</span> No progress</span></span></div>
        <div class="table-frame"><div class="table-scroll" tabindex="0" :aria-label="`Scrollable ${routeMode} progress table`" :style="{ '--group-header-height': `${groupHeaderHeight}px`, '--category-header-height': hasColumnGroups ? '32px' : '0px', '--player-column-width': `${playerColumnWidth}px` }" @scroll="closeTooltip">
          <table>
            <thead>
              <tr v-if="hasColumnGroups" class="category-header-row">
                <th scope="col" class="player-column" :rowspan="headerRows">Guardian</th><th v-if="!metricView" scope="col" class="progress-column" :rowspan="headerRows"><button class="tooltip-only heading-button summary-heading" :aria-describedby="tooltip?.kind === 'summary' ? 'record-tooltip' : undefined" @mouseenter="showSummary($event)" @mouseleave="closeTooltip" @focus="showSummary($event)" @blur="closeTooltip" @keydown.esc="closeTooltip">{{ summaryLabel }}</button></th>
                <th v-for="(group, i) in columnGroups" :key="i" scope="colgroup" :colspan="group.columns" :class="{ 'commendation-section': !!group.color }" :style="group.color ? { '--commendation-color': group.color } : undefined"><span class="category-title">{{ group.name }}</span></th>
              </tr>
              <tr ref="groupHeader" class="record-header-row">
                <th v-if="!hasColumnGroups" scope="col" class="player-column" :rowspan="headerRows">Guardian</th>
                <th v-if="!hasColumnGroups && !metricView" scope="col" class="progress-column" :rowspan="headerRows"><button class="tooltip-only heading-button summary-heading" :aria-describedby="tooltip?.kind === 'summary' ? 'record-tooltip' : undefined" @mouseenter="showSummary($event)" @mouseleave="closeTooltip" @focus="showSummary($event)" @blur="closeTooltip" @keydown.esc="closeTooltip">{{ summaryLabel }}</button></th>
                <th v-for="heading in selected.headings" :key="heading.hash" :scope="objectiveColumns(heading) > 1 ? 'colgroup' : 'col'" :colspan="objectiveColumns(heading)" :rowspan="hasStages && objectiveColumns(heading) === 1 ? 2 : 1" class="tooltip-only record-heading" :style="heading.color ? { '--commendation-color': heading.color } : undefined" v-bind="headingIdentifiers(heading)" :class="{ 'commendation-section': !!heading.color, 'commendation-total': heading.metricKey?.startsWith('node:'), 'heading-gilding': heading.gilding || (heading.metric === 'gildingCount' || heading.metric === 'gilded'), 'heading-unscored': heading.skip && !metricView }" :data-record-tooltip="`header:${heading.hash}`" @mouseenter="showTooltip($event, heading)" @mouseleave="leaveRecordTooltip" @focusin="showTooltip($event, heading)" @focusout="leaveRecordTooltip">
                  <button class="tooltip-only heading-button" :aria-describedby="tooltip ? 'record-tooltip' : undefined" @keydown.esc="closeTooltip">{{ heading.label }}<span v-if="heading.pattern" class="pattern-label">Pattern available</span></button>
                </th>
              </tr>
              <tr v-if="hasStages" class="objective-header-row">
                <template v-for="heading in selected.headings" :key="heading.hash">
                  <th v-for="(objective, stage) in (objectiveColumns(heading) > 1 ? displayObjectives(heading, heading.objectives) : [])" :key="objective.hash" scope="col" class="tooltip-only objective-heading" v-bind="headingIdentifiers(heading)" :data-objective-hash="objective.hash" :class="{ 'record-end': stage === displayObjectives(heading, heading.objectives).length - 1 }" :data-record-tooltip="`header:${heading.hash}`" @mouseenter="showTooltip($event, heading, undefined, undefined, String(objective.hash))" @mouseleave="leaveRecordTooltip" @focusin="showTooltip($event, heading, undefined, undefined, String(objective.hash))" @focusout="leaveRecordTooltip"><button class="tooltip-only stage-button" :aria-label="`Stage ${heading.objectives.indexOf(objective) + 1}: ${objective.progressDescription || objective.displayProperties?.description || heading.name}`" :aria-describedby="tooltip ? 'record-tooltip' : undefined" @keydown.esc="closeTooltip">{{ heading.objectives.indexOf(objective) + 1 }}</button></th>
                </template>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.id" :class="{ 'row-complete': row.complete }">
                <th scope="row" class="player-column" :data-guardian-id="row.id" :data-membership-id="row.member.destinyUserInfo.membershipId" :data-membership-type="row.member.destinyUserInfo.membershipType"><div class="guardian-row"><button class="tooltip-only guardian-button" :aria-label="`Guardian details: ${row.name}`" :aria-describedby="tooltip ? 'record-tooltip' : undefined" @mouseenter="showGuardianTooltip($event, row)" @mouseleave="closeTooltip" @focus="showGuardianTooltip($event, row)" @blur="closeTooltip" @keydown.esc="closeTooltip"><span class="player-name">{{ row.name }}<small v-if="clanMembershipPlatform(row.member, linkedPlatforms[memberKey(row.member)])" class="joined-platform"> ({{ clanMembershipPlatform(row.member, linkedPlatforms[memberKey(row.member)]) }})</small></span><span class="guardian-markers"><span v-if="row.earned" class="earned" :class="{ 'earned-gold': row.badge?.allClasses }" :aria-label="row.earnedLabel">✦</span><span v-if="['stale', 'private', 'unavailable'].includes(row.status)" class="guardian-warning" :aria-label="statusLabel(row)">●</span></span></button><button v-if="['private', 'unavailable', 'stale'].includes(row.status)" class="retry" :class="{ 'is-refreshing': retryingPlayer === row.id }" :aria-busy="retryingPlayer === row.id" :disabled="busy" :aria-label="`Retry profile: ${row.name}`" @click="retryPlayer(row.id)"><span class="refresh-icon" aria-hidden="true">↻</span></button><PlayerAffiliations v-if="playerList === 'combined'" :member="row.member" :emblem="roster?.emblem" :clan-name="roster?.name" /></div></th>
                <td v-if="!metricView" class="tooltip-only progress-column summary-cell" tabindex="0" :aria-label="`${row.name}: ${summaryLabel}`" :aria-describedby="tooltip?.kind === 'summary' ? 'record-tooltip' : undefined" @mouseenter="showSummary($event, row.name, row.counts)" @mouseleave="closeTooltip" @focus="showSummary($event, row.name, row.counts)" @blur="closeTooltip" @keydown.esc="closeTooltip"><template v-if="row.hasData"><strong>{{ Math.round(row.fraction * 100) }}<small>%</small></strong><span class="mini-progress"><span :style="{ width: `${row.fraction * 100}%` }"></span></span></template><span v-else class="muted">{{ row.status === 'loading' ? 'Loading…' : 'No data' }}</span></td>
                <template v-for="(cell, i) in row.cells" :key="row.headings[i]!.hash">
                  <td v-if="cell.variants" class="record-end armor-ownership-cell" :class="{ 'cell-complete': cell.complete, 'cell-unclaimed': cell.unclaimed, 'cell-missing': cell.variants.every(v => v.missing) }" :data-record-tooltip="`player:${row.id}:${row.headings[i]!.hash}`" @mouseenter="showTooltip($event, row.headings[i]!, cell, row.name)" @mouseleave="leaveRecordTooltip" @focusin="showTooltip($event, row.headings[i]!, cell, row.name)" @focusout="leaveRecordTooltip">
                    <button class="cell-button armor-ownership" :style="{ '--class-count': cell.variants.length }" :aria-describedby="tooltip ? 'record-tooltip' : undefined" :aria-label="`${row.name}: ${row.headings[i]!.name}: ${cell.variants.some(v => v.complete) ? 'collected for ' + cell.variants.filter(v => v.complete).map(v => v.name).join(', ') : cell.variants.some(v => v.missing) ? 'collection data unavailable' : 'not collected'}`" @keydown.esc="closeTooltip" @click="showDetail(row.name, row.headings[i]!, cell)">
                      <span v-for="variant in cell.variants" :key="variant.name" class="class-slot" :data-class="variant.name"><ClassIcon v-if="variant.complete" :name="variant.name" :icon="variant.icon" /><span v-else-if="variant.missing" class="cell-missing" :aria-label="`${variant.name} data unavailable`">—</span></span>
                      <span v-if="cell.variants.every(v => !v.complete && !v.missing)" class="cell-zero ownership-empty">·</span>
                    </button>
                  </td>
                  <td v-else-if="cell.complete || !displayObjectives(row.headings[i]!, cell.objectives).length" :colspan="objectiveColumns(row.headings[i]!)" :style="row.headings[i]!.color ? { '--commendation-color': row.headings[i]!.color } : undefined" :class="{ 'commendation-section': !!row.headings[i]!.color, 'commendation-total': row.headings[i]!.metricKey?.startsWith('node:'), 'cell-metric': metricView, 'cell-complete': cell.complete, 'cell-unclaimed': cell.unclaimed, 'cell-progress': cell.fraction > 0 && !cell.complete, 'cell-missing': cell.missing, 'cell-zero': !cell.missing && cell.text === '·', 'cell-unowned': cell.unowned, 'cell-conditioned': !!cell.conditions?.length }" class="record-end" :data-record-tooltip="`player:${row.id}:${row.headings[i]!.hash}`" @mouseenter="showTooltip($event, row.headings[i]!, cell, row.name)" @mouseleave="leaveRecordTooltip" @focusin="showTooltip($event, row.headings[i]!, cell, row.name)" @focusout="leaveRecordTooltip">
                    <button class="cell-button" :aria-describedby="tooltip ? 'record-tooltip' : undefined" :aria-label="`${row.name}: ${row.headings[i]!.name}: ${(row.headings[i]!.collectibleHashes || row.headings[i]!.checklist) ? cell.missing ? 'no collection data' : cell.complete ? 'collected' : 'not collected' : row.headings[i]!.metric ? cell.detail : cell.complete ? cell.unclaimed ? 'complete, unclaimed' : 'complete' : cell.missing ? 'no record' : 'incomplete'}`" @keydown.esc="closeTooltip" @click="showDetail(row.name, row.headings[i]!, cell)">{{ cell.text === '·' && cell.conditions?.length ? '' : cell.text }}</button><CellConditions :conditions="cell.conditions" />
                  </td>
                  <template v-else>
                    <td v-for="(objective, j) in displayObjectives(row.headings[i]!, cell.objectives)" :key="objective.hash" :class="{ 'cell-complete': objective.complete, 'cell-progress': objective.fraction > 0 && !objective.complete, 'cell-missing': objective.missing, 'cell-zero': !objective.missing && objective.text === '·', 'cell-unowned': cell.unowned, 'cell-conditioned': !!cell.conditions?.length, 'record-end': j === displayObjectives(row.headings[i]!, cell.objectives).length - 1 }" :data-record-tooltip="`player:${row.id}:${row.headings[i]!.hash}`" @mouseenter="showTooltip($event, row.headings[i]!, cell, row.name, objective.hash)" @mouseleave="leaveRecordTooltip" @focusin="showTooltip($event, row.headings[i]!, cell, row.name, objective.hash)" @focusout="leaveRecordTooltip">
                      <button class="cell-button" :aria-describedby="tooltip ? 'record-tooltip' : undefined" :aria-label="`${row.name}: ${row.headings[i]!.name}: ${objective.name}: ${objective.missing ? 'no record' : objective.complete ? 'complete' : `${objective.progress}/${objective.target}`}`" @keydown.esc="closeTooltip" @click="showDetail(row.name, row.headings[i]!, cell)">{{ objective.text === '·' && cell.conditions?.length ? '' : objective.text }}</button><CellConditions :conditions="cell.conditions" />
                    </td>
                  </template>
                </template>
              </tr>
              <tr v-if="!rows.length"><td :colspan="tableColumns" class="empty-state">{{ !roster ? (busy ? 'Loading players…' : 'Player list is unavailable. See the connection notice above.') : busy ? 'Loading guardians…' : 'No guardians match this view.' }}<button v-if="search || filter !== 'all'" class="text-button" @click="search = ''; filter = 'all'">Reset filters</button></td></tr>
            </tbody>
          </table>
        </div></div>
        <aside v-if="detail" class="detail-panel" aria-live="polite"><button class="detail-close" aria-label="Close record details" @click="detail = undefined">×</button><RecordDetails :heading="detail.heading" :cell="detail.cell" :player="detail.player" /></aside>
        <p v-if="selected.page.category === 'Other'" class="footnote">{{ selected.page.kind === 'seals' ? 'Each column tracks a seal’s completion record. Gilding is separate from seal completion.' : metricView ? 'Values are reported by Bungie without a completion goal.' : 'Missing data is shown separately from incomplete progress. Hover over a requirement for details.' }}</p>
        <p v-else class="footnote"><template v-if="routeMode === 'raid' || routeMode === 'badge'">Collection progress uses one whole class set (the most complete by default). Shared items count for every class. </template><template v-if="routeMode === 'raid' || routeMode === 'triumphs'">The percentage averages the columns included in this table<span v-if="selected.page.sealNodeHash">, separately from the in-game seal requirements</span>. </template><template v-if="selected.page.category === 'Activities'"> Gilding requirements are included in this view’s percentage.</template> Day-one triumphs and lifetime gilding counts do not affect the percentage. A missing record is shown separately from an incomplete one. Watermarks explain content locks and visibility conditions on hover. Click a cell for objective details.</p>
      </template>
      <template v-else-if="!isHome"><section :class="currentPage ? 'view-unavailable' : 'empty-state'" :role="currentPage ? 'status' : undefined"><h1 v-if="!currentPage">{{ definitions ? 'Page not found' : 'Loading seal definitions…' }}</h1><p>{{ selected?.unavailable || (!definitions ? busy ? 'Loading definitions…' : 'Definitions could not be loaded. Check the connection and retry.' : '') }}</p><a href="#/">Back to overview</a></section></template>
      <Teleport to="body"><ClanPicker v-if="clanPickerOpen" :selected="clanSelection.selected" :recent="clanSelection.recent" :fallback="{ ...fallbackClan, name: clanSelection.recent.find(clan => clan.id === fallbackClan.id)?.name ?? fallbackClan.name }" :own="ownClan" :friends="friendClans" :friends-loading="friendsLoading" :friends-error="friendsError" @retry-friends="loadFriends(true)" :directory="clanDirectory" @select="selectClan" @close="clanPickerOpen = false" /></Teleport>
      <Teleport to="body">
        <div v-if="tooltip" id="record-tooltip" ref="tooltipElement" class="record-tooltip" :class="{ 'compact-tooltip': tooltip.kind === 'note' }" role="tooltip" :style="tooltip.style"><CharacterDetails v-if="tooltip.kind === 'characters'" :player="tooltip.player" /><RecordDetails v-else-if="tooltip.kind === 'record'" :heading="tooltip.heading" :cell="tooltip.cell" :player="tooltip.player" :active-objective-hash="tooltip.objectiveHash" /><CompletionDetails v-else-if="tooltip.kind === 'summary'" :seal="tooltip.seal" :label="tooltip.label" :player="tooltip.player" :counts="tooltip.counts" :badge="tooltip.badge" :broader="tooltip.broader" :unit="tooltip.seal.page.kind === 'seals' ? 'seal' : undefined" /><GuardianDetails v-else-if="tooltip.kind === 'guardian'" :guardian="tooltip.guardian" :earned-title="tooltip.earnedTitle" :earned-badge="tooltip.earnedBadge" :name="nameOf(tooltip.guardian)" :memberships="tooltip.memberships" :loading="tooltip.loading" :error="tooltip.error" :freshness="`${statusLabel(tooltip.guardian)} · ${age(tooltip.guardian.fetchedAt)}`" /><p v-else-if="tooltip.kind === 'note'" class="tooltip-note">{{ tooltip.text }}</p><div v-else class="record-details sync-details"><h3>Sync status</h3><div class="sync-history">
          <h4>Latest checks</h4>
          <p>Game definitions: <strong>{{ manifestCheckedAt ? age(manifestCheckedAt) : 'not yet checked' }}</strong></p>
          <p>{{ playerList === 'friends' ? 'Friends list' : 'Clan roster' }}: <strong>{{ clanCheckedAt ? age(clanCheckedAt) : 'not yet checked' }}</strong><span v-if="roster && clanCheckedAt" class="sync-detail-line">{{ roster.members.filter(member => member.isOnline).length }} members online</span></p>
          <p v-if="lastProfilePass">Profiles: <strong>{{ age(lastProfilePass.completedAt) }}</strong>
            <span class="sync-detail-line">{{ lastProfilePass.loaded }} {{ lastProfilePass.loaded === 1 ? 'profile' : 'profiles' }} refreshed</span>
            <span class="sync-detail-line">{{ lastProfilePass.reused }} {{ lastProfilePass.reused === 1 ? 'profile' : 'profiles' }} already up to date</span>
            <span class="sync-detail-line">{{ lastProfilePass.private }} {{ lastProfilePass.private === 1 ? 'profile is' : 'profiles are' }} private</span>
            <span v-if="lastProfilePass.unavailable" class="sync-detail-line">{{ lastProfilePass.unavailable }} {{ lastProfilePass.unavailable === 1 ? 'profile check' : 'profile checks' }} failed</span>
          </p>
        </div><ul class="sync-legend"><li v-for="status in syncLegend" :key="status.color" :class="[`sync-${status.color}`, { current: syncColor === status.color }]"><span class="status-dot" aria-hidden="true"></span><div><span class="sync-legend-label">{{ status.label }}</span><p>{{ status.description }}</p></div></li></ul></div></div>
      </Teleport>
      <footer><span>CLAN SEAL TRACKER</span><span>Uses Bungie's public API · Data cached locally · Not affiliated with Bungie</span></footer>
    </main>
  </div>
</template>
