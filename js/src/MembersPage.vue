<script setup lang="ts">
import PlayerAffiliations from './PlayerAffiliations.vue';
import type { ClanEmblemData } from './clanBanner';
import { clanMembershipPlatform } from './members';
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import type { PlayerData, UserInfo } from './types';
import { clanRankLabel, compareClanTenure } from './clan';
import { eachLimited } from './repository';
import { gameVersions, guardianClasses, guardianPower, memberName, membersCsv, ownership, platformName, platforms, primarySave, type MemberEntitlements } from './members';
const props = defineProps<{ players: PlayerData[]; combined?: boolean; clanEmblem?: ClanEmblemData; clanName?: string; tooltipId?: string; memberships: (user: UserInfo) => Promise<UserInfo[]>; entitlements: () => Promise<MemberEntitlements> }>();
const emit = defineEmits<{ 'show-guardian': [event: Event, player: PlayerData]; 'show-characters': [event: Event, player?: PlayerData]; 'close-tooltip': [] }>();
const headingRow = ref<HTMLTableRowElement>();
const headingHeight = ref(60);
let headingObserver: ResizeObserver | undefined;
onMounted(() => {
  if (headingRow.value) {
    headingObserver = new ResizeObserver(() => { headingHeight.value = headingRow.value!.getBoundingClientRect().height; });
    headingObserver.observe(headingRow.value);
  }
});
onUnmounted(() => headingObserver?.disconnect());
function leaveCharacters(event: MouseEvent | FocusEvent) {
  const current = (event.currentTarget as HTMLElement).dataset.characterGroup;
  const next = event.relatedTarget instanceof Element ? event.relatedTarget.closest<HTMLElement>('[data-character-group]')?.dataset.characterGroup : undefined;
  if (!current || next !== current) emit('close-tooltip');
}
const search = ref(''), sort = ref('tenure');
const linked = shallowRef<Record<string, UserInfo[]>>({});
const platformErrors = ref<Record<string, string>>({});
const definitions = shallowRef<MemberEntitlements>();
const definitionError = ref('');
const idOf = (p: PlayerData) => `${p.member.destinyUserInfo.membershipType}_${p.member.destinyUserInfo.membershipId}`;
const pending = new Set<string>();
watch(() => props.players.map(idOf).sort().join(','), async () => {
  await eachLimited(props.players, async player => {
    const id = idOf(player);
    if (linked.value[id] || pending.has(id)) return;
    pending.add(id);
    try {
      const names = await props.memberships(player.member.destinyUserInfo);
      linked.value = { ...linked.value, [id]: names };
    }
    catch (error) { platformErrors.value = { ...platformErrors.value, [id]: error instanceof Error ? error.message : 'Platform names unavailable' }; }
    finally { pending.delete(id); }
  });
}, { immediate: true });
onMounted(async () => {
  try { definitions.value = await props.entitlements(); }
  catch (error) { definitionError.value = error instanceof Error ? error.message : 'Season definitions unavailable.'; }
});
const namesFor = (p: PlayerData) => linked.value[idOf(p)] ?? [p.member.destinyUserInfo];
const rows = computed(() => props.players.filter(p => [memberName(p), ...namesFor(p).map(m => m.displayName)].join(' ').toLowerCase().includes(search.value.trim().toLowerCase()))
  .sort((a, b) => (sort.value === 'tenure' ? compareClanTenure(a.member, b.member) : sort.value === 'activity' ? lastSeen(b) - lastSeen(a) : 0) || memberName(a).localeCompare(memberName(b))));
const lastSeen = (p: PlayerData) => p.member.isOnline ? Date.now() : Number(p.member.lastOnlineStatusChange) * 1000 || 0;
const date = (value: string | number | undefined) => {
  const time = value === undefined ? NaN : typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(time) && time > 0 ? new Date(time).toLocaleString() : '—';
};
const platformColumns = computed(() => [1, 2, 3, 6, ...[4, 5].filter(type => Object.values(linked.value).some(list => list.some(m => m.membershipType === type))) ]);
type OwnershipColumn = { id: number; name: string; kind: 'version' | 'season' };
const groups = computed<{ name: string; columns: OwnershipColumn[] }[]>(() => {
  const seasons = Object.entries(definitions.value?.seasons ?? {}).filter(([, s]) => s.seasonNumber && s.seasonNumber >= 8)
    .sort((a, b) => a[1].seasonNumber! - b[1].seasonNumber!);
  return [
    { name: 'Expansions', columns: gameVersions.map(([id, name]) => ({ id, name, kind: 'version' as const })) },
    { name: 'Seasons & episodes', columns: seasons.map(([id, s]) => ({ id: Number(id), name: `${s.displayProperties?.name || 'Season'} (${s.seasonNumber})`, kind: 'season' as const })) },
  ].filter(g => g.columns.length);
});
const columns = computed(() => groups.value.flatMap(g => g.columns.map((column, i) => ({ ...column, groupEnd: i === g.columns.length - 1 }))));
const profileStatus = (p: PlayerData) => p.status === 'loading' ? 'Loading' : p.status === 'private' ? 'Private' : p.status === 'unavailable' ? 'Unavailable' : p.status === 'stale' ? 'Stale' : 'Up to date';
function exportCsv() {
  const header = ['Bungie name', ...platformColumns.value.map(type => platforms[type]!), 'Primary save', 'Last platform', 'Clan rank', 'Joined clan', 'Last seen', ...guardianClasses.map(c => `${c.name} Power`), 'Profile status', 'Profile fetched', ...columns.value.map(c => c.name)];
  const data = rows.value.map(p => [memberName(p), ...platformColumns.value.map(type => platformName(namesFor(p), type)), primarySave(p), platforms[p.member.destinyUserInfo.LastSeenDisplayNameType ?? 0] ?? '', clanRankLabel(p.member.memberType), date(p.member.joinDate), p.member.isOnline ? 'Online' : date(lastSeen(p)), ...guardianClasses.map(c => guardianPower(p.profile, c.type, 'all')), profileStatus(p), date(p.fetchedAt), ...columns.value.map(c => { const owned = ownership(p, c.kind, c.id); return owned === undefined ? 'Unknown' : owned ? 'Yes' : 'No'; })]);
  const url = URL.createObjectURL(new Blob(['\ufeff', membersCsv([header, ...data])], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'members.csv'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
</script>
<template>
  <section class="page-heading"><div><p class="eyebrow">CLAN / MEMBERS</p><h1>{{ clanName || 'Clan' }} members</h1></div></section>
  <p v-if="definitionError" class="notice" role="status">{{ definitionError }}</p>
  <div class="table-tools">
    <label class="search control-field"><input v-model="search" type="search" aria-label="Search members" placeholder="Search members…"></label>
    <label class="select-control control-field"><span class="sr-only">Sort members</span><select v-model="sort" aria-label="Sort members"><option value="tenure">Clan tenure · longest first</option><option value="name">Guardian name</option><option value="activity">Last seen · most recent first</option></select></label>
    <button class="members-export" @click="exportCsv">Export CSV</button>
  </div>
  <div class="table-caption"><span>{{ rows.length }} members shown</span><span>✓ Owned · · Not listed as owned · — Unavailable</span></div>
  <div class="table-frame"><div class="table-scroll members-scroll" tabindex="0" aria-label="Scrollable clan members table" :style="{ '--group-header-height': `${headingHeight}px` }" @scroll="emit('close-tooltip')">
    <table class="members-table">
      <thead><tr class="category-header-row"><th rowspan="3" scope="col" class="player-column">Bungie name</th><th :colspan="platformColumns.length" scope="colgroup"><span class="category-title">Platforms</span></th><th colspan="10" scope="colgroup"><span class="category-title">Account &amp; clan</span></th><th v-for="group in groups" :key="group.name" :colspan="group.columns.length" scope="colgroup"><span class="category-title">{{ group.name }}</span></th></tr>
        <tr ref="headingRow" class="record-header-row"><th v-for="(type, index) in platformColumns" :key="type" scope="col" rowspan="2" :class="{ 'group-end': index === platformColumns.length - 1 }">{{ platforms[type] }}</th><th scope="col" rowspan="2">Primary save</th><th scope="col" rowspan="2">Last platform</th><th scope="col" rowspan="2">Clan rank</th><th scope="col" rowspan="2">Joined clan</th><th scope="col" rowspan="2">Last seen</th><th colspan="3" scope="colgroup" class="tooltip-only" data-character-group="header" @mouseenter="emit('show-characters', $event)" @mouseleave="leaveCharacters" @focusin="emit('show-characters', $event)" @focusout="leaveCharacters"><button class="tooltip-only heading-button" :aria-describedby="tooltipId" @keydown.esc="emit('close-tooltip')">Guardians</button></th><th scope="col" rowspan="2">Profile status</th><th scope="col" rowspan="2" class="group-end">Profile fetched</th><th v-for="col in columns" :key="`${col.kind}:${col.id}`" scope="col" rowspan="2" :class="{ 'group-end': col.groupEnd }">{{ col.name }}</th></tr>
        <tr class="objective-header-row"><th v-for="guardianClass in guardianClasses" :key="guardianClass.type" class="tooltip-only guardian-power-heading" scope="col" data-character-group="header" @mouseenter="emit('show-characters', $event)" @mouseleave="leaveCharacters" @focusin="emit('show-characters', $event)" @focusout="leaveCharacters"><button class="tooltip-only heading-button" :aria-describedby="tooltipId" @keydown.esc="emit('close-tooltip')">{{ guardianClass.name }}</button></th></tr>
      </thead>
      <tbody><tr v-for="player in rows" :key="idOf(player)" :data-membership-id="player.member.destinyUserInfo.membershipId">
        <th scope="row" class="player-column"><div class="guardian-row"><a class="guardian-button" :href="`https://www.bungie.net/7/en/User/Profile/${(player.member.bungieNetUserInfo ?? player.member.destinyUserInfo).membershipType}/${(player.member.bungieNetUserInfo ?? player.member.destinyUserInfo).membershipId}`" target="_blank" rel="noopener noreferrer" @mouseenter="emit('show-guardian', $event, player)" @mouseleave="emit('close-tooltip')" @focus="emit('show-guardian', $event, player)" @blur="emit('close-tooltip')"><span class="player-name">{{ memberName(player) }}<small v-if="clanMembershipPlatform(player.member, namesFor(player))" class="joined-platform"> ({{ clanMembershipPlatform(player.member, namesFor(player)) }})</small></span></a><PlayerAffiliations v-if="combined" :member="player.member" :emblem="clanEmblem" :clan-name="clanName" /></div></th>
        <td v-for="(type, index) in platformColumns" :key="type" :class="{ 'group-end': index === platformColumns.length - 1 }">{{ platformName(namesFor(player), type) || '—' }}</td>
        <td>{{ primarySave(player) }}</td><td>{{ platforms[player.member.destinyUserInfo.LastSeenDisplayNameType ?? 0] || '—' }}</td><td>{{ clanRankLabel(player.member.memberType) }}</td><td>{{ date(player.member.joinDate) }}</td><td>{{ player.member.isOnline ? 'Online' : date(lastSeen(player)) }}</td><td v-for="guardianClass in guardianClasses" :key="guardianClass.type" class="tooltip-only guardian-power" :data-character-group="idOf(player)" @mouseenter="emit('show-characters', $event, player)" @mouseleave="leaveCharacters" @focusin="emit('show-characters', $event, player)" @focusout="leaveCharacters"><button class="tooltip-only cell-button" :aria-label="`${memberName(player)}: ${guardianClass.name} guardians: ${guardianPower(player.profile, guardianClass.type)}`" :aria-describedby="tooltipId" @keydown.esc="emit('close-tooltip')">{{ guardianPower(player.profile, guardianClass.type) }}</button></td><td>{{ profileStatus(player) }}<small v-if="player.error || platformErrors[idOf(player)]" class="member-error">{{ player.error || platformErrors[idOf(player)] }}</small></td><td class="group-end">{{ date(player.fetchedAt) }}</td>
        <td v-for="col in columns" :key="`${col.kind}:${col.id}`" :class="{ 'member-owned': ownership(player, col.kind, col.id), 'group-end': col.groupEnd }" :aria-label="`${col.name}: ${ownership(player, col.kind, col.id) === undefined ? 'unavailable' : ownership(player, col.kind, col.id) ? 'owned' : 'not listed as owned'}`">{{ ownership(player, col.kind, col.id) === undefined ? '—' : ownership(player, col.kind, col.id) ? '✓' : '·' }}</td>
      </tr></tbody>
    </table>
  </div></div>
  <p class="footnote">Ownership reflects the profile's platform and Bungie's reported entitlements. Private or stale profiles may retain older data. Missing ownership data is shown as unavailable.</p>
</template>
<style scoped>
.members-table tbody th.player-column{padding-top:0;padding-bottom:0}.members-table .player-name{font-size:inherit}
.members-scroll{border-radius:6px;--category-header-height:32px;--player-column-width:206px}.members-table th,.members-table td{border-right:1px solid #d3ddcc}.members-table .group-end,.members-table .player-column,.members-table .category-header-row th{border-right:2px solid #b7c6af}.members-table .category-header-row th{height:32px;padding:5px 12px}.members-table .category-header-row .player-column{z-index:5}
.members-table .guardian-power,.members-table .guardian-power-heading{min-width:70px;max-width:140px;padding:0 5px}.guardian-power .cell-button{white-space:nowrap}.members-table .heading-button{padding:3px}
.members-export{background:#edf1e8;border:1px solid var(--line);border-radius:5px;padding:10px 16px}.members-table{width:max-content;min-width:100%}.members-table th,.members-table td{padding:10px 14px;height:auto;min-width:110px}.members-table thead th{font-size:12px;max-width:160px;white-space:normal;text-align:center}.members-table .player-column{min-width:206px;text-align:left}.members-table tbody td{white-space:nowrap;font-size:12px}.members-table tbody th{font-weight:500}.members-table .member-owned{background:#e7efdc;color:#436335;text-align:center}.members-table tbody tr:hover td{box-shadow:inset 0 0 0 999px #294e3606}.member-error{display:block;max-width:240px;white-space:normal;color:#8b5547}.members-table a{text-decoration:none}.members-table a:hover{text-decoration:underline}
</style>
