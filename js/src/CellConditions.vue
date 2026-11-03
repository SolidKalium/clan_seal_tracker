<script setup lang="ts">
import { computed } from 'vue';
import ConditionIcon from './ConditionIcon.vue';
import type { RecordCondition } from './recordState';
const props = defineProps<{ conditions?: RecordCondition[] }>();
const watermark = computed(
  () =>
    ['unowned', 'hidden', 'obscured'].find((code) =>
      props.conditions?.some((c) => c.code === code),
    ) as RecordCondition['code'] | undefined,
);
</script>
<template>
  <span
    v-if="conditions?.length"
    class="cell-state"
    role="img"
    :aria-label="conditions.map((c) => c.label).join('; ')"
  >
    <ConditionIcon
      v-if="watermark"
      class="cell-status-watermark"
      :code="watermark"
    />
  </span>
</template>
