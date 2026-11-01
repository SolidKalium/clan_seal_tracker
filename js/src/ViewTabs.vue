<script setup lang="ts">
defineProps<{ label: string; tabs: { href: string; label: string; active: boolean }[] }>();
</script>
<template>
  <nav class="page-modes" :aria-label="label"><a v-for="tab in tabs" :key="tab.href" :href="tab.href" :aria-current="tab.active ? 'page' : undefined"><span class="tab-width" aria-hidden="true">{{ tab.label }}</span><span class="tab-label">{{ tab.label }}</span></a></nav>
</template>
