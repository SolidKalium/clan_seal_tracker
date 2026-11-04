<script setup lang="ts">
import { computed } from 'vue';
import { iconMask } from './format';
const props = defineProps<{ icon?: string }>();
const mask = computed(() => iconMask(props.icon));
</script>
<template>
  <span
    v-if="mask"
    class="seal-watermark"
    aria-hidden="true"
    :style="{ maskImage: mask, WebkitMaskImage: mask }"
  ></span>
</template>
