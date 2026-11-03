<script setup lang="ts">
import FriendIcon from './FriendIcon.vue';
import ClanEmblem from './ClanEmblem.vue';
import type { ClanEmblemData } from './clanBanner';
import type { Member } from './types';
defineProps<{ member: Member; emblem?: ClanEmblemData; clanName?: string }>();
</script>
<template>
  <span class="player-affiliations">
    <span v-if="member.listSource !== 'friend'" class="affiliation-clan" role="img" aria-label="Clan member"><span aria-hidden="true"><ClanEmblem :emblem="emblem" :name="clanName ?? 'Clan'" /></span></span>
    <FriendIcon v-if="member.isFriend" class="affiliation-friend" />
  </span>
</template>
<style scoped>
.player-affiliations{display:inline-grid;grid-template-columns:18px 18px;gap:4px;width:40px;flex-shrink:0;vertical-align:middle;align-items:center;color:#718574;line-height:0}.affiliation-clan{grid-column:1;width:18px;height:18px}.affiliation-friend{grid-column:2;width:18px;height:18px}.affiliation-clan :deep(.clan-emblem){display:block;width:18px;height:18px;margin:0;font-size:22px;line-height:.8}.affiliation-clan :deep(.clan-emblem>span){font-size:6px;left:6px;top:7px}.affiliation-clan :deep(.clan-banner){border-radius:2px}
</style>
