<script setup lang="ts">
import { computed } from 'vue';
import { inlineSymbols } from './inlineSymbols';
const props = defineProps<{ text: string }>();
const parts = computed(() => inlineSymbols(props.text));
</script>
<template>
  <template v-for="(part, i) in parts" :key="i"
    ><span
      v-if="part.label"
      class="destiny-symbol"
      role="img"
      :aria-label="part.label"
      >{{ part.text }}</span
    ><span v-else-if="part.action" class="destiny-action">{{ part.text }}</span
    ><template v-else>{{ part.text }}</template></template
  >
</template>
<style>
@font-face {
  font-family: DestinySymbols;
  src: url('./assets/DestinySymbols.woff2') format('woff2');
  font-display: block;
}
.destiny-symbol {
  font-family: DestinySymbols;
  font-size: 1.15em;
  font-weight: normal;
  font-style: normal;
  line-height: 1;
  display: inline-block;
  vertical-align: -0.08em;
  margin-inline: 0.08em;
}
.destiny-action {
  font-weight: 600;
}
</style>
