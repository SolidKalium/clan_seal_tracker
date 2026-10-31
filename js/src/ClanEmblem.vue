<script setup lang="ts">
import type { ClanEmblemData } from './clanBanner';
defineProps<{ emblem?: ClanEmblemData; name: string }>();
const layerStyle = (layer: ClanEmblemData['layers'][number]) => ({
  backgroundColor: layer.color,
  maskImage: `url("https://www.bungie.net${layer.path}")`,
  WebkitMaskImage: `url("https://www.bungie.net${layer.path}")`,
});
</script>
<template>
  <div class="clan-emblem" :aria-hidden="emblem ? undefined : true">
    <div v-if="emblem" class="clan-banner" role="img" :aria-label="`${name} clan emblem`" :style="{ backgroundColor: emblem.backgroundColor }"><span v-for="(layer, i) in emblem.layers" :key="i" class="clan-banner-layer" aria-hidden="true" :style="layerStyle(layer)"></span></div>
    <template v-else>◇<span>✦</span></template>
  </div>
</template>
