<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref } from 'vue';
import type { FriendClan } from './friends';
import {
  clanSuggestions,
  type ClanChoice,
  type ClanDirectory,
  type RecentClan,
} from './clanSearch';
const props = defineProps<{
  selected: ClanChoice;
  recent: RecentClan[];
  fallback: ClanChoice;
  own?: ClanChoice;
  friends?: FriendClan[];
  friendsLoading?: boolean;
  friendsError?: string;
  directory: ClanDirectory;
}>();
const emit = defineEmits<{
  select: [clan: ClanChoice];
  close: [];
  retryFriends: [];
}>();
const dialog = ref<HTMLDialogElement>(),
  input = ref<HTMLInputElement>();
const query = ref(''),
  submitted = ref(''),
  loading = ref(false),
  error = ref('');
const results = ref<ClanChoice[]>(),
  hasMore = ref(false),
  page = ref(1);
let continuation: string | undefined,
  generation = 0;
const suggestions = computed(() =>
  clanSuggestions(
    props.selected,
    props.recent,
    props.fallback,
    props.own,
    props.friends,
  ),
);
const choices = computed(
  () => results.value ?? suggestions.value.map((entry) => entry.clan),
);
function reason(clan: ClanChoice) {
  return suggestions.value.find((entry) => entry.clan.id === clan.id);
}
onMounted(async () => {
  dialog.value!.showModal();
  await nextTick();
  input.value?.focus();
});
onBeforeUnmount(() => {
  generation++;
  dialog.value?.close();
});
function backdropClick(event: MouseEvent) {
  if (event.target !== dialog.value) return;
  const bounds = dialog.value.getBoundingClientRect();
  if (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  )
    emit('close');
}
async function search(more = false) {
  const text = more ? submitted.value : query.value.trim();
  if (!text) {
    generation++;
    results.value = undefined;
    error.value = '';
    hasMore.value = false;
    loading.value = false;
    return;
  }
  const request = ++generation;
  loading.value = true;
  error.value = '';
  if (!more) {
    results.value = [];
    hasMore.value = false;
    page.value = 1;
    continuation = undefined;
    submitted.value = text;
  }
  try {
    const found = await props.directory.search(
      text,
      more ? page.value + 1 : 1,
      more ? continuation : undefined,
    );
    if (request !== generation) return;
    const next = more
      ? [...(results.value ?? []), ...found.clans]
      : found.clans;
    results.value = [...new Map(next.map((clan) => [clan.id, clan])).values()];
    if (more) page.value++;
    hasMore.value = found.hasMore;
    continuation = found.continuation;
  } catch (cause) {
    if (request === generation)
      error.value =
        cause instanceof Error
          ? cause.message
          : 'Clan search failed. Please retry.';
  } finally {
    if (request === generation) loading.value = false;
  }
}
</script>
<template>
  <dialog
    ref="dialog"
    class="clan-picker"
    aria-labelledby="clan-picker-title"
    @cancel.prevent="emit('close')"
    @click="backdropClick"
  >
    <div class="picker-heading">
      <h2 id="clan-picker-title">Choose a clan</h2>
      <button
        class="picker-close"
        aria-label="Close clan search"
        @click="emit('close')"
      >
        ×
      </button>
    </div>
    <form class="clan-search-form" @submit.prevent="search()">
      <label for="clan-search">Clan name or ID</label>
      <div>
        <input
          id="clan-search"
          ref="input"
          v-model="query"
          type="search"
          autocomplete="off"
        /><button type="submit" :disabled="loading">Search</button>
      </div>
    </form>
    <p v-if="error" class="picker-error" role="alert">{{ error }}</p>
    <p v-if="loading" role="status">Searching clans…</p>
    <p v-else-if="results && !choices.length && !error" role="status">
      No clans found. Try another name or a clan ID.
    </p>
    <p v-if="friendsLoading" class="friends-status" role="status">
      Finding friends’ clans…
    </p>
    <p v-else-if="friendsError" class="picker-error" role="status">
      {{ friendsError }}
      <button class="friends-retry" @click="emit('retryFriends')">
        Retry friends
      </button>
    </p>
    <ul class="clan-choices">
      <li v-for="clan in choices" :key="clan.id">
        <button :data-clan-id="clan.id" @click="emit('select', clan)">
          <span class="clan-choice-top">
            <span class="clan-choice-summary"
              ><span class="clan-choice-name">{{ clan.name }}</span
              ><span
                v-if="clan.memberCount !== undefined"
                class="clan-choice-count"
                >{{ clan.memberCount }} members</span
              ></span
            >
            <span class="clan-choice-id">ID {{ clan.id }}</span>
          </span>
          <span v-if="reason(clan)" class="clan-choice-meta"
            ><span>{{ reason(clan)!.reason }}</span
            ><small v-if="reason(clan)?.viewedAt">{{
              new Date(reason(clan)!.viewedAt!).toLocaleDateString()
            }}</small></span
          >
        </button>
      </li>
    </ul>
    <button
      v-if="hasMore && !error"
      class="picker-more"
      :disabled="loading"
      @click="search(true)"
    >
      More clans
    </button>
    <button
      v-if="results"
      class="picker-recent"
      @click="
        query = '';
        search();
      "
    >
      Back to recent clans
    </button>
  </dialog>
</template>
<style scoped>
.clan-picker {
  width: 480px;
  max-width: calc(100vw - 32px);
  max-height: 80vh;
  overflow: auto;
  padding: 24px;
  border: 1px solid #c6d2be;
  border-radius: 10px;
  background: #fffef9;
  color: var(--ink);
  box-shadow: 0 10px 50px #152d2933;
}
.clan-picker::backdrop {
  background: #152d2970;
}
.picker-heading {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  margin-bottom: 18px;
}
.picker-heading h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 500;
}
.picker-close {
  border: 0;
  background: none;
  font-size: 28px;
  padding: 0 6px;
  line-height: 1;
}
.clan-search-form label {
  display: block;
  font-size: 12px;
  margin-bottom: 6px;
}
.clan-search-form > div {
  display: flex;
  gap: 8px;
}
.clan-search-form input {
  min-width: 0;
  flex: 1;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: #fff;
  padding: 10px;
  color: var(--ink);
}
.clan-search-form button,
.picker-more {
  padding: 9px 14px;
  border: 1px solid #bbcbb3;
  border-radius: 5px;
  background: #e8efdf;
}
.clan-choices {
  list-style: none;
  padding: 0;
  margin: 18px 0 0;
  display: grid;
  gap: 6px;
}
.clan-choices button {
  width: 100%;
  text-align: left;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: transparent;
  padding: 12px;
}
.clan-choices button:hover {
  background: #edf3e6;
  border-color: #a4b69a;
}
.clan-choice-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.clan-choice-summary {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 3px 10px;
  min-width: 0;
}
.clan-choice-count {
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
}
.clan-choice-name {
  font-size: 15px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.clan-choice-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 11px;
  color: var(--muted);
  margin-top: 5px;
}
.clan-choice-meta small {
  font-size: 10px;
}
.picker-more {
  margin-top: 12px;
}
.picker-recent {
  display: block;
  border: 0;
  background: none;
  text-decoration: underline;
  margin-top: 14px;
  padding: 4px 0;
  font-size: 12px;
}
.picker-error {
  color: #93611c;
  font-size: 12px;
  line-height: 1.5;
}
.clan-choice-id {
  flex-shrink: 0;
  font-size: 10px;
  color: var(--muted);
  opacity: 0.8;
  white-space: nowrap;
}
.friends-status {
  font-size: 12px;
  color: var(--muted);
}
.friends-retry {
  border: 0;
  background: none;
  color: inherit;
  text-decoration: underline;
  padding: 3px;
}
</style>
