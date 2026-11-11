<script setup lang="ts">
import { ref, watch } from 'vue';
import AppHeader from './AppHeader.vue';
import AppSidebar from './AppSidebar.vue';
import ClanPicker from './ClanPicker.vue';
import HomePage from './HomePage.vue';
import MembersPage from './MembersPage.vue';
import PageHeading from './PageHeading.vue';
import SealPage from './SealPage.vue';
import TooltipLayer from './TooltipLayer.vue';
import { provideTracker } from './useTracker';

const {
  ownClan,
  playerList,
  friendClans,
  friendsLoading,
  friendsError,
  fallbackClan,
  clanSelection,
  clanPickerOpen,
  clanDirectory,
  definitions,
  roster,
  displayedPlayers,
  busy,
  issues,
  storageWarning,
  rosterState,
  definitionsState,
  railCollapsed,
  isPhone,
  menuOpen,
  headerHidden,
  toggleMenu,
  closeTooltip,
  showCharacterTooltip,
  showGuardianTooltip,
  isMembers,
  isHome,
  selected,
  currentPage,
  loadFriends,
  loadMemberships,
  loadEntitlements,
  selectClan,
} = provideTracker();
const main = ref<HTMLElement>();
// A plain #main link would change the hash route.
const skipToContent = () => main.value?.focus();
watch([selected, isMembers], ([seal, members]) => {
  document.title = members
    ? 'Members · Clan Seal Tracker'
    : seal
      ? `${seal.title} · Clan Seal Tracker`
      : 'Clan Seal Tracker';
});
</script>

<template>
  <a class="skip-link" href="#main" @click.prevent="skipToContent"
    >Skip to content</a
  >
  <AppHeader :inert="isPhone && menuOpen" />
  <div class="shell" :class="{ 'sidebar-collapsed': railCollapsed }">
    <button
      v-show="headerHidden && !(isPhone && menuOpen)"
      class="menu-toggle menu-toggle-floating"
      tabindex="-1"
      aria-hidden="true"
      @click="toggleMenu"
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path
          d="M3 5.5h14M3 10h14M3 14.5h14"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
        />
      </svg>
    </button>
    <AppSidebar />
    <div
      v-if="isPhone && menuOpen"
      class="menu-backdrop"
      @click="menuOpen = false"
    ></div>
    <main id="main" ref="main" tabindex="-1" :inert="isPhone && menuOpen">
      <div v-if="issues.length || storageWarning" class="notice" role="alert">
        <p v-for="issue in issues" :key="issue">{{ issue }}</p>
        <p v-if="storageWarning">{{ storageWarning }}</p>
        <p v-if="definitions && definitionsState === 'stale'">
          Showing the last complete definitions.
        </p>
        <p v-if="rosterState === 'stale'">
          {{
            playerList === 'friends'
              ? 'The friends list is stale.'
              : 'The clan roster is stale.'
          }}
        </p>
      </div>
      <PageHeading v-if="!isHome && currentPage" />
      <MembersPage
        v-if="isMembers"
        :key="clanSelection.selected.id"
        :players="displayedPlayers"
        :combined="playerList === 'combined'"
        :clan-emblem="roster?.emblem"
        :clan-name="roster?.name"
        :memberships="loadMemberships"
        :entitlements="loadEntitlements"
        @show-guardian="showGuardianTooltip"
        @show-characters="showCharacterTooltip"
        @close-tooltip="closeTooltip"
      />
      <HomePage v-else-if="isHome" />
      <SealPage
        v-else-if="selected && !selected.unavailable"
        :selected="selected"
      />
      <template v-else-if="!isHome"
        ><section
          :class="currentPage ? 'view-unavailable' : 'empty-state'"
          :role="currentPage ? 'status' : undefined"
        >
          <h1 v-if="!currentPage">
            {{ definitions ? 'Page not found' : 'Loading seal definitions…' }}
          </h1>
          <p>
            {{
              selected?.unavailable ||
              (!definitions
                ? busy
                  ? 'Loading definitions…'
                  : 'Definitions could not be loaded. Check the connection and retry.'
                : '')
            }}
          </p>
          <a href="#/">Back to overview</a>
        </section></template
      >
      <Teleport to="body"
        ><ClanPicker
          v-if="clanPickerOpen"
          :selected="clanSelection.selected"
          :recent="clanSelection.recent"
          :fallback="{
            ...fallbackClan,
            name:
              clanSelection.recent.find((clan) => clan.id === fallbackClan.id)
                ?.name ?? fallbackClan.name,
          }"
          :own="ownClan"
          :friends="friendClans"
          :friends-loading="friendsLoading"
          :friends-error="friendsError"
          :directory="clanDirectory"
          @retry-friends="loadFriends(true)"
          @select="selectClan"
          @close="clanPickerOpen = false"
      /></Teleport>
      <TooltipLayer />
      <footer>
        <span>CLAN SEAL TRACKER</span
        ><span
          >Uses Bungie's public API · Data cached locally · Not affiliated with
          Bungie</span
        >
      </footer>
    </main>
  </div>
</template>
