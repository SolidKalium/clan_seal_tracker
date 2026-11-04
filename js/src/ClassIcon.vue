<script setup lang="ts">
import { computed } from 'vue';
import { iconMask } from './format';
const props = defineProps<{ name: string; icon?: string }>();
const mask = computed(() => iconMask(props.icon));
</script>
<template>
  <span
    class="class-icon"
    :class="{ 'class-icon-image': mask }"
    role="img"
    :aria-label="name"
    :style="mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined"
    >{{ mask ? '' : name.slice(0, 1) }}</span
  >
</template>
