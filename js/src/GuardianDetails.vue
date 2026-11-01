<script setup lang="ts">
import { computed } from 'vue';
import { formatClasses, type BadgeOwnership } from './domain';
import { clanJoinedAt, clanRankLabel } from './clan';
import type { PlayerData, UserInfo } from './types';
const props = defineProps<{ guardian: PlayerData; earnedTitle?: string; earnedBadge?: BadgeOwnership & { name: string }; name: string; memberships?: UserInfo[]; loading: boolean; error?: string; freshness: string }>();
const joined = computed(() => {
  const time = clanJoinedAt(props.guardian.member);
  return time === undefined ? undefined : new Date(time).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
});
const platformNames: Record<number, string> = { 1: 'Xbox', 2: 'PlayStation', 3: 'Steam', 4: 'Battle.net', 5: 'Stadia', 6: 'Epic Games', 254: 'Bungie' };
const primaryPlatform = computed(() => {
  const profile = props.guardian.profile?.profile?.data?.userInfo;
  const roster = props.guardian.member.destinyUserInfo;
  return profile?.crossSaveOverride || profile?.membershipType || roster.crossSaveOverride || roster.membershipType;
});
const platforms = computed(() => [...(props.memberships?.length ? props.memberships : [props.guardian.member.destinyUserInfo])]
  .sort((a, b) => Number(b.membershipType === primaryPlatform.value) - Number(a.membershipType === primaryPlatform.value)));
const bungieName = computed(() => props.guardian.profile?.profile?.data?.userInfo ?? props.guardian.member.destinyUserInfo);
</script>
<template>
  <div class="record-details guardian-details">
    <p class="eyebrow">GUARDIAN</p><h3>{{ name }}<span v-if="bungieName.bungieGlobalDisplayNameCode !== undefined" class="bungie-code">#{{ String(bungieName.bungieGlobalDisplayNameCode).padStart(4, '0') }}</span></h3>
    <p v-if="earnedTitle" class="guardian-title"><span aria-hidden="true">✦</span> {{ earnedTitle }} title earned</p>
    <p v-if="earnedBadge" class="guardian-badge" :class="{ 'earned-gold': earnedBadge.allClasses }"><span aria-hidden="true">✦</span> {{ earnedBadge.name }} badge collected<br><span class="badge-earned-classes">Collected on {{ earnedBadge.allClasses ? 'all 3 classes' : formatClasses(earnedBadge.completeClasses) }}.</span></p>
    <p class="clan-member-info"><strong class="clan-rank">{{ clanRankLabel(guardian.member.memberType) }}</strong><span class="clan-joined">{{ joined ? `Joined ${joined}` : 'Join date unavailable' }}</span></p>
    <ul class="objective-details"><li v-for="platform in platforms" :key="`${platform.membershipType}_${platform.membershipId}`" :class="{ 'primary-platform': platform.membershipType === primaryPlatform }"><span class="objective-name">{{ platformNames[platform.membershipType] ?? `Platform ${platform.membershipType}` }}<small v-if="platform.membershipType === primaryPlatform" class="primary-platform-label">Primary save</small></span><span class="platform-name">{{ platform.displayName }}</span></li></ul>
    <p class="guardian-freshness">{{ freshness }}</p><p v-if="guardian.fetchedAt" class="objective-state">Fetched {{ new Date(guardian.fetchedAt).toLocaleString() }}</p>
    <p v-if="guardian.error" class="guardian-error">{{ guardian.error }}</p>
    <p v-if="loading" class="objective-state">Loading linked platform names…</p><p v-if="error" class="objective-state">{{ error }}</p>
  </div>
</template>
