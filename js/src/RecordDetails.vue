<script setup lang="ts">
import { computed } from 'vue';
import ClassIcon from './ClassIcon.vue';
import ConditionIcon from './ConditionIcon.vue';
import { objectiveGoal, objectiveUnit } from './domain';
import type { Cell, Heading } from './types';
const props = defineProps<{ heading: Heading; cell?: Cell; player?: string; activeObjectiveHash?: string }>();
const membershipParts = computed(() => new Intl.ListFormat('en', { style: 'long', type: 'conjunction' }).formatToParts((props.heading.seals ?? []).map((_, i) => String(i))));
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
    <p v-if="heading.gilding" class="record-scoring">Gilding requirement.</p>
    <p v-if="heading.skip" class="record-scoring">Excluded from this table's completion column.</p>
    <p v-if="heading.group?.startsWith('Armor · ')" class="item-type">{{ heading.armorSetName }}</p>
    <p v-if="heading.itemType" class="item-type">{{ heading.itemType }}</p>
    <ul v-if="heading.perks?.length" class="item-perks"><li v-for="(perk, i) in heading.perks" :key="i"><strong>{{ perk.name }}</strong><p v-if="perk.description">{{ perk.description }}</p></li></ul>
    <p v-if="description && description !== heading.name" class="record-description" :class="{ 'collection-description': heading.collectibleHashes }">{{ description }}</p>
    <p v-if="heading.seals?.length" class="seal-memberships">This triumph is part of the <template v-for="(part, i) in membershipParts" :key="i"><strong v-if="part.type === 'element'" class="seal-membership">{{ heading.seals[Number(part.value)]!.name }}<span v-if="heading.seals[Number(part.value)]!.title !== heading.seals[Number(part.value)]!.name" class="seal-membership-title"> ({{ heading.seals[Number(part.value)]!.title }})</span></strong><template v-else>{{ part.value }}</template></template> {{ heading.seals.length === 1 ? 'seal' : 'seals' }}.</p>
    <p v-if="cell?.unclaimed" class="claim-status">Completed, but not claimed in game.</p>
    <ul v-if="cell?.conditions?.length" class="record-conditions"><li v-for="condition in cell.conditions" :key="condition.code"><strong><ConditionIcon :code="condition.code" />{{ condition.label }}</strong><span>{{ condition.description }}</span></li></ul>
    <p v-if="cell?.scoringClass && !cell.complete && cell.variants?.some(v => v.complete)" class="armor-scoring-note">
      This {{ heading.label.toLowerCase() }} is marked {{ cell.missing ? 'unavailable' : 'uncollected' }} because
      {{ cell.scoringClass.best ? 'the most complete armor set' : 'the selected armor set' }}
      (<ClassIcon :name="cell.scoringClass.name" :icon="cell.scoringClass.icon" /> {{ cell.scoringClass.name }}<template v-if="cell.scoringClass.armorFraction !== undefined"> · {{ Math.round(cell.scoringClass.armorFraction * 100) }}%</template>)
      {{ cell.missing ? 'has no collection record for it' : 'is missing it' }}.
    </p>
    <template v-if="cell">
      <p v-if="heading.metric" class="metric-count">{{ cell.detail }}</p>
      <table v-else-if="cell.variants" class="armor-comparison" aria-label="Armor collection by class">
        <thead><tr><th scope="col"><span class="sr-only">Collection status</span></th><th v-for="variant in cell.variants" :key="variant.name" scope="col">{{ variant.name }}</th></tr></thead>
        <tbody>
          <tr><th scope="row">{{ heading.label }} Collected</th><td v-for="variant in cell.variants" :key="variant.name" :aria-label="variant.missing ? 'No data' : variant.complete ? 'Collected' : 'Not collected'"><ClassIcon v-if="variant.complete" :name="variant.name" :icon="variant.icon" /><span v-else-if="variant.missing">—</span></td></tr>
          <tr class="armor-set-status"><th scope="row">Set Collected</th><td v-for="variant in cell.variants" :key="variant.name" :aria-label="variant.setComplete ? 'Set collected' : variant.setMissing ? 'No data' : 'Set not fully collected'"><ClassIcon v-if="variant.setComplete" :name="variant.name" :icon="variant.icon" /><span v-else-if="variant.setMissing">—</span></td></tr>
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

      <p v-if="!heading.metric && !cell.objectives.length && !cell.missing" class="objective-state">{{ cell.complete ? 'Complete' : 'Incomplete' }}</p>
    </template>
    <p v-else-if="heading.collectibleHashes" class="objective-state">Objective: Acquire</p>
    <ul v-else-if="!heading.metric" class="objective-details">
      <li v-for="(objective, stage) in headerObjectives" :key="objective.hash" :class="{ 'objective-active': activeObjectiveHash === String(objective.hash) }">
        <span v-if="!hideObjectiveLabel(objective.progressDescription || objective.displayProperties?.description || 'Progress', headerObjectives.length)" class="objective-name"><span v-if="heading.objectives.length > 1" class="stage-number">{{ stage + 1 }}</span>{{ objective.progressDescription || objective.displayProperties?.description || 'Progress' }}</span><span class="objective-count"><span class="objective-target">Objective: </span>{{ objectiveGoal(heading, objective) }}</span>
      </li>
    </ul>
  </div>
</template>
