<script setup lang="ts">
import type { ClanEmblemData } from './clanBanner';
import { bungieUrl } from './format';
defineProps<{ emblem?: ClanEmblemData; name: string }>();
const layerStyle = (layer: ClanEmblemData['layers'][number]) => ({
  backgroundColor: layer.color,
  maskImage: `url("${bungieUrl(layer.path)}")`,
  WebkitMaskImage: `url("${bungieUrl(layer.path)}")`,
});
</script>
<template>
  <div class="clan-emblem" :aria-hidden="emblem ? undefined : true">
    <div
      v-if="emblem"
      class="clan-banner"
      role="img"
      :aria-label="`${name} clan emblem`"
      :style="{ backgroundColor: emblem.backgroundColor }"
    >
      <span
        v-for="(layer, i) in emblem.layers"
        :key="i"
        class="clan-banner-layer"
        aria-hidden="true"
        :style="layerStyle(layer)"
      ></span>
    </div>
    <template v-else>◇<span>✦</span></template>
  </div>
</template>
