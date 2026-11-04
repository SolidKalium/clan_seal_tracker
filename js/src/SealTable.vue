<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import CellConditions from './CellConditions.vue';
import ClassIcon from './ClassIcon.vue';
import type { CompletionCounts } from './completion';
import { displayObjectives } from './displayObjectives';
import { statusLabel } from './members';
import PlayerAffiliations from './PlayerAffiliations.vue';
import type { Heading, Seal } from './types';
import { useTracker } from './useTracker';

const props = defineProps<{ selected: Seal }>();
const {
  busy,
  roster,
  playerList,
  retryingPlayer,
  rows,
  search,
  filter,
  routeMode,
  metricView,
  summaryLabel,
  tooltip,
  openTooltip,
  closeTooltip,
  showTooltip,
  leaveRecordTooltip,
  showGuardianTooltip,
  showDetail,
  retryPlayer,
} = useTracker();
// Cells read these rather than the tooltip, so moving between cells does not rerender the table.
const tooltipId = computed(() =>
  tooltip.value ? 'record-tooltip' : undefined,
);
const summaryTooltipId = computed(() =>
  tooltip.value?.kind === 'summary' ? 'record-tooltip' : undefined,
);
const groupHeader = ref<HTMLElement>();
const groupHeaderHeight = ref(64);
const playerColumnWidth = ref(206);
let headerObserver: ResizeObserver | undefined;
function headingIdentifiers(heading: Heading) {
  return {
    ...(heading.checklist
      ? {
          'data-checklist-hash': heading.checklist.hash,
          'data-checklist-entry-hash': heading.checklist.entryHash,
        }
      : heading.metric &&
          heading.metric !== 'gildingCount' &&
          heading.metric !== 'gilded'
        ? { 'data-metric-key': heading.metricKey }
        : heading.collectibleHashes
          ? {
              'data-collectible-hashes': [
                ...new Set(
                  heading.alternativeCollectibleHashes ??
                    heading.collectibleHashes,
                ),
              ].join(' '),
            }
          : { 'data-record-hash': heading.hash }),
    'data-objective-hashes':
      heading.objectives.map((o) => o.hash).join(' ') || undefined,
  };
}
const objectiveColumns = (heading: Heading) =>
  Math.max(1, displayObjectives(heading, heading.objectives).length);
const hasStages = computed(() =>
  props.selected.headings.some((h) => objectiveColumns(h) > 1),
);
const columnGroups = computed(() => {
  const groups: { name: string; columns: number; color?: string }[] = [];
  for (const heading of props.selected.headings) {
    const name = heading.group ?? 'Triumphs';
    const last = groups.at(-1);
    if (last?.name === name) last.columns += objectiveColumns(heading);
    else
      groups.push({
        name,
        columns: objectiveColumns(heading),
        color: heading.color,
      });
  }
  return groups;
});
const hasColumnGroups = computed(() =>
  columnGroups.value.some((g) => g.name !== 'Triumphs'),
);
const headerRows = computed(
  () => 1 + Number(hasStages.value) + Number(hasColumnGroups.value),
);
const tableColumns = computed(
  () =>
    (metricView.value ? 1 : 2) +
    props.selected.headings.reduce((sum, h) => sum + objectiveColumns(h), 0),
);
function showSummary(event: Event, player?: string, counts?: CompletionCounts) {
  void openTooltip(event, {
    kind: 'summary',
    seal: props.selected,
    label: summaryLabel.value,
    player,
    counts,
    badge: routeMode.value === 'badge',
    broader: routeMode.value === 'raid' || routeMode.value === 'triumphs',
  });
}
watch(groupHeader, (element) => {
  headerObserver?.disconnect();
  if (element) {
    headerObserver = new ResizeObserver(() => {
      groupHeaderHeight.value = element.getBoundingClientRect().height;
      const playerColumn = element
        .closest('table')
        ?.querySelector('.player-column');
      if (playerColumn)
        playerColumnWidth.value = playerColumn.getBoundingClientRect().width;
    });
    headerObserver.observe(element);
    const playerColumn = element
      .closest('table')
      ?.querySelector('.player-column');
    if (playerColumn) headerObserver.observe(playerColumn);
  }
});
onUnmounted(() => headerObserver?.disconnect());
</script>

<template>
  <div class="table-frame">
    <div
      class="table-scroll"
      tabindex="0"
      :aria-label="`Scrollable ${routeMode} progress table`"
      :style="{
        '--group-header-height': `${groupHeaderHeight}px`,
        '--category-header-height': hasColumnGroups ? '32px' : '0px',
        '--player-column-width': `${playerColumnWidth}px`,
      }"
      @scroll="closeTooltip"
    >
      <table>
        <thead>
          <tr v-if="hasColumnGroups" class="category-header-row">
            <th scope="col" class="player-column" :rowspan="headerRows">
              Guardian
            </th>
            <th
              v-if="!metricView"
              scope="col"
              class="progress-column"
              :rowspan="headerRows"
            >
              <button
                class="tooltip-only heading-button summary-heading"
                :aria-describedby="summaryTooltipId"
                @mouseenter="showSummary($event)"
                @mouseleave="closeTooltip"
                @focus="showSummary($event)"
                @blur="closeTooltip"
                @keydown.esc="closeTooltip"
              >
                {{ summaryLabel }}
              </button>
            </th>
            <th
              v-for="(group, i) in columnGroups"
              :key="i"
              scope="colgroup"
              :colspan="group.columns"
              :class="{ 'commendation-section': !!group.color }"
              :style="
                group.color
                  ? { '--commendation-color': group.color }
                  : undefined
              "
            >
              <span class="category-title">{{ group.name }}</span>
            </th>
          </tr>
          <tr ref="groupHeader" class="record-header-row">
            <th
              v-if="!hasColumnGroups"
              scope="col"
              class="player-column"
              :rowspan="headerRows"
            >
              Guardian
            </th>
            <th
              v-if="!hasColumnGroups && !metricView"
              scope="col"
              class="progress-column"
              :rowspan="headerRows"
            >
              <button
                class="tooltip-only heading-button summary-heading"
                :aria-describedby="summaryTooltipId"
                @mouseenter="showSummary($event)"
                @mouseleave="closeTooltip"
                @focus="showSummary($event)"
                @blur="closeTooltip"
                @keydown.esc="closeTooltip"
              >
                {{ summaryLabel }}
              </button>
            </th>
            <th
              v-for="heading in selected.headings"
              :key="heading.hash"
              :scope="objectiveColumns(heading) > 1 ? 'colgroup' : 'col'"
              :colspan="objectiveColumns(heading)"
              :rowspan="hasStages && objectiveColumns(heading) === 1 ? 2 : 1"
              class="tooltip-only record-heading"
              :style="
                heading.color
                  ? { '--commendation-color': heading.color }
                  : undefined
              "
              v-bind="headingIdentifiers(heading)"
              :class="{
                'commendation-section': !!heading.color,
                'commendation-total': heading.metricKey?.startsWith('node:'),
                'heading-gilding':
                  heading.gilding ||
                  heading.metric === 'gildingCount' ||
                  heading.metric === 'gilded',
                'heading-unscored': heading.skip && !metricView,
              }"
              :data-record-tooltip="`header:${heading.hash}`"
              @mouseenter="showTooltip($event, heading)"
              @mouseleave="leaveRecordTooltip"
              @focusin="showTooltip($event, heading)"
              @focusout="leaveRecordTooltip"
            >
              <button
                class="tooltip-only heading-button"
                :aria-describedby="tooltipId"
                @keydown.esc="closeTooltip"
              >
                {{ heading.label
                }}<span v-if="heading.pattern" class="pattern-label"
                  >Pattern available</span
                >
              </button>
            </th>
          </tr>
          <tr v-if="hasStages" class="objective-header-row">
            <template v-for="heading in selected.headings" :key="heading.hash">
              <th
                v-for="(objective, stage) in objectiveColumns(heading) > 1
                  ? displayObjectives(heading, heading.objectives)
                  : []"
                :key="objective.hash"
                scope="col"
                class="tooltip-only objective-heading"
                v-bind="headingIdentifiers(heading)"
                :data-objective-hash="objective.hash"
                :class="{
                  'record-end':
                    stage ===
                    displayObjectives(heading, heading.objectives).length - 1,
                }"
                :data-record-tooltip="`header:${heading.hash}`"
                @mouseenter="
                  showTooltip(
                    $event,
                    heading,
                    undefined,
                    undefined,
                    String(objective.hash),
                  )
                "
                @mouseleave="leaveRecordTooltip"
                @focusin="
                  showTooltip(
                    $event,
                    heading,
                    undefined,
                    undefined,
                    String(objective.hash),
                  )
                "
                @focusout="leaveRecordTooltip"
              >
                <button
                  class="tooltip-only stage-button"
                  :aria-label="`Stage ${heading.objectives.indexOf(objective) + 1}: ${objective.progressDescription || objective.displayProperties?.description || heading.name}`"
                  :aria-describedby="tooltipId"
                  @keydown.esc="closeTooltip"
                >
                  {{ heading.objectives.indexOf(objective) + 1 }}
                </button>
              </th>
            </template>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.id"
            :class="{ 'row-complete': row.complete }"
          >
            <th
              scope="row"
              class="player-column"
              :data-guardian-id="row.id"
              :data-membership-id="row.member.destinyUserInfo.membershipId"
              :data-membership-type="row.member.destinyUserInfo.membershipType"
            >
              <div class="guardian-row">
                <button
                  class="tooltip-only guardian-button"
                  :aria-label="`Guardian details: ${row.name}`"
                  :aria-describedby="tooltipId"
                  @mouseenter="showGuardianTooltip($event, row)"
                  @mouseleave="closeTooltip"
                  @focus="showGuardianTooltip($event, row)"
                  @blur="closeTooltip"
                  @keydown.esc="closeTooltip"
                >
                  <span class="player-name"
                    >{{ row.name
                    }}<small v-if="row.platform" class="joined-platform">
                      ({{ row.platform }})</small
                    ></span
                  ><span class="guardian-markers"
                    ><span
                      v-if="row.earned"
                      class="earned"
                      :class="{ 'earned-gold': row.badge?.allClasses }"
                      :aria-label="row.earnedLabel"
                      >✦</span
                    ><span
                      v-if="
                        ['stale', 'private', 'unavailable'].includes(row.status)
                      "
                      class="guardian-warning"
                      :aria-label="statusLabel(row)"
                      >●</span
                    ></span
                  ></button
                ><button
                  v-if="
                    ['private', 'unavailable', 'stale'].includes(row.status)
                  "
                  class="retry"
                  :class="{ 'is-refreshing': retryingPlayer === row.id }"
                  :aria-busy="retryingPlayer === row.id"
                  :disabled="busy"
                  :aria-label="`Retry profile: ${row.name}`"
                  @click="retryPlayer(row.id)"
                >
                  <span class="refresh-icon" aria-hidden="true">↻</span></button
                ><PlayerAffiliations
                  v-if="playerList === 'combined'"
                  :member="row.member"
                  :emblem="roster?.emblem"
                  :clan-name="roster?.name"
                />
              </div>
            </th>
            <td
              v-if="!metricView"
              class="tooltip-only progress-column summary-cell"
              tabindex="0"
              :aria-label="`${row.name}: ${summaryLabel}`"
              :aria-describedby="summaryTooltipId"
              @mouseenter="showSummary($event, row.name, row.counts)"
              @mouseleave="closeTooltip"
              @focus="showSummary($event, row.name, row.counts)"
              @blur="closeTooltip"
              @keydown.esc="closeTooltip"
            >
              <template v-if="row.hasData"
                ><strong
                  >{{ Math.round(row.fraction * 100) }}<small>%</small></strong
                ><span class="mini-progress"
                  ><span
                    :style="{ width: `${row.fraction * 100}%` }"
                  ></span></span></template
              ><span v-else class="muted">{{
                row.status === 'loading' ? 'Loading…' : 'No data'
              }}</span>
            </td>
            <template
              v-for="(cell, i) in row.cells"
              :key="row.headings[i]!.hash"
            >
              <td
                v-if="cell.variants"
                class="record-end armor-ownership-cell"
                :class="{
                  'cell-complete': cell.complete,
                  'cell-unclaimed': cell.unclaimed,
                  'cell-missing': cell.variants.every((v) => v.missing),
                }"
                :data-record-tooltip="`player:${row.id}:${row.headings[i]!.hash}`"
                @mouseenter="
                  showTooltip($event, row.headings[i]!, cell, row.name)
                "
                @mouseleave="leaveRecordTooltip"
                @focusin="showTooltip($event, row.headings[i]!, cell, row.name)"
                @focusout="leaveRecordTooltip"
              >
                <button
                  class="cell-button armor-ownership"
                  :style="{ '--class-count': cell.variants.length }"
                  :aria-describedby="tooltipId"
                  :aria-label="`${row.name}: ${row.headings[i]!.name}: ${
                    cell.variants.some((v) => v.complete)
                      ? 'collected for ' +
                        cell.variants
                          .filter((v) => v.complete)
                          .map((v) => v.name)
                          .join(', ')
                      : cell.variants.some((v) => v.missing)
                        ? 'collection data unavailable'
                        : 'not collected'
                  }`"
                  @keydown.esc="closeTooltip"
                  @click="showDetail(row.name, row.headings[i]!, cell)"
                >
                  <span
                    v-for="variant in cell.variants"
                    :key="variant.name"
                    class="class-slot"
                    :data-class="variant.name"
                    ><ClassIcon
                      v-if="variant.complete"
                      :name="variant.name"
                      :icon="variant.icon"
                    /><span
                      v-else-if="variant.missing"
                      class="cell-missing"
                      :aria-label="`${variant.name} data unavailable`"
                      >—</span
                    ></span
                  >
                  <span
                    v-if="cell.variants.every((v) => !v.complete && !v.missing)"
                    class="cell-zero ownership-empty"
                    >·</span
                  >
                </button>
              </td>
              <td
                v-else-if="
                  cell.complete ||
                  !displayObjectives(row.headings[i]!, cell.objectives).length
                "
                :colspan="objectiveColumns(row.headings[i]!)"
                :style="
                  row.headings[i]!.color
                    ? { '--commendation-color': row.headings[i]!.color }
                    : undefined
                "
                :class="{
                  'commendation-section': !!row.headings[i]!.color,
                  'commendation-total':
                    row.headings[i]!.metricKey?.startsWith('node:'),
                  'cell-metric': metricView,
                  'cell-complete': cell.complete,
                  'cell-unclaimed': cell.unclaimed,
                  'cell-progress': cell.fraction > 0 && !cell.complete,
                  'cell-missing': cell.missing,
                  'cell-zero': !cell.missing && cell.text === '·',
                  'cell-unowned': cell.unowned,
                  'cell-conditioned': !!cell.conditions?.length,
                }"
                class="record-end"
                :data-record-tooltip="`player:${row.id}:${row.headings[i]!.hash}`"
                @mouseenter="
                  showTooltip($event, row.headings[i]!, cell, row.name)
                "
                @mouseleave="leaveRecordTooltip"
                @focusin="showTooltip($event, row.headings[i]!, cell, row.name)"
                @focusout="leaveRecordTooltip"
              >
                <button
                  class="cell-button"
                  :aria-describedby="tooltipId"
                  :aria-label="`${row.name}: ${row.headings[i]!.name}: ${row.headings[i]!.collectibleHashes || row.headings[i]!.checklist ? (cell.missing ? 'no collection data' : cell.complete ? 'collected' : 'not collected') : row.headings[i]!.metric ? cell.detail : cell.complete ? (cell.unclaimed ? 'complete, unclaimed' : 'complete') : cell.missing ? 'no record' : 'incomplete'}`"
                  @keydown.esc="closeTooltip"
                  @click="showDetail(row.name, row.headings[i]!, cell)"
                >
                  {{
                    cell.text === '·' && cell.conditions?.length
                      ? ''
                      : cell.text
                  }}</button
                ><CellConditions :conditions="cell.conditions" />
              </td>
              <template v-else>
                <td
                  v-for="(objective, j) in displayObjectives(
                    row.headings[i]!,
                    cell.objectives,
                  )"
                  :key="objective.hash"
                  :class="{
                    'cell-complete': objective.complete,
                    'cell-progress':
                      objective.fraction > 0 && !objective.complete,
                    'cell-missing': objective.missing,
                    'cell-zero': !objective.missing && objective.text === '·',
                    'cell-unowned': cell.unowned,
                    'cell-conditioned': !!cell.conditions?.length,
                    'record-end':
                      j ===
                      displayObjectives(row.headings[i]!, cell.objectives)
                        .length -
                        1,
                  }"
                  :data-record-tooltip="`player:${row.id}:${row.headings[i]!.hash}`"
                  @mouseenter="
                    showTooltip(
                      $event,
                      row.headings[i]!,
                      cell,
                      row.name,
                      objective.hash,
                    )
                  "
                  @mouseleave="leaveRecordTooltip"
                  @focusin="
                    showTooltip(
                      $event,
                      row.headings[i]!,
                      cell,
                      row.name,
                      objective.hash,
                    )
                  "
                  @focusout="leaveRecordTooltip"
                >
                  <button
                    class="cell-button"
                    :aria-describedby="tooltipId"
                    :aria-label="`${row.name}: ${row.headings[i]!.name}: ${objective.name}: ${objective.missing ? 'no record' : objective.complete ? 'complete' : `${objective.progress}/${objective.target}`}`"
                    @keydown.esc="closeTooltip"
                    @click="showDetail(row.name, row.headings[i]!, cell)"
                  >
                    {{
                      objective.text === '·' && cell.conditions?.length
                        ? ''
                        : objective.text
                    }}</button
                  ><CellConditions :conditions="cell.conditions" />
                </td>
              </template>
            </template>
          </tr>
          <tr v-if="!rows.length">
            <td :colspan="tableColumns" class="empty-state">
              {{
                !roster
                  ? busy
                    ? 'Loading players…'
                    : 'Player list is unavailable. See the connection notice above.'
                  : busy
                    ? 'Loading guardians…'
                    : 'No guardians match this view.'
              }}<button
                v-if="search || filter !== 'all'"
                class="text-button"
                @click="
                  search = '';
                  filter = 'all';
                "
              >
                Reset filters
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
