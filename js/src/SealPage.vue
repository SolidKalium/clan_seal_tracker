<script setup lang="ts">
import { computed } from 'vue';
import RecordDetails from './RecordDetails.vue';
import SealTable from './SealTable.vue';
import type { Seal } from './types';
import { useTracker } from './useTracker';

const props = defineProps<{ selected: Seal }>();
const {
  activeTriumphsOnly,
  viewDescription,
  search,
  filter,
  sort,
  badgeClass,
  metricView,
  collectionView,
  routeMode,
  rows,
  detail,
} = useTracker();
const badgeClasses = computed(
  () =>
    props.selected.headings.find((h) => new Set(h.collectibleHashes).size > 1)
      ?.classNames ?? [],
);
</script>

<template>
  <p v-if="activeTriumphsOnly" class="legacy-notice active-triumphs-notice">
    Active triumphs · This view only shows active triumphs. Legacy triumphs are
    listed in separate tabs.
  </p>
  <p v-if="selected.legacy && selected.page.sealNodeHash" class="legacy-notice">
    Legacy seal · Bungie lists this seal under Legacy Titles; it can no longer
    be earned. Archived progress remains visible, and individual rewards may
    still be obtainable.
  </p>
  <p
    v-if="selected.legacy && !selected.page.sealNodeHash"
    class="legacy-notice"
  >
    Legacy triumphs · Archived by Bungie. Objective progress is likely missing;
    only completion status may remain. Availability of individual triumphs and
    rewards can differ.
  </p>
  <p v-if="viewDescription" class="lede view-description">
    {{ viewDescription }}
  </p>
  <div class="table-tools">
    <label class="search control-field"
      ><svg
        class="search-icon"
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
      >
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m15.5 15.5 5 5" /></svg
      ><input
        v-model="search"
        aria-label="Search guardians"
        placeholder="Search guardians…"
        type="search" /></label
    ><label class="select-control control-field"
      ><span class="sr-only">Filter progress</span
      ><select v-model="filter" aria-label="Filter progress">
        <option value="all">All guardians</option>
        <option v-if="!metricView" value="incomplete">
          Requirements incomplete
        </option>
        <option v-if="!metricView" value="complete">
          Requirements complete
        </option>
        <option value="unavailable">No public data</option>
      </select></label
    ><label class="select-control control-field"
      ><span class="sr-only">Sort guardians</span
      ><select v-model="sort" aria-label="Sort guardians">
        <option value="progress">
          {{ metricView ? 'Highest first' : 'Closest next · completed last' }}
        </option>
        <option v-if="!metricView" value="highest">
          Highest progress first
        </option>
        <option value="name">Guardian name</option>
        <option value="tenure">Clan tenure · longest first</option>
      </select></label
    ><label
      v-if="routeMode !== 'seal' && badgeClasses.length"
      class="select-control control-field"
      ><span class="sr-only">Badge class</span
      ><select v-model="badgeClass" aria-label="Badge class">
        <option value="best">Best class set</option>
        <option
          v-for="(name, i) in badgeClasses"
          :key="name"
          :value="String(i)"
        >
          {{ name }} set
        </option>
      </select></label
    >
  </div>
  <div class="table-caption">
    <span>{{ rows.length }} guardians shown</span
    ><span v-if="!metricView" class="table-legend"
      ><span
        v-if="routeMode !== 'badge' && selected.page.sealNodeHash"
        class="legend-group-end"
        >✦ Title earned</span
      ><template v-else-if="routeMode === 'badge'"
        ><span>✦ Badge collected</span
        ><span class="earned-gold legend-group-end"
          >✦ All 3 classes</span
        ></template
      ><span>✓ {{ collectionView ? 'Collected' : 'Complete' }}</span
      ><span><span class="legend-progress">●</span> In progress</span
      ><span
        ><span class="legend-zero" aria-hidden="true">·</span> No progress</span
      ></span
    >
  </div>
  <SealTable :selected="selected" />
  <aside v-if="detail" class="detail-panel" aria-live="polite">
    <button
      class="detail-close"
      aria-label="Close record details"
      @click="detail = undefined"
    >
      ×</button
    ><RecordDetails
      :heading="detail.heading"
      :cell="detail.cell"
      :player="detail.player"
    />
  </aside>
  <p v-if="selected.page.category === 'Other'" class="footnote">
    {{
      selected.page.kind === 'seals'
        ? 'Each column tracks a seal’s completion record. Gilding is separate from seal completion.'
        : metricView
          ? 'Values are reported by Bungie without a completion goal.'
          : 'Missing data is shown separately from incomplete progress. Hover over a requirement for details.'
    }}
  </p>
  <p v-else class="footnote">
    <template v-if="routeMode === 'raid' || routeMode === 'badge'"
      >Collection progress uses one whole class set (the most complete by
      default). Shared items count for every class. </template
    ><template v-if="routeMode === 'raid' || routeMode === 'triumphs'"
      >The percentage averages the columns included in this table<span
        v-if="selected.page.sealNodeHash"
        >, separately from the in-game seal requirements</span
      >. </template
    ><template v-if="selected.page.category === 'Activities'">
      Gilding requirements are included in this view’s percentage.</template
    >
    Day-one triumphs and lifetime gilding counts do not affect the percentage. A
    missing record is shown separately from an incomplete one. Watermarks
    explain content locks and visibility conditions on hover. Click a cell for
    objective details.
  </p>
</template>
