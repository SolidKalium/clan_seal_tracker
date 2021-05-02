<?php

// testing and development page
include 'include.php';

enable_implicit_flush();
echo '<pre>';



$runtime = -microtime(true);
echo "SCRIPT START" . PHP_EOL . PHP_EOL;


// definitions::update();
// list_all_seals($active = false);
// list_all_checklists($verbose = true);
// display_node_hierarchy(1866538467, 2); // TODO previous challenges? 3759694843

// display_node_hierarchy_reverse(199171388);
// display_node_hierarchy(3509235358);
// display_hash_info(3241617029);
// display_hash_info(1875194813);

// display_hash_info(3093771363);
// display_hash_info(2282824303);
// display_hash_info(29206418);


// investigating focusing lens mod
display_hash_info(792292104); // item
//  buckets, tier, perk
display_hash_info(1586531648); // collectible
display_hash_info(1402439016); // source
display_hash_info(59); // item category
display_hash_info(4104513227); // item category
display_hash_info(3196106184); // item category
display_hash_info(2906646562); // item category
display_node_hierarchy_reverse(1586531648); // collectible


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
// $result = bungie_api::api('/Destiny2/Milestones/'); // general milestone list
// $result = bungie_api::api('/Destiny2/SearchDestinyPlayer/-1/SolidKalium/');

$components = array(
  'None' => 0,
  'Profiles' => 100,
  // 'VendorReceipts' => 101,
	// "ProfileInventories" => 102,
	// "ProfileCurrencies" => 103,
	// "ProfileProgression" => 104, // checklists and artifact, even with privacy on
	// "PlatformSilver" => 105, // logged in user only
	// "Characters" => 200, // minutes played, light level, selected title, emblem, etc.
	// "CharacterInventories" => 201,
	// "CharacterProgressions" => 202, // might include season pass info. progression, faction, quest, milestone, quests, non-instanced item objectives, checklists, artifact
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
	"PresentationNodes" => 700,
	// "Collectibles" => 800,
	"Records" => 900,
	// "Transitory" => 1000, // currently empty
	// "Metrics" => 1100,
);
// $result = bungie_api::api('/Destiny2/5/Profile/4611686018500895898/?components=' . implode(',', array_values($components))); // kalium
// $result = bungie_api::api('/Destiny2/3/Profile/4611686018490731084/?components=' . implode(',', array_values($components))); // scorpin

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

$runtime += microtime(true);
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
    $seal_record = $records[$seal_node['completionRecordHash']];
    echo 'node ' . str_pad($seal_node['hash'], 10) . ' | record ' . str_pad($seal_record['hash'], 10) . ' | ' . $seal_node['displayProperties']['name'] . ' | ' . reset($seal_record['titleInfo']['titlesByGender']) . PHP_EOL;
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










