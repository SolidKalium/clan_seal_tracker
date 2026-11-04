import { computed, type Ref, type ShallowRef } from 'vue';
import { compareClanTenure } from './clan';
import { completionCounts } from './completion';
import {
  badgeOwnership,
  bestBadgeClass,
  formatClasses,
  headingCell,
  sealAwarded,
  selectRecord,
  type PageMode,
} from './domain';
import { clanMembershipPlatform, memberKey, nameOf } from './members';
import {
  playerStringVariables,
  resolveHeadingStrings,
} from './stringVariables';
import type { Heading, PlayerData, Seal, UserInfo } from './types';

/**
 * Builds table rows in two stages, so search, filter, and sort changes reuse
 * the cells built for each player.
 */
export function useTableRows(options: {
  selected: Ref<Seal | undefined>;
  selectedTemplate: Ref<{ headings: Heading[] } | undefined>;
  routeMode: Ref<PageMode>;
  metricView: Ref<boolean>;
  displayedPlayers: Ref<PlayerData[]>;
  linkedPlatforms: ShallowRef<Record<string, UserInfo[]>>;
  search: Ref<string>;
  filter: Ref<string>;
  sort: Ref<string>;
  badgeClass: Ref<string>;
}) {
  const {
    selected,
    selectedTemplate,
    routeMode,
    metricView,
    displayedPlayers,
    linkedPlatforms,
    search,
    filter,
    sort,
    badgeClass,
  } = options;
  const playerRows = computed(() => {
    const seal = selected.value;
    if (!seal) return [];
    const scored = seal.headings.filter((h) => !h.skip);
    const gildingIndex = seal.headings.findIndex(
      (h) => h.metric === 'gildingCount' || h.metric === 'gilded',
    );
    return displayedPlayers.value.map((p) => {
      const id = memberKey(p.member);
      let hasData =
        routeMode.value === 'badge'
          ? !!(
              p.profile?.profileCollectibles?.data ||
              p.profile?.characterCollectibles?.data
            )
          : !!p.profile?.profileRecords?.data;
      const classIndex =
        badgeClass.value === 'best'
          ? bestBadgeClass(p.profile, seal.headings)
          : Math.max(0, Number(badgeClass.value));
      const headings = (selectedTemplate.value?.headings ?? seal.headings).map(
        (h) => {
          const record = p.profile && selectRecord(p.profile, h);
          const characterId =
            h.scope === 1 && record
              ? Object.entries(p.profile?.characterRecords?.data ?? {}).find(
                  ([, character]) => character.records[h.hash] === record,
                )?.[0]
              : undefined;
          return resolveHeadingStrings(
            h,
            playerStringVariables(p.profile, characterId),
          );
        },
      );
      const cells = headings.map((h) =>
        headingCell(
          p.profile,
          h,
          classIndex,
          headings,
          badgeClass.value === 'best' ? 'best' : 'selected',
        ),
      );
      if (seal.page.category === 'Other')
        hasData = cells.some((c) => !c.missing);
      const metricValue = cells[0]?.missing ? -1 : Number(cells[0]?.text ?? -1);
      const score = cells.reduce(
        (sum, cell, i) => sum + (seal.headings[i]!.skip ? 0 : cell.fraction),
        0,
      );
      const fraction = scored.length ? score / scored.length : 0;
      const gildings =
        gildingIndex >= 0 && !cells[gildingIndex]!.missing
          ? seal.headings[gildingIndex]!.metric === 'gilded'
            ? Number(cells[gildingIndex]!.complete)
            : Number(cells[gildingIndex]!.text)
          : -1;
      const badge =
        routeMode.value === 'badge'
          ? badgeOwnership(p.profile, seal.headings)
          : undefined;
      const earned = badge
        ? badge.completeClasses.length > 0
        : sealAwarded(p.profile, seal);
      const earnedLabel = badge
        ? `${seal.page.name} badge collected on ${badge.allClasses ? 'all 3 classes' : formatClasses(badge.completeClasses)}`
        : `${seal.title} title earned`;
      return {
        id,
        ...p,
        badge,
        earned,
        earnedLabel,
        name: nameOf(p),
        headings,
        cells,
        counts: completionCounts(seal.headings, cells),
        fraction,
        gildings,
        metricValue,
        hasData,
        complete: hasData && scored.length > 0 && fraction >= 1,
      };
    });
  });
  const rows = computed(() =>
    playerRows.value
      .filter(
        (row) =>
          row.name.toLowerCase().includes(search.value.trim().toLowerCase()) &&
          (filter.value === 'all' ||
            (filter.value === 'complete'
              ? row.complete
              : filter.value === 'incomplete'
                ? row.hasData && !row.complete
                : !row.hasData)),
      )
      .sort((a, b) => {
        if (sort.value === 'tenure')
          return (
            compareClanTenure(a.member, b.member) ||
            a.name.localeCompare(b.name)
          );
        if (sort.value === 'name') return a.name.localeCompare(b.name);
        if (a.hasData !== b.hasData) return a.hasData ? -1 : 1;
        if (metricView.value)
          return b.metricValue - a.metricValue || a.name.localeCompare(b.name);
        if (sort.value === 'progress' && a.complete !== b.complete)
          return a.complete ? 1 : -1;
        return (
          b.fraction - a.fraction ||
          b.gildings - a.gildings ||
          (b.badge?.completeClasses.length ?? 0) -
            (a.badge?.completeClasses.length ?? 0) ||
          a.name.localeCompare(b.name)
        );
      })
      .map((row) => ({
        ...row,
        platform: clanMembershipPlatform(
          row.member,
          linkedPlatforms.value[memberKey(row.member)],
        ),
      })),
  );
  return rows;
}
