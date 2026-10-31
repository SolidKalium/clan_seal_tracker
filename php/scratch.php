<?php

// testing and development page
include __DIR__ . '/include.php';

enable_implicit_flush();
echo '<pre>';



$start_time = microtime(true);
echo "SCRIPT START" . PHP_EOL . PHP_EOL;

// ini_set('display_errors', 1); // uncomment these while debugging on a production server
// error_reporting(~0);

// definitions::update();
// list_all_seals($active = false);
// list_all_checklists($verbose = true);
// echo_pretty_json(bungie_api::api('/Settings/')); // destiny2CoreSettings has useful top-level hashes

// "collectionRootNode": 3790247699, emblems: 2381001021, mods: 3509235358, exotic armor: 1789205056
// "badgesRootNode": 498211331,
// "metricsRootNode": 1074663644,
// "activeTriumphsRootNodeHash": 1866538467,
// "activeSealsRootNodeHash": 616318467,
// "legacyTriumphsRootNodeHash": 3215903653,
// "legacySealsRootNodeHash": 1881970629,
// "exoticCatalystsRootNodeHash": 2642502414, // also includes patterns
// "exoticCatalystsRootNodeHash": 511607103, // just catalysts (old view)
// "medalsRootNodeHash": 3901403713,
// "loreRootNodeHash": 1993337477,
// "craftingRootNodeHash": 3937826784, // does not have unlock progress
// "seasonalChallengesPresentationNodeHash": 3443694067,
// "guardianRanksRootNodeHash": 3741753466
display_node_hierarchy(1866538467, 2);

// display_node_hierarchy_reverse(199171388);
// display_node_hierarchy(3509235358);
// display_hash_info(3241617029);
// display_hash_info(1875194813);

// display_hash_info(3093771363);
// display_hash_info(2282824303);
// display_hash_info(29206418);


// investigating focusing lens mod
// display_hash_info(792292104); // item
// //  buckets, tier, perk
// display_hash_info(1586531648); // collectible
// display_hash_info(1402439016); // source
// display_hash_info(59); // item category
// display_hash_info(4104513227); // item category
// display_hash_info(3196106184); // item category
// display_hash_info(2906646562); // item category
// display_node_hierarchy_reverse(1586531648); // collectible


// investigating damage in a raid. It is not available.
$membershipType = 5; $destinyMembershipId = 4611686018495237916; $characterId = 2305843009538476316; // yoshi H 2305843009538476316 T 2305843009622114122 W 2305843009622114123
$activityId = 7023983145;
$activityId = 8376275544;
$activityHash = 548750096;
// $result = bungie_api::api('/Destiny2/Stats/Definition/');
// $result = profiles::get(5, 4611686018495237916); // echo_pretty_json(profiles::get_display_names($result));
// $result = bungie_api::api("/Destiny2/{$membershipType}/Profile/{$destinyMembershipId}/?components=100,200");
// $result = bungie_api::api("/Destiny2/{$membershipType}/Account/{$destinyMembershipId}/Character/{$characterId}/Stats/AggregateActivityStats/"); // generic aggregate stats
// $result = bungie_api::api("/Destiny2/Stats/PostGameCarnageReport/{$activityId}/"); // damage isn't in here
// $result = bungie_api::api("/Destiny2/{$membershipType}/Account/{$destinyMembershipId}/Stats/"); // all characters + merged. pve and pvp
// $result = bungie_api::api("/Destiny2/{$membershipType}/Account/{$destinyMembershipId}/Character/{$characterId}/Stats/"); // pvp is one group. pve split into patrol, raid, story, strikes, all pve, all gambit
// $result = bungie_api::api("/Destiny2/{$membershipType}/Account/{$destinyMembershipId}/Character/{$characterId}/Stats/Activities/"); // list of activities and single number stats
// $result = bungie_api::api("/Destiny2/{$membershipType}/Account/{$destinyMembershipId}/Character/{$characterId}/Stats/UniqueWeapons/"); // lists weapons with 5 stats each
// display_hash_info(548750096); // activity hash
// display_hash_info(707184738); // activity graph's nodeActivityId. Unknown type
// display_hash_info(1540899845); // activity graph's parent nodeActivityID. unknown type TODO?
// could look at character/account historical stats


// $result = bungie_api::get_manifest();
// $result = bungie_api::get_group_members(4331943); // Anomaly

// $result = bungie_api::api('/App/FirstParty/');
// $result = bungie_api::api('/User/SearchUsers/?q=solid+kalium');
// $result = bungie_api::api('/User/GetBungieNetUserById/31110/');
// $result = bungie_api::api('/User/GetMembershipsById/4611686018433304729/-1/'); // 31110 kalium
// $result = bungie_api::api('/GroupV2/Search/', json_encode(array('name' => "\u{03bb}nomaly", 'groupType' => 1))); // this only returns one result?
// $result = bungie_api::api("/GroupV2/Name/\u{03bb}nomaly/1/"); // 0 general, 1 clan // also just one result
// $result = bungie_api::api('/GroupV2/4331943/');
// $result = bungie_api::api('/GroupV2/4331943/Members/');
// $result = bungie_api::api('/Settings/'); // destiny2CoreSettings has useful top-level hashes
// $result = bungie_api::api('/UserSystemOverrides/');
// $result = bungie_api::api('/GlobalAlerts/');
// $result = bungie_api::api('/Trending/Categories/'); // news
// $result = bungie_api::api('/Content/Rss/NewsArticles/');
// $result = bungie_api::api('/Destiny2/Milestones/'); // general milestone list
// $result = bungie_api::api('/Destiny2/Milestones/{milestoneHash}/Content/'); // TODO
// $result = bungie_api::api('/Destiny2/SearchDestinyPlayer/-1/SolidKalium/');
// $result = bungie_api::api('/Destiny2/5/Profile/4611686018500895898/Character/2305843009610364882/Vendors/?components=400,401,402'); // kalium titan


// getting vendor info. sale status is a vendor item status. failure reasons are on the vendor.
// echo bungie_api::get_auth_endpoint() . PHP_EOL . PHP_EOL;
// $result = bungie_api::get_token(''); // TODO
// display_hash_info(1303706313);

// improve loading
$membershipType = 5; $destinyMembershipId = 4611686018500895898;
// $profile = profiles::get($membershipType, $destinyMembershipId);
// $profile = bungie_api::get_profile($membershipType, $destinyMembershipId, array('Profiles'));
// echo "get_profile took " . number_format(microtime(true) - $start_time, 3) . " seconds" . PHP_EOL;
// $profile = bungie_api::get_profile($membershipType, $destinyMembershipId, array('Profiles', 'ProfileProgression', 'CharacterProgressions', 'PresentationNodes', 'Collectibles', 'Records'));
// $profile += bungie_api::get_memberships($destinyMembershipId, $membershipType); // only takes about 0.1 seconds


// milestones
// display_hash_info(432848324); // inventoryitem for weekly clan engrams
// display_hash_info(2540008660); // item for personal contribution
// display_hash_info(344489854); // item for daily focus
// display_hash_info(3500096607); // objective for strike daily focus
// display_hash_info(3373751971); // item for medal case
// display_hash_info(534869653); // xur, no real details
// display_hash_info(3181387331); // last wish raid
// display_hash_info(2122313384); // activity for last wish
// display_hash_info(1126840038); // last wish first activity phase. not available
// display_hash_info(1661734046); // last wish activity, but old version
// display_hash_info(3789021730); // group clan rewards milestone. two different lists? not found

// display_hash_info(); //
// display_profile_milestones(5, 4611686018500895898);


$components = array(
  'None' => 0,
  'Profiles' => 100,
  // 'VendorReceipts' => 101,
	// "ProfileInventories" => 102,
	// "ProfileCurrencies" => 103,
	// "ProfileProgression" => 104, // checklists and artifact, does not work with privacy on
	// "PlatformSilver" => 105, // logged in user only
	// "Characters" => 200, // minutes played, light level, selected title, emblem, etc.
	// "CharacterInventories" => 201,
	// "CharacterProgressions" => 202, // might include season pass info. progression, faction, quest, milestone, quests, non-instanced item objectives, checklists (lost sectors and jade rabbits), artifact
	// "CharacterRenderData" => 203,
	// "CharacterActivities" => 204,
	// "CharacterEquipment" => 205,
	// "ItemInstances" => 300,
	// "ItemObjectives" => 301,
	// "ItemPerks" => 302,
	// "ItemRenderData" => 303,
	// "ItemStats" => 304,
	// "ItemSockets" => 305, // slow
	// "ItemTalentGrids" => 306, // labelled as itemComponents
	// "ItemCommonData" => 307,
	// "ItemPlugStates" => 308,
	// "ItemPlugObjectives" => 309, // big, only get if needed
	// "ItemReusablePlugs" => 310,
	// "Vendors" => 400, // none
	// "VendorCategories" => 401, // none
	// "VendorSales" => 402, // none
	// "Kiosks" => 500,
	// "CurrencyLookups" => 600,
	// "PresentationNodes" => 700,
	// "Collectibles" => 800,
	// "Records" => 900,
	// "Transitory" => 1000, // currently empty
	// "Metrics" => 1100,
  // "StringVariables" => 1200,
  // "Craftables" => 1300,
  // "SocialCommendations" => 1400,
);
// $result = bungie_api::api('/Destiny2/5/Profile/4611686018500895898/?components=' . implode(',', array_values($components))); // kalium
// $result = bungie_api::api('/Destiny2/3/Profile/4611686018490731084/?components=' . implode(',', array_values($components))); // scorpin

// Patterns
// display_hash_info(611448447); // Example presentation node (auto rifles). I no longer remember when this came from
// display_hash_info(2855733397); // Example craftable item (come to pass)
// // // display_hash_info(766235248); // bucketTypeHash
// // // display_hash_info(3157915980); // progressionLevelRequirementHash
// // // display_hash_info(2759499571); // powerCapHash
// // // display_hash_info(521135891); // talentGridHash
// // display_hash_info(3435464613); // perkHash
// // display_hash_info(3520001075); // summaryItemHash
// // profile has craftables listed. item (1) and socket.plug (0) failedRequirementIndexes
// display_hash_info(2466515452); // Presentation node for auto rifles
// display_hash_info(3863516258); // Example craftable item (come to pass) record
// display_hash_info(1615038969); // forensic nightmare smg record
// display_hash_info(850383679); // objective


if (!empty($result)) {
  echo_pretty_json($result);
}


/** Quick dictionary reference
 * presentationNodeType: 1 Category, 2 Collectibles, 3 Record. Note: The triumph for the GoS seal for completing the badge is of type record.
 * toastStyle: 1 Record, 3 Badge, 4 MetaRecord, 7 GildedTitleComplete
 * privacy: 0 none, 1 public, 2 private
 * recordState: 0 not yet redeemed, 1 redeemed, 2 rewardunavailable, 4 objective not complete, 8 obscured, 16 invisible, 32 entitlement not owned, 64 can equip title
 */

// objective hashes list the objectives per triumph. For solar/arc/etc, these indicate the different encounters+condition. The objectives have generic names describing the encounters. It will be better to just infer that the 4 parts are in order. completionValue is the number needed.
// featuredPriority tends to be min or max 32 bit signed int
// The record icons are mostly generic. All non-collection GoS triumphs have the same icon. iconSequences has larger icons and variants for completed and not completed.
// I haven't seen how to tell a triumph should be hidden or is earnable only during one season. (e.g. gilding or first 24 hours)
// destiny and bungie membershipIDs are not the same
// DestinyUnlockValueUIStyle controls how the unlock value "should" be displayed


// explore_character_collectible_differences(5, 4611686018500895898);
// display_hash_info(1683385696);

$runtime = microtime(true) - $start_time;
echo "SCRIPT END after " . number_format($runtime, 3) . " seconds";


function list_all_seals($active = true) {
  // PresentationNode is the display category.
  // PN.hash = 616318467 is the parent node for all earnable seals. It has no parent. It's presentationNode children are the seals.
  // PN.completionRecordHash = record.hash for a seal.
  // PN.hash = record.parentNodeHash for a triumph in a seal. The records are also listed as children of the PN.
  // Other top-level PNs include: seasonal challenges, various metrics, items, various seasonal collection sets, badges, etc.

  $nodes = definitions::get('PresentationNode');
  $records = definitions::get('Record');

  $root_hash = $active ? 616318467 : 1881970629;

  $root_seal_node = $nodes[$root_hash];
  foreach ($root_seal_node['children']['presentationNodes'] as $node) {
    $seal_node = $nodes[$node['presentationNodeHash']];
    $details = array(
      'node_id' => 'node ' . str_pad($seal_node['hash'], 10),
      'record_id' => '< no completion record id >',
      'seal_name' => $seal_node['displayProperties']['name'],
      'title' => '< no title >',
    );
    if (isset($seal_node['completionRecordHash'])) {
      $seal_record = $records[$seal_node['completionRecordHash']];
      $details['record_id'] = 'record ' . str_pad($seal_record['hash'], 10);
      $details['title'] = reset($seal_record['titleInfo']['titlesByGender']);
    }
    echo implode(' | ', $details) . PHP_EOL;
  }
  echo PHP_EOL;
}

function list_all_checklists($verbose = false) {
  $checklists = definitions::get('Checklist');

  $checklist_data = array();
  foreach ($checklists as $key => $checklist) {
    $checklist_data[] = array(
      'hash' => $key,
      'scope' => $checklist['scope'],
      'count' => count($checklist['entries']),
      'name' => $checklist['displayProperties']['name'],
      'description' => $checklist['displayProperties']['description'],
      'has_icon' => $checklist['displayProperties']['hasIcon'] ? 'yes' : 'no',
      'action_string' => $checklist['viewActionString'],
      'redacted' => $checklist['redacted'] ? 'yes' : 'no',
      'blacklisted' => $checklist['blacklisted'] ? 'yes' : 'no',
    );

    if ($verbose) {
      echo '<h3>' . $checklist['displayProperties']['name'] . '</h3>';
      display_table($checklist['entries']);
    }
  }

  echo '<h3>All Checklists</h3>';
  display_table($checklist_data);
  echo PHP_EOL;
}

function explore_character_collectible_differences($type, $id) {
  $profile = profiles::get($type, $id);

  // collectible state
    // 0 none
    // 1 not acquired
    // 2 obscured
    // 4 invisible
    // 8 cannot afford material requirements
    // 16 inventory space unavailable
    // 32 uniqueness violation
    // 64 purchase disabled

  $t = array();
  foreach ($profile['characterCollectibles']['data'] as $character_hash => $character_collectibles) {
    // The number of entries for all three characters is the same. Currently 1807.
    // But for some collectibles the states are different. Roughly 290 for kalium.
    // I have not yet seen states 8 or 16 in public data.
    // I have seen these flags: 1 2 4 32 and 64, as well as the absence of any flags.
    // Ignoring state 64 significantly reduces the number of differences. 7 to 11 for kalium.
    // Example: 1586531648 focusing lense in states 64/65/65
    // Example: 1159460176 class-specific emblem 0/1/1
    // Example: 1348250939 class-specific emote 0/1/1 (see also 1683385696 city dance and 1683385702 graceful dance which are unique to humans and awoken)
    // Example: 199479286 class-specific finisher 32/64/64
    // Example: 2202434429 drang 0/1/1 (probably matches availability from banshee)
    // Example: 2963869878 man o war linear fusion from io 0/1/1
    // Example: 74211518 mod from artifact 64/65/64
    $t[] = $character_collectibles;
  }
  $t0 = array_map('json_encode', array_map('hide_collectible_states', $t[0]['collectibles']));
  $t1 = array_map('json_encode', array_map('hide_collectible_states', $t[1]['collectibles']));
  $t2 = array_map('json_encode', array_map('hide_collectible_states', $t[2]['collectibles']));
  $u0 = array_diff_assoc($t0, $t1, $t2);
  $u1 = array_diff_assoc($t1, $t0, $t2);
  $u2 = array_diff_assoc($t2, $t0, $t1);
  echo 'counts ' . count($t0) . ' ' . count($t1) . ' ' . count($t2) . PHP_EOL;
  echo 'unique counts ' . count($u0) . ' ' . count($u1) . ' ' . count($u2) . PHP_EOL;
  echo_pretty_json($u0, $u1, $u2);
}
function hide_collectible_states($collectible) { // profile or character collectible. Just an array with a state key.
  if ($collectible['state'] & (8 | 16)) {
    throw new Exception('Unusual collectible state: ' . $collectible['state']);
  }
  return array(
    'state' => $collectible['state'] & (1 | 2 | 4 | 32), // hide 8 16 64
  );
}

function display_profile_milestones($type, $id) {
  $profile = profiles::get($type, $id);

  $milestones = definitions::get('Milestone');
  $activities = definitions::get('Activity');
  // $rewards = definitions::get('Reward');
  $objectives = definitions::get('Objective');

  $characters = array_values($profile['characterProgressions']['data']); // TODO handle all in parallel?

  $character = reset($characters);
  foreach ($character['milestones'] as $milestone_hash => $character_milestone) {
    $milestone = $milestones[$milestone_hash];

    echo_definition_line($milestone);

    foreach (array('startDate', 'endDate', 'order') as $key) {
      if (!empty($character_milestone[$key])) {
        echo_info_line($key . ' ', $character_milestone[$key], '', 1);
      }
    }

    if (!empty($character_milestone['vendors'])) {
      echo_info_line('has ', count($character_milestone['vendors']), ' vendors', 1);
    }

    if (!empty($character_milestone['activities'])) {
      echo_info_line('has ', count($character_milestone['activities']), ' activities', 1);
      foreach ($character_milestone['activities'] as $milestone_activity) {
        $activity = $activities[$milestone_activity['activityHash']];
        echo_definition_line($activity, 1, ' (activity)');

        // challenges
        foreach ($milestone_activity['challenges'] ?? [] as $challenge) {
          $objective = $objectives[$challenge['objective']['objectiveHash']];
          echo_definition_line($objective, 2, ' (challenge objective) (' . ($challenge['objective']['visible'] ? 'visible' : 'invisible') . ') (' . $challenge['objective']['progress'] . '/' . $challenge['objective']['completionValue'] . ') (' . ($challenge['objective']['complete'] ? 'complete' : 'incomplete') . ')');

          $handled_keys = array('objective');
          if (array_diff(array_keys($challenge), $handled_keys)) {
            echo 'unhandled challenge keys' . PHP_EOL;
            echo_pretty_json($character_milestone);
          }
        }

        // phases
        if (!empty($milestone_activity['phases'])) {
          $phases = [];
          foreach ($milestone_activity['phases'] as $phase) {
            $phases[] = $phase['complete'] ? 'Y' : 'N';
          }
          echo_info_line('phases: [', implode(',', $phases), ']', 2);
        }

        $handled_keys = array('activityHash', 'challenges', 'modifierHashes', 'booleanActivityOptions' /* no data available */, 'phases');
        if (array_diff(array_keys($milestone_activity), $handled_keys)) {
          echo 'unhandled activity keys' . PHP_EOL;
          echo_pretty_json($character_milestone);
        }
      }
    }

    if (!empty($character_milestone['rewards'])) { // TODO
      // echo_pretty_json($character_milestone);
      echo_info_line('has ', count($character_milestone['rewards']), ' rewards', 1);
      // foreach ($character_milestone['rewards'] as $reward) {}
    }

    if (!empty($character_milestone['availableQuests'])) { // TODO
      // echo_pretty_json($character_milestone);
      echo_info_line('has ', count($character_milestone['availableQuests']), ' available quests', 1);
      // foreach ($character_milestone['rewards'] as $reward) {}
    }

    $handled_keys = array('milestoneHash', 'startDate', 'endDate', 'order', 'vendors', 'activities', 'rewards', 'availableQuests');
    if (array_diff(array_keys($character_milestone), $handled_keys)) {
      echo 'unhandled milestone keys' . PHP_EOL;
      echo_pretty_json($character_milestone);
    }

  }

  echo PHP_EOL;
}
function list_all_milestones() { // TODO (for headers)
  $milestones = definitions::get('Milestone');
}






