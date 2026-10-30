<script setup lang="ts">
import type { Cell, Heading } from './types';
defineProps<{ heading: Heading; cell?: Cell; player?: string }>();
</script>
<template>
  <div class="record-details">
    <p v-if="player" class="eyebrow">{{ player }}</p>
    <h3>{{ heading.name }}</h3>
    <p v-if="heading.description && heading.description !== heading.name" class="record-description">{{ heading.description }}</p>
    <template v-if="cell">
      <p v-if="cell.missing" class="record-empty">No record data available.</p>
      <ul v-else-if="cell.objectives.length" class="objective-details">
        <li v-for="(objective, stage) in cell.objectives" :key="objective.hash" :class="{ 'objective-done': objective.complete }">
          <span class="objective-name"><span v-if="cell.objectives.length > 1" class="stage-number">{{ stage + 1 }}</span>{{ objective.name === heading.name ? 'Progress' : objective.name }}</span>
          <span class="objective-count">{{ objective.progress }}<span class="objective-target"> / {{ objective.target }}</span></span>
          <span class="objective-state">{{ objective.complete ? 'Complete' : 'Incomplete' }}</span>
        </li>
      </ul>
      <p v-else class="objective-state">{{ cell.complete ? 'Complete' : 'Incomplete' }}</p>
    </template>
    <ul v-else class="objective-details">
      <li v-for="(objective, stage) in (heading.objectives.length ? heading.objectives : heading.intervals.slice(-1))" :key="objective.hash">
        <span class="objective-name"><span v-if="heading.objectives.length > 1" class="stage-number">{{ stage + 1 }}</span>{{ objective.progressDescription || objective.displayProperties?.description || 'Progress' }}</span><span class="objective-count"><span class="objective-target">Target </span>{{ objective.completionValue }}</span>
      </li>
    </ul>
  </div>
</template>
