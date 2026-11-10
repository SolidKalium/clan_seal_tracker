<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import ClanEmblem from './ClanEmblem.vue';
import { catalog, catalogGroups } from './catalog';
import { plural } from './format';
import FriendIcon from './FriendIcon.vue';
import type { PlayerList } from './playerLists';
import { useTracker } from './useTracker';

const {
  account,
  ownClan,
  loginNotice,
  playerList,
  clanSelection,
  clanPickerOpen,
  roster,
  displayedPlayers,
  busy,
  preferencesReady,
  sidebarCollapsed,
  isHome,
  routeId,
  groupedPage,
  sealsById,
  pageMode,
  changePlayerList,
  signIn,
  signOut,
  clearCache,
} = useTracker();
const guardianCount = computed(() => displayedPlayers.value.length);
const openSections = ref<string[]>([]);
watch(
  () => catalog.find((p) => p.id === routeId.value)?.category,
  (category) => {
    openSections.value = [category ?? 'Raid seals'];
  },
  { immediate: true },
);
function toggleSection(category: string) {
  openSections.value = openSections.value.includes(category)
    ? openSections.value.filter((value) => value !== category)
    : [...openSections.value, category];
}
</script>

<template>
  <aside class="sidebar" aria-label="Clan navigation">
    <button
      class="sidebar-toggle"
      :aria-label="sidebarCollapsed ? 'Expand side menu' : 'Collapse side menu'"
      :aria-expanded="!sidebarCollapsed"
      aria-controls="clan-menu"
      :title="sidebarCollapsed ? 'Expand side menu' : 'Collapse side menu'"
      @click="sidebarCollapsed = !sidebarCollapsed"
    >
      <svg
        viewBox="0 0 20 20"
        aria-hidden="true"
        :class="{ reversed: sidebarCollapsed }"
      >
        <path
          d="m12 4-6 6 6 6"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
    <label
      v-show="!sidebarCollapsed"
      class="player-list-control select-control control-field"
      ><span>Players</span
      ><select
        aria-label="Players to show"
        :value="playerList"
        :disabled="!preferencesReady"
        @change="
          changePlayerList(
            ($event.target as HTMLSelectElement).value as PlayerList,
          )
        "
      >
        <option value="clan">Selected clan</option>
        <option value="friends" :disabled="!account">My friends</option>
        <option value="combined" :disabled="!account">
          My clan and friends
        </option>
      </select></label
    >
    <div
      class="sidebar-identity-icons"
      :class="{ 'is-combined': playerList === 'combined' }"
    >
      <FriendIcon
        v-if="sidebarCollapsed && playerList !== 'clan'"
        class="sidebar-friend-icon"
        aria-label="Friends"
      />
      <span
        v-if="sidebarCollapsed && playerList === 'combined'"
        class="sidebar-identity-plus"
        aria-hidden="true"
        >+</span
      >
      <div class="sidebar-clan-identity">
        <ClanEmblem
          v-if="playerList !== 'friends'"
          class="sidebar-clan-icon"
          :emblem="roster?.emblem"
          :name="roster?.name ?? 'Clan'"
        />
        <div class="sidebar-identity-name">
          <p v-if="!sidebarCollapsed" class="eyebrow identity-eyebrow">
            <span v-if="playerList !== 'friends'">CLAN</span
            ><span v-if="playerList === 'combined'" class="identity-label-plus"
              >+</span
            ><template v-if="playerList !== 'clan'"
              ><FriendIcon
                class="identity-friend-icon"
                aria-hidden="true"
              /><span>FRIENDS</span></template
            >
          </p>
          <h2
            class="clan-name"
            :data-clan-id="
              playerList === 'clan'
                ? clanSelection.selected.id
                : playerList === 'combined'
                  ? ownClan?.id
                  : undefined
            "
            :class="{ 'clan-name-short': (roster?.name.length ?? 0) <= 16 }"
          >
            <template v-if="playerList === 'friends' && account"
              ><span class="friend-owner">{{ account.name.trimEnd() }}’s</span
              >{{ ' ' }}<span class="friend-list-label">friends</span></template
            ><template v-else>{{
              roster?.name ??
              (playerList === 'clan'
                ? clanSelection.selected.name
                : playerList === 'combined'
                  ? (ownClan?.name ?? 'My clan and friends')
                  : 'My friends')
            }}</template>
          </h2>
        </div>
      </div>
    </div>
    <div class="sidebar-actions">
      <button
        v-if="playerList !== 'friends'"
        class="clan-picker-button"
        :class="{ 'clan-picker-collapsed': sidebarCollapsed }"
        aria-label="Choose clan"
        :disabled="!preferencesReady"
        @click="clanPickerOpen = true"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
        >
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m15.5 15.5 5 5" /></svg
        ><span v-if="!sidebarCollapsed">Choose clan</span>
      </button>
      <div
        class="login-controls"
        :class="{ 'login-collapsed': sidebarCollapsed }"
      >
        <template v-if="account"
          ><span
            v-if="!sidebarCollapsed"
            class="login-name"
            :data-bungie-membership-id="account.membershipId"
            :data-membership-id="account.primary?.membershipId"
            :data-membership-type="account.primary?.membershipType"
            ><span class="login-display-name">{{ account.name }}</span
            ><span v-if="account.nameCode" class="login-name-code"
              >#{{ account.nameCode }}</span
            ></span
          ><button
            v-if="!sidebarCollapsed"
            type="button"
            aria-label="Sign out"
            @click="signOut()"
          >
            <span aria-hidden="true">↪</span
            ><span v-if="!sidebarCollapsed">Sign out</span>
          </button></template
        >
        <button
          v-else
          type="button"
          aria-label="Sign in with Bungie"
          :disabled="!preferencesReady"
          @click="signIn"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            aria-hidden="true"
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M4 22v-3a8 8 0 0 1 16 0v3" /></svg
          ><span v-if="!sidebarCollapsed">Sign in with Bungie</span>
        </button>
      </div>
    </div>
    <p v-if="loginNotice" class="login-notice" role="status">
      {{ loginNotice }}
    </p>
    <div v-show="!sidebarCollapsed" id="clan-menu" class="sidebar-content">
      <p class="muted small">
        {{
          roster
            ? `${guardianCount} ${plural('guardian', guardianCount)}`
            : busy
              ? 'Connecting to Bungie'
              : 'Check the connection notice'
        }}
      </p>
      <a href="#/" class="nav-home" :class="{ active: isHome }"
        >Overview <span>↗</span></a
      >
      <div
        v-for="group in catalogGroups"
        :key="group.name"
        class="sidebar-section"
      >
        <button
          class="eyebrow section-toggle"
          :aria-expanded="openSections.includes(group.category)"
          :aria-controls="group.id"
          @click="toggleSection(group.category)"
        >
          <span>{{ group.name }}</span
          ><svg
            viewBox="0 0 20 20"
            aria-hidden="true"
            :class="{ expanded: openSections.includes(group.category) }"
          >
            <path
              d="m7 4 6 6-6 6"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <nav
          v-show="openSections.includes(group.category)"
          :id="group.id"
          class="seal-nav"
          :aria-label="group.name"
        >
          <a
            v-for="page in group.pages"
            :key="page.id"
            :href="`#/${pageMode(page)}/${page.id}`"
            :class="{
              active: routeId === page.id || groupedPage?.id === page.id,
            }"
            :aria-current="
              routeId === page.id || groupedPage?.id === page.id
                ? 'page'
                : undefined
            "
            ><span
              >{{ page.name
              }}<small v-if="sealsById[page.id]?.legacy" class="legacy-label"
                >Legacy</small
              ></span
            ><svg
              class="nav-chevron"
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
            >
              <path
                d="m7 4 6 6-6 6"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              /></svg
          ></a>
        </nav>
      </div>
      <div class="sidebar-bottom">
        <span class="small">Stored in this browser</span
        ><button class="text-button" :disabled="busy" @click="clearCache">
          Clear API cache
        </button>
      </div>
    </div>
  </aside>
</template>
