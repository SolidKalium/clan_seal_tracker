<script setup lang="ts">
import { computed } from 'vue';
import { badgeOwnership } from './domain';
import { useTracker } from './useTracker';
import ViewTabs from './ViewTabs.vue';

const {
  breadcrumb,
  headingTitle,
  headingKind,
  selected,
  displayedPlayers,
  titleCount,
  viewLabel,
  viewTabs,
} = useTracker();
const badgeOwnerCount = computed(() =>
  selected.value
    ? displayedPlayers.value.filter(
        (p) =>
          badgeOwnership(p.profile, selected.value!.headings).completeClasses
            .length > 0,
      ).length
    : 0,
);
</script>

<template>
  <section class="page-heading seal-heading">
    <div>
      <p class="eyebrow">{{ breadcrumb }}</p>
      <h1>
        {{ headingTitle
        }}<span v-if="headingKind" class="heading-kind">{{
          ' ' + headingKind
        }}</span>
      </h1>
    </div>
    <div
      v-if="headingKind === 'seal' || headingKind === 'badge'"
      class="heading-tally"
    >
      <img
        v-if="selected?.icon"
        class="heading-owner-icon"
        :class="`heading-${headingKind}-icon`"
        :src="`https://www.bungie.net${selected.icon}`"
        alt=""
      />
      <div class="title-tally">
        <strong>{{
          headingKind === 'badge'
            ? badgeOwnerCount
            : selected
              ? titleCount(selected)
              : '—'
        }}</strong
        ><span>{{
          headingKind === 'badge' ? 'badge owners' : 'title holders'
        }}</span>
      </div>
    </div>
  </section>
  <ViewTabs :label="viewLabel" :tabs="viewTabs" />
</template>
