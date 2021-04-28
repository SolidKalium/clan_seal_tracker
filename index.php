<?php

// testing and development page

ob_end_flush();
echo '<pre>';


include 'api.php';

$runtime = -microtime(true);
echo "SCRIPT START" . PHP_EOL . PHP_EOL;

// update_definitions();

// $result = api('/App/FirstParty/');
// $result = api('/User/SearchUsers/?q=solid+kalium');
// $result = api('/User/GetBungieNetUserById/31110/');
// $result = api('/User/GetMembershipsById/31110/-1/');
// $result = api('/GroupV2/Search/', json_encode(array('name' => "\u{03bb}nomaly", 'groupType' => 1))); // this only returns one result?
// $result = api("/GroupV2/Name/\u{03bb}nomaly/1/"); // 0 general, 1 clan // also just one result
// $result = api('/GroupV2/4331943/');
// $result = api('/GroupV2/4331943/Members/');

// echo_pretty_json($result);


$records = get_definitions('Record');
$objectives = get_definitions('Objective');
$nodes = get_definitions('PresentationNode');
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
);
// I'll eventually want short names for the triumph tables


// foreach ($records as $hash => $record) {
//   if (array_intersect(array($hashes["GoS_all"], $hashes['GoS_seal']), $record["parentNodeHashes"])) {
//     if (count($record["objectiveHashes"]) === 1) {continue;}
//     echo_pretty_json($record);
//   }
// }

// objective hashes list the objectives per triumph. For solar/arc/etc, these indicate the different encounters+condition. The objectives have generic names describing the encounters. It will be better to just infer that the 4 parts are in order. completionValue is the number needed.
// presentationNodeType: 1 Category, 2 Collectibles, 3 Record. Note: The triumph for the GoS seal for completing the badge is of type record.
// toastStyle: 1 Record, 3 Badge, 4 MetaRecord, 7 GildedTitleComplete
// featuredPriority tends to be min or max 32 bit signed int
// The record icons are mostly generic. All non-collection GoS triumphs have the same icon. iconSequences has larger icons and variants for completed and not completed.
// I haven't seen how to tell a triumph should be hidden or is earnable only during one season. (e.g. guilding or first 24 hours)

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
