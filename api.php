<?php

// TODO wrap in a class


///// PUBLIC API FUNCTIONS

function get_manifest() {
  return api('/Destiny2/Manifest/');
}

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


///// PRIVATE HELPERS

function api($path, $post = false) {
  $base = 'https://www.bungie.net/Platform';

  $curl_opts = array(
    CURLOPT_HTTPHEADER => array(
      'X-API-Key: ' . file_get_contents("apikey.txt"),
    ),
    CURLOPT_URL => $base . $path,
  );
  if ($post) {
    $curl_opts[CURLOPT_POST] = true;
    $curl_opts[CURLOPT_POSTFIELDS] = $post;
  }
  $result_text = _fetch($curl_opts);

  $result = json_decode($result_text, true);
  if ($result === null) {
    // NOTE: if the server isn't working, the response will be html
    echo $result_text;
    throw new Exception("json_decode error " . json_last_error() . ": " . json_last_error_msg());
  }

  $expected = array( // First draft. If this error checking causes issues, improve it.
    "ErrorCode" => 1,
    "ThrottleSeconds" => 0,
    "ErrorStatus" => "Success",
    "Message" => "Ok",
    "MessageData" => array(),
  );
  foreach ($expected as $key => $value) {
    if ($result[$key] !== $value) {
      throw new Exception("Expected " . $key . " => " . json_encode($value) . ", but received " . json_encode($result[$key]));
    }
  }

  return $result['Response'];
}

function fetch_resource($path) {
  $base = 'https://www.bungie.net';
  $curl_opts = array(
    CURLOPT_URL => $base . $path,
  );

  return _fetch($curl_opts);
}

$ch = null;
function _fetch($curl_opts) { // private
  if (!$ch) {
    $ch = curl_init();
  }

  $constant_curl_opts = array(
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_USERAGENT => 'kalium/clan_seal_tracker/v0',
  );
  $default_curl_opts = array(
    CURLOPT_HTTPHEADER => array(),
    CURLOPT_POSTFIELDS => null,
    CURLOPT_POST => false,
  );
  curl_setopt_array($ch, $constant_curl_opts + $curl_opts + $default_curl_opts);

  $result_text = curl_exec($ch);
  if ($result_text === false) {
    throw new Exception("curl_exec error " . curl_errno($ch) . ": " . curl_error($ch));
  }

  return $result_text;
}

function get_current_definition_filenames() { // TODO memoize?
  global $def_dir;

  $current_filenames = array();

  if (!is_dir($def_dir)) {
    mkdir($def_dir); // side-effect ok
  }

  $dh = opendir($def_dir); // assuming dh is not null
  while (($filename = readdir($dh)) !== false) {
    if (!in_array($filename, array('.', '..'))) {
      $parts = explode('-', $filename, 2);
      $current_filenames[$parts[0]] = $filename;
    }
  }
  closedir($dh);

  return $current_filenames;
}


///// PUBLIC HELPERS

function echo_pretty_json($json) {
  echo htmlspecialchars(json_encode($json, JSON_PRETTY_PRINT)) . PHP_EOL . PHP_EOL;
}

$definitions_updated = false;
$def_dir = 'definitions';
function update_definitions() {
  global $definitions_updated, $def_dir;

  if ($definitions_updated) {
    return;
  }

  $definitions_to_update = array(
    'DestinyObjectiveDefinition',
    'DestinyRecordDefinition',
    'DestinyPresentationNodeDefinition',
    // 'DestinyMilestoneDefinition',
  );

  $current_filenames = get_current_definition_filenames();

  $manifest = get_manifest();
  $definitions = $manifest['jsonWorldComponentContentPaths']['en']; // NOTE: using individual files may not be supported long term

  foreach ($definitions_to_update as $key) {
    $path = $definitions[$key];
    $new_filename = end(explode('/', $path));
    if (isset($current_filenames[$key])) {
      if ($current_filenames[$key] !== $new_filename) {
        // echo $key . ' file changed: ' . $new_filename . ' ' . $current_filenames[$key] . PHP_EOL;
        file_put_contents($def_dir . '/' . $new_filename, fetch_resource($path));
        unlink($def_dir . '/' . $current_filenames[$key]);
      } else {
        // echo $key . ' is up to date' . PHP_EOL;
      }
    } else {
      // echo $key . ' doesn\'t exist yet' . PHP_EOL;
      file_put_contents($def_dir . '/' . $new_filename, fetch_resource($path));
    }
  }

  
  $definitions_updated = true;
}

function get_definitions($type) { // TODO memoize?
  global $def_dir;

  $full_type = 'Destiny' . $type . 'Definition';

  $current_filenames = get_current_definition_filenames();

  if (!$current_filenames[$full_type]) {
    throw new Exception('No definitions downloaded for ' . $type);
  }

  $contents = file_get_contents($def_dir . '/' . $current_filenames[$full_type]);
  $data = json_decode($contents, true);

  if ($data === null) {
    throw new Exception("json_decode error " . json_last_error() . ": " . json_last_error_msg());
  }

  return $data;
}


