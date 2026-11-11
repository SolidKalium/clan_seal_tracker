<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
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
  isPhone,
  menuOpen,
  railCollapsed,
  headerHidden,
  toggleMenu,
} = useTracker();
const menuLabel = computed(() =>
  isPhone.value
    ? menuOpen.value
      ? 'Close menu'
      : 'Open menu'
    : railCollapsed.value
      ? 'Expand side menu'
      : 'Collapse side menu',
);
const menuButton = ref<HTMLButtonElement>();
// Return focus to the menu button when the drawer closes from inside it.
watch(menuOpen, async (open) => {
  await nextTick();
  // Return focus to the menu button if it was in the closing drawer.
  const active = document.activeElement;
  if (!open && (active === document.body || active?.closest('#sidebar')))
    menuButton.value?.focus();
});
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
// The sidebar grows into the header's space as the header scrolls away.
let scrollFrame = 0;
function trackScroll() {
  cancelAnimationFrame(scrollFrame);
  scrollFrame = requestAnimationFrame(() => {
    const height = topbar.value?.offsetHeight ?? 0;
    document.documentElement.style.setProperty(
      '--header-scrolled',
      `${Math.min(height, Math.max(0, window.scrollY))}px`,
    );
  });
}
let visibility: IntersectionObserver | undefined;
onMounted(() => {
  window.addEventListener('scroll', trackScroll, { passive: true });
  trackScroll();
  visibility = new IntersectionObserver(([entry]) => {
    headerHidden.value = !entry!.isIntersecting;
  });
  visibility.observe(topbar.value!);
});
onUnmounted(() => {
  topbarObserver?.disconnect();
  visibility?.disconnect();
  window.removeEventListener('scroll', trackScroll);
  cancelAnimationFrame(scrollFrame);
});
</script>

<template>
  <header ref="topbar" class="topbar">
    <div class="topbar-start">
      <button
        ref="menuButton"
        class="menu-toggle"
        :aria-label="menuLabel"
        :title="menuLabel"
        :aria-expanded="isPhone ? menuOpen : !railCollapsed"
        aria-controls="sidebar"
        @click="toggleMenu"
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path
            d="M3 5.5h14M3 10h14M3 14.5h14"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
          />
        </svg>
      </button>
      <a href="#/" class="brand"
        ><span class="brand-mark" aria-hidden="true">◇</span
        ><span>CLAN <strong>SEAL TRACKER</strong></span></a
      >
    </div>
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
