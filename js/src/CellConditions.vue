<script setup lang="ts">
import type { RecordCondition } from './recordState';
defineProps<{ conditions?: RecordCondition[] }>();
</script>
<template>
  <span v-if="conditions?.length" class="cell-conditions" role="img" :aria-label="conditions.map(c => c.label).join('; ')">
    <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <g v-if="conditions[0]!.code === 'unowned'"><rect x="3" y="7" width="10" height="7" rx="1" /><path d="M5 7V5a3 3 0 0 1 6 0v2M8 10v1" /></g>
      <g v-else-if="conditions[0]!.code === 'hidden'"><path d="M2 2l12 12M6 4.5A9 9 0 0 1 14 8a10 10 0 0 1-2 2.5M3.5 5.5A10 10 0 0 0 2 8c3 4.5 7 4.5 9 3" /></g>
      <g v-else-if="conditions[0]!.code === 'obscured'"><circle cx="8" cy="8" r="6" /><path d="M6 6a2 2 0 1 1 3 1.7c-1 .5-1 1-1 1.3M8 11.5h.01" /></g>
    </svg><span v-if="conditions.length > 1" class="condition-more" aria-hidden="true">+</span>
  </span>
</template>
