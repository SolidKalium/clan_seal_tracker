<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue';
import { plural } from './format';
import { useTracker } from './useTracker';

const {
  busy,
  phase,
  issues,
  profileSyncActive,
  profileSyncDone,
  profileSyncTotal,
  resolved,
  roster,
  failedCount,
  staleCount,
  syncColor,
  openTooltip,
  closeTooltip,
  load,
} = useTracker();
const topbar = ref<HTMLElement>();
let topbarObserver: ResizeObserver | undefined;
watch(topbar, (element) => {
  topbarObserver?.disconnect();
  if (element) {
    topbarObserver = new ResizeObserver(() =>
      document.documentElement.style.setProperty(
        '--header-height',
        `${element.getBoundingClientRect().height}px`,
      ),
    );
    topbarObserver.observe(element);
  }
});
onUnmounted(() => topbarObserver?.disconnect());
</script>

<template>
  <header ref="topbar" class="topbar">
    <a href="#/" class="brand"
      ><span class="brand-mark" aria-hidden="true">◇</span
      ><span>CLAN <strong>SEAL TRACKER</strong></span></a
    >
    <div class="header-status">
      <section class="sync-strip" :class="{ 'sync-busy': busy }">
        <div class="status-copy">
          <div
            class="tooltip-only status-primary"
            @mouseenter="openTooltip($event, { kind: 'sync' })"
            @mouseleave="closeTooltip"
          >
            <button
              class="tooltip-only sync-indicator"
              :class="[`sync-${syncColor}`, { 'is-updating': busy }]"
              aria-label="Record sync status"
              @focus="openTooltip($event, { kind: 'sync' })"
              @blur="closeTooltip"
              @keydown.esc="closeTooltip"
            >
              <span class="status-dot" aria-hidden="true"></span></button
            ><span class="status-heading" role="status">{{
              busy
                ? 'Syncing records'
                : issues.length || failedCount
                  ? 'Sync incomplete'
                  : 'Records synced'
            }}</span>
          </div>
          <span class="status-counts"
            ><template v-if="busy"
              >{{ phase
              }}<span v-if="profileSyncActive">
                · {{ profileSyncDone }} / {{ profileSyncTotal }} done</span
              ></template
            ><template v-else
              >{{ resolved }} /
              {{ roster?.members.length ?? '—' }}
              {{ plural('profile', roster?.members.length ?? 0)
              }}<span v-if="staleCount">
                · {{ staleCount }} stale / private</span
              ><span v-if="failedCount">
                · {{ failedCount }} unavailable</span
              ></template
            ></span
          >
        </div>
      </section>
      <button
        class="refresh"
        :class="{ 'is-refreshing': busy }"
        :aria-busy="busy"
        :disabled="busy"
        :aria-label="busy ? 'Updating…' : 'Refresh data'"
        title="Refresh data"
        @click="load(true)"
      >
        <span class="refresh-icon" aria-hidden="true">↻</span
        ><span class="refresh-label">{{
          busy ? 'Updating…' : 'Refresh data'
        }}</span>
      </button>
    </div>
  </header>
</template>
