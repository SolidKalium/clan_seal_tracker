<script setup lang="ts">
import { computed } from 'vue';
import { accountGuardians, memberName } from './members';
import type { PlayerData } from './types';
const props = defineProps<{ player?: PlayerData }>();
const guardians = computed(() => accountGuardians(props.player?.profile));
const lastPlayed = (date?: string) =>
  date && Number.isFinite(Date.parse(date))
    ? new Date(date).toLocaleString()
    : '—';
</script>
<template>
  <div class="record-details character-details">
    <p v-if="player" class="eyebrow">{{ memberName(player) }}</p>
    <h3>Guardians</h3>
    <p v-if="!player" class="record-description">
      Power for each guardian, grouped by class. Multiple guardians of the same
      class are listed separately.
    </p>
    <template v-else>
      <p v-if="!guardians" class="record-empty">
        {{
          player.profile?.characters?.privacy === 2
            ? 'Guardian information is private.'
            : 'Guardian information is unavailable.'
        }}
      </p>
      <p v-else-if="!guardians.length" class="record-empty">
        No guardians reported.
      </p>
      <table
        v-else
        class="character-summary"
        aria-label="Guardians on this account"
      >
        <thead>
          <tr>
            <th scope="col">Class</th>
            <th scope="col">Power</th>
            <th scope="col">Last played</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="guardian in guardians"
            :key="guardian.id"
            :data-character-id="guardian.id"
          >
            <th scope="row">{{ guardian.className }}</th>
            <td>{{ guardian.light ?? '—' }}</td>
            <td>{{ lastPlayed(guardian.dateLastPlayed) }}</td>
          </tr>
        </tbody>
      </table>
      <p
        v-if="player.status === 'private' || player.status === 'stale'"
        class="objective-state"
      >
        Showing retained profile data.
      </p>
    </template>
  </div>
</template>
<style scoped>
.character-summary {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.character-summary th,
.character-summary td {
  position: static;
  min-width: 0;
  max-width: none;
  padding: 7px 8px;
  background: transparent;
  border: 0;
  border-bottom: 1px solid #e6eadf;
  text-align: left;
  font-size: 12px;
}
.character-summary thead th {
  font-weight: 600;
}
.character-summary tbody th {
  font-weight: 400;
}
.character-summary td {
  font-variant-numeric: tabular-nums;
}
.character-summary td:last-child {
  font-size: 11px;
  color: var(--muted);
}
</style>
