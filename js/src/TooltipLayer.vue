<script setup lang="ts">
import CharacterDetails from './CharacterDetails.vue';
import CompletionDetails from './CompletionDetails.vue';
import { age } from './format';
import GuardianDetails from './GuardianDetails.vue';
import { nameOf, statusLabel } from './members';
import RecordDetails from './RecordDetails.vue';
import SyncDetails from './SyncDetails.vue';
import { useTracker } from './useTracker';

const {
  tooltip,
  tooltipElement,
  playerList,
  roster,
  syncColor,
  manifestCheckedAt,
  clanCheckedAt,
  lastProfilePass,
} = useTracker();
</script>

<template>
  <Teleport to="body">
    <div
      v-if="tooltip"
      id="record-tooltip"
      ref="tooltipElement"
      class="record-tooltip"
      :class="{ 'compact-tooltip': tooltip.kind === 'note' }"
      role="tooltip"
      :style="tooltip.style"
    >
      <CharacterDetails
        v-if="tooltip.kind === 'characters'"
        :player="tooltip.player"
      /><RecordDetails
        v-else-if="tooltip.kind === 'record'"
        :heading="tooltip.heading"
        :cell="tooltip.cell"
        :player="tooltip.player"
        :active-objective-hash="tooltip.objectiveHash"
      /><CompletionDetails
        v-else-if="tooltip.kind === 'summary'"
        :seal="tooltip.seal"
        :label="tooltip.label"
        :player="tooltip.player"
        :counts="tooltip.counts"
        :badge="tooltip.badge"
        :broader="tooltip.broader"
        :unit="tooltip.seal.page.kind === 'seals' ? 'seal' : undefined"
      /><GuardianDetails
        v-else-if="tooltip.kind === 'guardian'"
        :guardian="tooltip.guardian"
        :earned-title="tooltip.earnedTitle"
        :earned-badge="tooltip.earnedBadge"
        :name="nameOf(tooltip.guardian)"
        :memberships="tooltip.memberships"
        :combined-list="playerList === 'combined'"
        :loading="tooltip.loading"
        :error="tooltip.error"
        :freshness="`${statusLabel(tooltip.guardian)} · ${age(tooltip.guardian.fetchedAt)}`"
      />
      <p v-else-if="tooltip.kind === 'note'" class="tooltip-note">
        {{ tooltip.text }}
      </p>
      <SyncDetails
        v-else
        :color="syncColor"
        :player-list="playerList"
        :roster="roster"
        :manifest-checked-at="manifestCheckedAt"
        :clan-checked-at="clanCheckedAt"
        :last-profile-pass="lastProfilePass"
      />
    </div>
  </Teleport>
</template>
