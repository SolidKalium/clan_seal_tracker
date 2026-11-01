<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ icon?: string }>();
const mask = computed(() => props.icon && /^\/common\/destiny2_content\/icons\/[\w./-]+$/.test(props.icon)
  ? `url("https://www.bungie.net${props.icon}")` : undefined);
</script>
<template>
  <span v-if="mask" class="seal-watermark" aria-hidden="true" :style="{ maskImage: mask, WebkitMaskImage: mask }"></span>
</template>
