<script setup lang="ts">
import { catalog, catalogGroups } from './catalog';
import { badgeOwnership } from './domain';
import SealWatermark from './SealWatermark.vue';
import type { PageConfig } from './types';
import { useTracker } from './useTracker';

const {
  definitions,
  playerList,
  roster,
  displayedPlayers,
  known,
  seals,
  sealsById,
  titleCount,
} = useTracker();
function otherPageSummary(page: PageConfig): string {
  if (page.id === 'checklists')
    return `${1 + catalog.filter((p) => p.parentPageId === page.id).length} checklists`;
  if (page.id === 'guardian_ranks') return 'Ranks and commendations';
  const seal = sealsById.value[page.id];
  if (!seal) return 'Loading definitions…';
  const unit = seal.headings.some((h) => h.collectibleHashes)
    ? 'items'
    : page.kind === 'seals'
      ? 'seals'
      : page.id === 'patterns'
        ? 'patterns'
        : page.id === 'catalysts'
          ? 'catalysts'
          : 'triumphs';
  return `${seal.headings.length} ${unit}`;
}
</script>

<template>
  <section class="page-heading">
    <p class="eyebrow">THE NEXT TITLE IS A TEAM EFFORT</p>
    <h1>Your clan. Every triumph.</h1>
    <p class="lede">
      See who’s close, plan your fireteam, and make the next run count.
    </p>
  </section>
  <div class="overview-stats">
    <div>
      <strong>{{ roster?.members.length ?? '—' }}</strong
      ><span>{{ playerList === 'clan' ? 'Clan guardians' : 'Guardians' }}</span>
    </div>
    <div>
      <strong>{{ known.length }}</strong
      ><span>Profiles with public data</span>
    </div>
    <div>
      <strong>{{
        seals.filter((s) => s.page.sealNodeHash && !s.unavailable).length || '—'
      }}</strong
      ><span>Seals to explore</span>
    </div>
  </div>
  <section
    v-for="group in catalogGroups"
    :key="group.name"
    class="catalog-section"
    :aria-label="group.title"
  >
    <div class="section-title">
      <h2>{{ group.title }}</h2>
    </div>
    <div class="seal-grid">
      <a
        v-for="(page, i) in group.pages"
        :key="page.id"
        :href="`#/${page.category === 'Other badges' ? 'badge' : page.sealNodeHash ? 'seal' : 'triumphs'}/${page.id}`"
        class="seal-card"
        :style="{ '--card-hue': `${135 + i * 22}` }"
      >
        <SealWatermark :icon="sealsById[page.id]?.icon" />
        <span class="card-top"
          ><span class="card-icon" aria-hidden="true">◇</span
          ><span class="eyebrow"
            >{{
              page.seasonNumber
                ? `SEASON ${page.seasonNumber}`
                : group.kind.toUpperCase() +
                  (group.category === 'Raid seals'
                    ? ` ${String(i + 1).padStart(2, '0')}`
                    : '')
            }}<span v-if="sealsById[page.id]?.legacy"> · LEGACY</span></span
          ></span
        >
        <h3>{{ sealsById[page.id]?.title ?? page.name }}</h3>
        <p>{{ page.name }}</p>
        <div class="card-bottom">
          <span v-if="sealsById[page.id]?.unavailable"
            >Unavailable in current manifest</span
          ><span v-else-if="definitions && page.sealNodeHash"
            >{{ titleCount(sealsById[page.id]!) }} title holders</span
          ><span v-else-if="definitions && page.category === 'Other badges'"
            >{{
              displayedPlayers.filter(
                (p) =>
                  badgeOwnership(p.profile, sealsById[page.id]?.headings ?? [])
                    .completeClasses.length > 0,
              ).length
            }}
            badge owners</span
          ><span v-else-if="page.category === 'Other'">{{
            otherPageSummary(page)
          }}</span
          ><span v-else-if="definitions"
            >{{ sealsById[page.id]?.headings.length ?? 0 }} triumphs</span
          ><span v-else>Loading definitions…</span
          ><span aria-hidden="true">↗</span>
        </div>
      </a>
    </div>
  </section>
  <p class="footnote">
    Counts cover loaded profiles, including any retained stale data. Choose a
    raid, dungeon, exotic mission, activity, expansion, season, or episode to
    explore its seal and triumphs, with collection badges where available.
  </p>
</template>
