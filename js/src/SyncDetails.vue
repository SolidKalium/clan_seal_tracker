<script setup lang="ts">
import { age } from './format';
import type { PlayerList } from './playerLists';
import type { ProfilePass, Roster } from './types';

defineProps<{
  color: string;
  playerList: PlayerList;
  roster?: Roster;
  manifestCheckedAt?: number;
  clanCheckedAt?: number;
  lastProfilePass?: ProfilePass;
}>();
const syncLegend = [
  {
    color: 'green',
    label: 'Records synced',
    description: 'Available records are up to date.',
  },
  {
    color: 'amber',
    label: 'Updating or needs attention',
    description:
      'Records are updating, stale, private, or stored only for this session.',
  },
  {
    color: 'red',
    label: 'Some records unavailable',
    description: 'A request failed. Check the error details or retry.',
  },
];
</script>

<template>
  <div class="record-details sync-details">
    <h3>Sync status</h3>
    <div class="sync-history">
      <h4>Latest checks</h4>
      <p>
        Game definitions:
        <strong>{{
          manifestCheckedAt ? age(manifestCheckedAt) : 'not yet checked'
        }}</strong>
      </p>
      <p>
        {{ playerList === 'friends' ? 'Friends list' : 'Clan roster' }}:
        <strong>{{
          clanCheckedAt ? age(clanCheckedAt) : 'not yet checked'
        }}</strong
        ><span v-if="roster && clanCheckedAt" class="sync-detail-line"
          >{{
            roster.members.filter((member) => member.isOnline).length
          }}
          members online</span
        >
      </p>
      <p v-if="lastProfilePass">
        Profiles:
        <strong>{{ age(lastProfilePass.completedAt) }}</strong>
        <span class="sync-detail-line"
          >{{ lastProfilePass.loaded }}
          {{ lastProfilePass.loaded === 1 ? 'profile' : 'profiles' }}
          refreshed</span
        >
        <span class="sync-detail-line"
          >{{ lastProfilePass.reused }}
          {{ lastProfilePass.reused === 1 ? 'profile' : 'profiles' }}
          already up to date</span
        >
        <span class="sync-detail-line"
          >{{ lastProfilePass.private }}
          {{ lastProfilePass.private === 1 ? 'profile is' : 'profiles are' }}
          private</span
        >
        <span v-if="lastProfilePass.unavailable" class="sync-detail-line"
          >{{ lastProfilePass.unavailable }}
          {{
            lastProfilePass.unavailable === 1
              ? 'profile check'
              : 'profile checks'
          }}
          failed</span
        >
      </p>
    </div>
    <ul class="sync-legend">
      <li
        v-for="status in syncLegend"
        :key="status.color"
        :class="[`sync-${status.color}`, { current: color === status.color }]"
      >
        <span class="status-dot" aria-hidden="true"></span>
        <div>
          <span class="sync-legend-label">{{ status.label }}</span>
          <p>{{ status.description }}</p>
        </div>
      </li>
    </ul>
  </div>
</template>
