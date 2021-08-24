<?php


class bungie_api {

  ///// PUBLIC API FUNCTIONS

  public static function get_manifest() { // Destiny2.GetDestinyManifest
    return self::api('/Destiny2/Manifest/');
  }

  public static function get_memberships($membership_id, $membership_type = '-1') {
    // This works with any kind of membership id.
    // Type -1 means the type doesn't need to be specified

    $membership_id = (int) $membership_id;
    $membership_type = (int) $membership_type;

    return bungie_api::api('/User/GetMembershipsById/' . $membership_id . '/' . $membership_type . '/');
  }

  public static function get_group_members($group_id) {
    // takes about 0.7 seconds
    $group_id = (int) $group_id;

    $response = self::api('/GroupV2/' . $group_id . '/Members/');
    return $response['results'];
    // ignoring totalResults, hasMore, query.itemsPerPage, query.currentPage, and useTotalResults because query will automatically include all clan members
    // non-clan groups might have more than 100 members
  }

  public static function get_profile($membership_type, $membership_id, $components = array(100)) {
    // Needs to be called with the primary destiny membership details

    $membership_type = (int) $membership_type;
    $membership_id = (int) $membership_id;
    $components = profiles::normalize_component_codes($components);

    return self::api('/Destiny2/' . $membership_type . '/Profile/' . $membership_id. '/?components=' . implode(',', $components));
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


  ///// HELPERS

  public static function api($path, $post = false) {
    // PCGR must go through stats.bungie.net. This does not provide affinitization to a bungie server.
    // Other requests can go through www.bungie.net. This does provide affinitizaation.
    $base = 'https://www.bungie.net/Platform';

    $curl_opts = array(
      CURLOPT_HTTPHEADER => array(
        // 'Authorization: Bearer ' . '', // TODO store/automate. json_decode if copied
        'X-API-Key: ' . get_setting("secret_key"),
      ),
      CURLOPT_URL => $base . $path,
    );
    if ($post) {
      $curl_opts[CURLOPT_POST] = true;
      $curl_opts[CURLOPT_POSTFIELDS] = $post;
    }
    $result_text = self::_fetch($curl_opts);

    $result = json_decode($result_text, true);
    if ($result === null) {
      // NOTE: if the server isn't working, the response will be html
      echo htmlspecialchars($result_text);
      throw new Exception("json_decode error " . json_last_error() . ": " . json_last_error_msg());
    }

    $excluded_paths = array(
      '/App/OAuth/token/',
    );
    $expected = array( // First draft. If this error checking causes issues, improve it.
      "ErrorCode" => 1,
      "ThrottleSeconds" => 0,
      "ErrorStatus" => "Success",
      "Message" => "Ok",
      "MessageData" => array(),
    );
    if (!in_array($path, $excluded_paths)) {
      foreach ($expected as $key => $value) {
        if ($result[$key] !== $value) {
          echo_pretty_json($result);
          throw new Exception("Expected " . $key . " => " . json_encode($value) . ", but received " . json_encode($result[$key]));
        }
      }
    }

    return $result['Response'];
  }

  public static function fetch_resource($path) {
    $base = 'https://www.bungie.net';
    $curl_opts = array(
      CURLOPT_URL => $base . $path,
    );

    return self::_fetch($curl_opts);
  }

  public static function get_auth_endpoint() {
    // gets url to give to user
    // when the user clicks the button to authorize, they will be returned to the configured page with ?code=<hexcode>&state=testing
    $url = 'https://www.bungie.net/en/oauth/authorize';
    $query = array(
      'response_type' => 'code',
      'client_id' => '', // TODO from config
      'state' => 'testing', // TODO
    );

    return $url . '?' . http_build_query($query);
  }

  public static function get_token($code) { // TODO just use bungie_api::api
    // Tokens expire in one hour
    // does not return the bonus fields typical of other api call
    $url = 'https://www.bungie.net/Platform/App/OAuth/token/';
    $query = array(
      'grant_type' => 'authorization_code',
      'code' => $code,
      'client_id' => '', // TODO config
    );

    $curl_opts = array(
      CURLOPT_HTTPHEADER => array(
        'X-API-Key: ' . get_setting("secret_key"),
      ),
      CURLOPT_URL => $url,
      CURLOPT_POST => true,
      CURLOPT_POSTFIELDS => http_build_query($query),
    );

    $result_text = self::_fetch($curl_opts);

    $result = json_decode($result_text, true);
    if ($result === null) {
      // NOTE: if the server isn't working, the response will be html
      echo htmlspecialchars($result_text);
      throw new Exception("json_decode error " . json_last_error() . ": " . json_last_error_msg());
    }

    return $result;
  }


  ///// INTERNAL

  private static $ch = null;
  private static function _fetch($curl_opts) {
    if (!self::$ch) {
      self::$ch = curl_init();
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
    curl_setopt_array(self::$ch, $constant_curl_opts + $curl_opts + $default_curl_opts);

    $result_text = curl_exec(self::$ch);
    if ($result_text === false) {
      throw new Exception("curl_exec error " . curl_errno(self::$ch) . ": " . curl_error(self::$ch));
    }

    return $result_text;
  }

}
