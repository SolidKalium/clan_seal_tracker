<script setup lang="ts">
import { computed } from 'vue';
import { objectiveGoal, objectiveUnit } from './domain';
import type { Cell, Heading } from './types';
const props = defineProps<{ heading: Heading; cell?: Cell; player?: string; activeObjectiveHash?: string }>();
const headerObjectives = computed(() => props.heading.objectives.length ? props.heading.objectives : props.heading.intervals.slice(-1));
const genericLabel = (text: string) => /^(?:complete|progress)[.!:]?$/i.test(text.trim());
const hideObjectiveLabel = (label: string, count: number) => count === 1 && (
  !label.trim() || genericLabel(label) || label === props.heading.name || /^the .+ raid completed[.!:]?$/i.test(label.trim())
);
const description = computed(() => {
  const text = props.cell?.variants ? props.heading.source : props.heading.description;
  return text && !genericLabel(text) ? text : '';
});
</script>
<template>
  <div class="record-details">
    <p v-if="player" class="eyebrow">{{ player }}</p>
    <h3>{{ heading.name }}</h3>
    <p v-if="heading.itemType" class="item-type">{{ heading.itemType }}</p>
    <ul v-if="heading.perks?.length" class="item-perks"><li v-for="(perk, i) in heading.perks" :key="i"><strong>{{ perk.name }}</strong><p v-if="perk.description">{{ perk.description }}</p></li></ul>
    <p v-if="description && description !== heading.name" class="record-description" :class="{ 'collection-description': heading.collectibleHashes }">{{ description }}</p>
    <template v-if="cell">
      <table v-if="cell.variants" class="armor-comparison" aria-label="Armor collection by class">
        <thead><tr><th scope="col"><span class="sr-only">Collection status</span></th><th v-for="variant in cell.variants" :key="variant.name" scope="col">{{ variant.name }}</th></tr></thead>
        <tbody>
          <tr><th scope="row">{{ heading.label }} Collected</th><td v-for="variant in cell.variants" :key="variant.name" :aria-label="variant.missing ? 'No data' : variant.complete ? 'Collected' : 'Not collected'">{{ variant.complete ? '✓' : variant.missing ? '—' : '' }}</td></tr>
          <tr class="armor-set-status"><th scope="row">Set Complete</th><td v-for="variant in cell.variants" :key="variant.name" :aria-label="variant.setComplete ? 'Set complete' : variant.setMissing ? 'No data' : 'Set incomplete'">{{ variant.setComplete ? '✓' : variant.setMissing ? '—' : '' }}</td></tr>
        </tbody>
      </table>
      <p v-else-if="heading.collectibleHashes" class="objective-state">{{ cell.missing ? 'No collection data available' : cell.complete ? 'Collected' : 'Acquire' }}</p>
      <p v-else-if="cell.missing" class="record-empty">No record data available.</p>
      <p v-else-if="heading.badgeRequirement" class="objective-state">Objective: Acquire badge<span class="badge-acquisition"> · {{ cell.complete ? 'Acquired' : 'Not acquired' }}</span></p>
      <ul v-else-if="cell.objectives.length" class="objective-details">
        <li v-for="(objective, stage) in cell.objectives" :key="objective.hash" :class="{ 'objective-done': objective.complete, 'objective-active': activeObjectiveHash === objective.hash }">
          <span v-if="!hideObjectiveLabel(objective.name, cell.objectives.length)" class="objective-name"><span v-if="cell.objectives.length > 1" class="stage-number">{{ stage + 1 }}</span>{{ objective.name === heading.name ? 'Progress' : objective.name }}</span>
          <span class="objective-count">{{ objective.progress }}<span class="objective-target"> / {{ objective.target }}{{ objectiveUnit(heading, objective.name, objective.target) ? ' ' + objectiveUnit(heading, objective.name, objective.target) : '' }}</span></span>
          <span class="objective-state">{{ objective.complete ? 'Complete' : 'Incomplete' }}</span>
        </li>
      </ul>

      <p v-if="!cell.objectives.length && !cell.missing" class="objective-state">{{ cell.complete ? 'Complete' : 'Incomplete' }}</p>
    </template>
    <p v-else-if="heading.collectibleHashes" class="objective-state">Objective: Acquire</p>
    <ul v-else class="objective-details">
      <li v-for="(objective, stage) in headerObjectives" :key="objective.hash" :class="{ 'objective-active': activeObjectiveHash === String(objective.hash) }">
        <span v-if="!hideObjectiveLabel(objective.progressDescription || objective.displayProperties?.description || 'Progress', headerObjectives.length)" class="objective-name"><span v-if="heading.objectives.length > 1" class="stage-number">{{ stage + 1 }}</span>{{ objective.progressDescription || objective.displayProperties?.description || 'Progress' }}</span><span class="objective-count"><span class="objective-target">Objective: </span>{{ objectiveGoal(heading, objective) }}</span>
      </li>
    </ul>
  </div>
</template>
