<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ name: string; icon?: string }>();
const mask = computed(() => props.icon && /^\/common\/destiny2_content\/icons\/[\w./-]+$/.test(props.icon)
  ? `url("https://www.bungie.net${props.icon}")` : undefined);
</script>
<template>
  <span class="class-icon" :class="{ 'class-icon-image': mask }" role="img" :aria-label="name" :style="mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined">{{ mask ? '' : name.slice(0, 1) }}</span>
</template>
