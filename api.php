<?php

$ch = null;
function api($path, $post = false) {
  global $ch;

  $base = 'https://www.bungie.net/Platform';

  if (!$ch) {
    $ch = curl_init();
  }
  $curl_opts = array(
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_USERAGENT => 'kalium/clan_seal_tracker/v0',
    CURLOPT_HTTPHEADER => array(
      'X-API-Key: ' . file_get_contents("apikey.txt"),
    ),
    CURLOPT_POST => false,
    CURLOPT_URL => $base . $path,
  );
  if ($post) {
    $curl_opts[CURLOPT_POST] = true;
    $curl_opts[CURLOPT_POSTFIELDS] = $post;
  }
  curl_setopt_array($ch, $curl_opts);

  $result_text = curl_exec($ch);
  if ($result_text === false) {
    throw new Exception("curl_exec error " . curl_errno($ch) . ": " . curl_error($ch));
  }
  $result = json_decode($result_text, true);
  if ($result === null) {
    // NOTE: if the server isn't working, the response will be html
    echo $result_text;
    throw new Exception("json_decode error " . json_last_error() . ": " . json_last_error_msg());
  }
  // TODO check that we're not going too fast?

  return $result;
}

// TODO function to grab and cache a manifest, should remove old manifests on update

/** TODO function for each api call?
  // App
  //   GET: App.GetApplicationApiUsage
  //   GET: App.GetBungieApplications
  // User
  //   GET: User.GetBungieNetUserById
  //   GET: User.SearchUsers
  //   GET: User.GetCredentialTypesForTargetAccount
  //   GET: User.GetAvailableThemes
  //   GET: User.GetMembershipDataById
  //   GET: User.GetMembershipDataForCurrentUser
  //   GET: User.GetMembershipFromHardLinkedCredential
  // Content
  //   GET: Content.GetContentType
  //   GET: Content.GetContentById
  //   GET: Content.GetContentByTagAndType
  //   GET: Content.SearchContentWithText
  //   GET: Content.SearchContentByTagAndType
  //   GET: Content.SearchHelpArticles
  // Forum
  //   GET: Forum.GetTopicsPaged
  //   GET: Forum.GetCoreTopicsPaged
  //   GET: Forum.GetPostsThreadedPaged
  //   GET: Forum.GetPostsThreadedPagedFromChild
  //   GET: Forum.GetPostAndParent
  //   GET: Forum.GetPostAndParentAwaitingApproval
  //   GET: Forum.GetTopicForContent
  //   GET: Forum.GetForumTagSuggestions
  //   GET: Forum.GetPoll
  //   POST: Forum.GetRecruitmentThreadSummaries
  // GroupV2
  //   GET: GroupV2.GetAvailableAvatars
  //   GET: GroupV2.GetAvailableThemes
  //   GET: GroupV2.GetUserClanInviteSetting
  //   POST: GroupV2.GetRecommendedGroups
  //   POST: GroupV2.GroupSearch
  //   GET: GroupV2.GetGroup
  //   GET: GroupV2.GetGroupByName
  //   POST: GroupV2.GetGroupByNameV2
  //   GET: GroupV2.GetGroupOptionalConversations
  //   POST: GroupV2.EditGroup
  //   POST: GroupV2.EditClanBanner
  //   POST: GroupV2.EditFounderOptions
  //   POST: GroupV2.AddOptionalConversation
  //   POST: GroupV2.EditOptionalConversation
  //   GET: GroupV2.GetMembersOfGroup
  //   GET: GroupV2.GetAdminsAndFounderOfGroup
  //   POST: GroupV2.EditGroupMembership
  //   POST: GroupV2.KickMember
  //   POST: GroupV2.BanMember
  //   POST: GroupV2.UnbanMember
  //   GET: GroupV2.GetBannedMembersOfGroup
  //   POST: GroupV2.AbdicateFoundership
  //   GET: GroupV2.GetPendingMemberships
  //   GET: GroupV2.GetInvitedIndividuals
  //   POST: GroupV2.ApproveAllPending
  //   POST: GroupV2.DenyAllPending
  //   POST: GroupV2.ApprovePendingForList
  //   POST: GroupV2.ApprovePending
  //   POST: GroupV2.DenyPendingForList
  //   GET: GroupV2.GetGroupsForMember
  //   GET: GroupV2.RecoverGroupForFounder
  //   GET: GroupV2.GetPotentialGroupsForMember
  //   POST: GroupV2.IndividualGroupInvite
  //   POST: GroupV2.IndividualGroupInviteCancel
  // Tokens
  //   POST: Tokens.ClaimPartnerOffer
  //   POST: Tokens.ApplyMissingPartnerOffersWithoutClaim
  //   GET: Tokens.GetPartnerOfferSkuHistory
  // Destiny2
  //   GET: Destiny2.GetDestinyManifest
  //   GET: Destiny2.GetDestinyEntityDefinition
  //   GET: Destiny2.SearchDestinyPlayer
  //   GET: Destiny2.GetLinkedProfiles
  //   GET: Destiny2.GetProfile
  //   GET: Destiny2.GetCharacter
  //   GET: Destiny2.GetClanWeeklyRewardState
  //   GET: Destiny2.GetItem
  //   GET: Destiny2.GetVendors
  //   GET: Destiny2.GetVendor
  //   GET: Destiny2.GetPublicVendors Preview
  //   GET: Destiny2.GetCollectibleNodeDetails
  //   POST: Destiny2.TransferItem
  //   POST: Destiny2.PullFromPostmaster
  //   POST: Destiny2.EquipItem
  //   POST: Destiny2.EquipItems
  //   POST: Destiny2.SetItemLockState
  //   POST: Destiny2.SetQuestTrackedState
  //   POST: Destiny2.InsertSocketPlug Preview
  //   GET: Destiny2.GetPostGameCarnageReport
  //   POST: Destiny2.ReportOffensivePostGameCarnageReportPlayer
  //   GET: Destiny2.GetHistoricalStatsDefinition
  //   GET: Destiny2.GetClanLeaderboards Preview
  //   GET: Destiny2.GetClanAggregateStats Preview
  //   GET: Destiny2.GetLeaderboards Preview
  //   GET: Destiny2.GetLeaderboardsForCharacter Preview
  //   GET: Destiny2.SearchDestinyEntities
  //   GET: Destiny2.GetHistoricalStats
  //   GET: Destiny2.GetHistoricalStatsForAccount
  //   GET: Destiny2.GetActivityHistory
  //   GET: Destiny2.GetUniqueWeaponHistory
  //   GET: Destiny2.GetDestinyAggregateActivityStats
  //   GET: Destiny2.GetPublicMilestoneContent
  //   GET: Destiny2.GetPublicMilestones
  //   POST: Destiny2.AwaInitializeRequest
  //   POST: Destiny2.AwaProvideAuthorizationResult
  //   GET: Destiny2.AwaGetActionToken
  // CommunityContent
  //   GET: CommunityContent.GetCommunityContent
  // Trending
  //   GET: Trending.GetTrendingCategories
  //   GET: Trending.GetTrendingCategory
  //   GET: Trending.GetTrendingEntryDetail
  // Fireteam
  //   GET: Fireteam.GetActivePrivateClanFireteamCount
  //   GET: Fireteam.GetAvailableClanFireteams
  //   GET: Fireteam.SearchPublicAvailableClanFireteams
  //   GET: Fireteam.GetMyClanFireteams
  //   GET: Fireteam.GetClanFireteam

  //   GET: .GetAvailableLocales
  //   GET: .GetCommonSettings
  //   GET: .GetUserSystemOverrides
  //   GET: .GetGlobalAlerts **/

function echo_pretty_json($json) {
  echo htmlspecialchars(json_encode($json, JSON_PRETTY_PRINT)) . PHP_EOL . PHP_EOL;
}