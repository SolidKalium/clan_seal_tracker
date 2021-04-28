<?php

// testing and development page

ob_end_flush();
echo '<pre>';


include 'include';

$runtime = -microtime(true);
echo "SCRIPT START" . PHP_EOL . PHP_EOL;

// definitions::update();

// $result = bungie_api::api('/App/FirstParty/');
// $result = bungie_api::api('/User/SearchUsers/?q=solid+kalium');
// $result = bungie_api::api('/User/GetBungieNetUserById/31110/');
// $result = bungie_api::api('/User/GetMembershipsById/31110/-1/');
// $result = bungie_api::api('/GroupV2/Search/', json_encode(array('name' => "\u{03bb}nomaly", 'groupType' => 1))); // this only returns one result?
// $result = bungie_api::api("/GroupV2/Name/\u{03bb}nomaly/1/"); // 0 general, 1 clan // also just one result
// $result = bungie_api::api('/GroupV2/4331943/');
$result = bungie_api::api('/GroupV2/4331943/Members/');
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
// $result = bungie_api::api('/Destiny2/5/Profile/4611686018500895898/?components=' . implode(',', array_values($components)));

echo_pretty_json($result);


// $records = definitions::get('Record');
// $objectives = definitions::get('Objective');
// $nodes = definitions::get('PresentationNode');
// echo_pretty_json($records);

$hashes = array(
  "GoS_all" => "615240848", // parent node for Garden of Salvation raid (includes stasis and flawless)
  "GoS_seal" => "1827854727", // parent node for Garden of Salvation seal (includes collection badge)
  "LW_all" => "1525933460", // includes stasis
  "LW_seal" => "1486062207", // includes collection badge. The title is on 1384029371, with objective 1299971712. PresentationNodeDefinition has a hash of the parent node and CompletionRecordHash of the title.
  "DSC_all" => "1726708384", // includes first 24 hours
  "DSC_seal" => "2960810718", // includes collection badge
  // "VoG_seal" => "",
  // "VoG_all" => "",
  "Beyond_Light_seal" => "79180995",
  "Dredgen_seal" => "3665267419",
  "Conqueror_seal" => "3776992251", // currently includes season of the chosen guilding
  "MMXIX_seal" => "1194128730",
  "MMXX_seal" => "1210906310", // parent node for MMXX seal
  // "MMXXI_seal" => "",
  // Seasonal challenges?
  // Checklists?
  // Catalysts?
);
// I'll eventually want short names for the triumph tables


// foreach ($records as $hash => $record) {
//   if (array_intersect(array($hashes["GoS_all"], $hashes['GoS_seal']), $record["parentNodeHashes"])) {
//     if (count($record["objectiveHashes"]) === 1) {continue;}
//     echo_pretty_json($record);
//   }
// }

/** Quick dictionary reference 
 * presentationNodeType: 1 Category, 2 Collectibles, 3 Record. Note: The triumph for the GoS seal for completing the badge is of type record.
 * toastStyle: 1 Record, 3 Badge, 4 MetaRecord, 7 GildedTitleComplete
 * privacy: 0 none, 1 public, 2 private
 * recordState: 0 not yet redeemed, 1 redeemed, 2 rewardunavailable, 4 objective not complete, 8 obscured, 16 invisible, 32 entitlement not owned, 64 can equip title
 */

// objective hashes list the objectives per triumph. For solar/arc/etc, these indicate the different encounters+condition. The objectives have generic names describing the encounters. It will be better to just infer that the 4 parts are in order. completionValue is the number needed.
// featuredPriority tends to be min or max 32 bit signed int
// The record icons are mostly generic. All non-collection GoS triumphs have the same icon. iconSequences has larger icons and variants for completed and not completed.
// I haven't seen how to tell a triumph should be hidden or is earnable only during one season. (e.g. guilding or first 24 hours)
// destiny and bungie membershipIDs are not the same
// DestinyUnlockValueUIStyle controls how the unlock value "should" be displayed

// PresentationNode is the display category.
// PN.hash = 616318467 is the parent node for all earnable seals. It has no parent. It's presentationNode children are the seals.
// PN.completionRecordHash = record.hash for a seal.
// PN.hash = record.parentNodeHash for a triumph in a seal. The records are also listed as children of the PN.
// PN.hash = 1881970629 is the parent node for all legacy seals.
// Other top-level PNs include: seasonal challenges, various metrics, items, various seasonal collection sets, badges, etc.

// $text = file_get_contents("definitions/DestinyObjectiveDefinition-a1065791-e29c-4e23-9dc7-d88310a12936.json");
// $objectives = json_decode($text, true);
// echo_pretty_json($objectives);

// TODO get a player's details

$runtime += microtime(true);
echo "SCRIPT END after " . number_format($runtime, 3) . " seconds";
