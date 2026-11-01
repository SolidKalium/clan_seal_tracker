<script setup lang="ts">
import type { Seal } from './types';
import type { CompletionCounts, RequirementCount } from './completion';
defineProps<{ seal: Seal; label: string; player?: string; counts?: CompletionCounts; badge?: boolean; broader?: boolean }>();
const triumphs = (n: number) => `${n} ${n === 1 ? 'triumph' : 'triumphs'}`;
const collectionColumns = (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`;
const requirementText = (count: RequirementCount) => count.required === undefined
  ? 'The required count is unavailable in this manifest.'
  : count.required === count.total
    ? `All ${triumphs(count.total)} required.`
    : `${count.required} of ${count.total} triumphs required.`;
</script>
<template>
  <div class="record-details completion-details">
    <p v-if="player" class="eyebrow">{{ player }}</p>
    <h3>{{ label }}</h3>
    <template v-if="counts">
      <p v-if="counts.triumphs.total" class="completion-counts">{{ triumphs(counts.triumphs.complete) }} complete<br>{{ triumphs(counts.triumphs.partial) }} partially complete<span v-if="counts.triumphs.missing"><br>{{ triumphs(counts.triumphs.missing) }} with no public record</span></p>
      <p v-if="counts.collections.total" class="completion-counts">{{ collectionColumns(counts.collections.complete) }} collected<br>{{ collectionColumns(counts.collections.partial) }} partially collected<span v-if="counts.collections.missing"><br>{{ collectionColumns(counts.collections.missing) }} with no public record</span></p>
    </template>
    <p v-if="broader" class="record-description">This table averages progress across its included columns. This is a site-defined summary<span v-if="seal.page.sealNodeHash">, separate from earning the seal or gilding it</span>.</p>
    <p v-if="badge" class="completion-rule"><strong>Badge</strong>Acquire the full collection for at least one class.</p>
    <template v-else-if="seal.requirements">
      <p class="completion-rule"><strong>Seal</strong>{{ requirementText(seal.requirements.seal) }}</p>
      <p v-if="seal.requirements.gilding" class="completion-rule"><strong>Gilding</strong><template v-if="seal.requirements.gilding.requiresSeal">Earn the seal, then complete all {{ seal.requirements.gilding.total }} gilding {{ seal.requirements.gilding.total === 1 ? 'triumph' : 'triumphs' }}.</template><template v-else>{{ requirementText(seal.requirements.gilding) }}</template></p>
    </template>
    <template v-if="!player">
      <template v-if="seal.headings.some(h => h.skip)"><h4>Excluded from this table’s {{ label.toLowerCase() }} column</h4><ul class="completion-exclusions"><li v-for="heading in seal.headings.filter(h => h.skip)" :key="heading.hash">{{ heading.label }}</li></ul></template>
      <p v-else class="record-description">All displayed columns are included in this table’s summary.</p>
    </template>
  </div>
</template>
