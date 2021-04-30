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
display_node_hierarchy(3443694067, true); // TODO previous challenges? 3759694843



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
# $result = bungie_api::api('/UserSystemOverrides/');
# $result = bungie_api::api('/GlobalAlerts/');
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

function display_node_hierarchy($root_hash = '1866538467' /* records root */, $show_non_node_children = false, $current_depth = 0) {
  // "collectionRootNode": 3790247699,
  // "badgesRootNode": 498211331,
  // "metricsRootNode": 1074663644,
  // "activeTriumphsRootNodeHash": 1866538467,
  // "activeSealsRootNodeHash": 616318467,
  // "legacyTriumphsRootNodeHash": 3215903653,
  // "legacySealsRootNodeHash": 1881970629,
  // "medalsRootNodeHash": 3901403713,
  // "exoticCatalystsRootNodeHash": 511607103,
  // "loreRootNodeHash": 1993337477,
  // "seasonalChallengesPresentationNodeHash": 3443694067,

  $nodes = definitions::get('PresentationNode');
  $node = $nodes[$root_hash];

  $padding = str_pad('', 2 * $current_depth);
  echo $padding . "<span style='color:silver;'>" . str_pad($root_hash, 10) . "</span> {$node['displayProperties']['name']} <span style='color:silver;'>{$node['displayProperties']['description']}</span>" . PHP_EOL;

  if ($show_non_node_children) {
    if (!empty($node['children']['collectibles'])) {
      echo $padding . '  has collectibles' . PHP_EOL; // could add display
    }
    if (!empty($node['children']['records'])) {
      echo $padding . '  has records' . PHP_EOL; // could add display
    }
    if (!empty($node['children']['metrics'])) {
      echo $padding . '  has metrics' . PHP_EOL; // could add display
    }
  }

  foreach ($node['children']['presentationNodes'] as $child) {
    display_node_hierarchy($child['presentationNodeHash'], $show_non_node_children, $current_depth + 1);
  }

  if (!$current_depth) {
    echo PHP_EOL;
  }
} 










