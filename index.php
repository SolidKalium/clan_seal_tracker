<?php

include 'include.php';

enable_implicit_flush(); // doesn't work with <link> css
echo '<style> ' . file_get_contents('resources/tracker.css') . ' </style>';
echo '<script> ' . file_get_contents('resources/tracker.js') . ' </script>';
echo '<link rel="shortcut icon" href="resources/favicon_16.png" type="image/x-icon">';
echo '<pre>';


route();

// TODO list
  // support weekly milestones. three rows, one per character. two heading levels for raid phases
  // when to update definitions from manifest? create an intermediate dataset to cache per page? 23MB of item may be big for serverless
  // use a generic table display function so there's less of an arbitrary intermediate format that gets interpreted into html?
  // improve heading fetching. recursively handle nodes.
  // optionally suppress headings only if no one has it complete (or no progress)? records[].only_display_if => progress / complete
  //   Option to make heading not count toward progress?
  //   Store progress per cell, then sum at the end
  // use icons for gear classes acquired?
  // indicate somewhere that a triumph is per character instead of per account?
  // the names/descriptions/etc from Bungie may need to be html escaped in some places before displaying them. no known issues right now. use a linter or handle with the generic html table function.
  // better secrets/settings handling? Use json + settings
  //   optionally hide a user for a particular page
  // database instead of filesystem? make it work on a server
  // improve style on main page. Header. Improve flow of chunks.
  // Use jquery?
  // gracefully handle api auth errors, other errors
  // maybe do a basic api check for "player has been online since last data fetch". Might be on clan. If not, can skip updating that player
  //   may be able to fetch just one character if only one character has been played.
  // use a data structure for membership ids? type can be optional but generally required. pickle/unpickle functions
  // merge new and old profile and definition info? Make it work automatically
  // add objective to header hover text, just in case

  // highlight column on hover? (without bumping elements around. needs js)
  // show other details when clicking a column header or a cell? or on hover? (interval objectives, rewards, score, icons, gear source, etc)
  // add sort capability on columns? (for sorting columns after load. what is the best method to reorder data? css, move the nodes? https://stackoverflow.com/questions/10683712/html-table-sort)
  // column order (before load) (optional: columns that are completed the most are on the right)
  // third header for which node it came from?
  // option to auto-filter to people with certain progress? support filters in js. "at least one of", "all of" (no use case?), "progress on" (one or multiple?)
  // easy option to disable sort complete to bottom? might support multiple sort orders in js

  // make a page that can select users?
  // pin one or more users to the top? (or just highlight them orange)
  // support multiple clans or default clusters of users? maybe use cookies and a selector page.
  // put clan name and icon somewhere? Show seal icon if relevant?
  // right click option on a player to copy quick list of what they need. Another option for copying requirements and players for a selected group? right click to add player to selection for all pages or one page?
  // link user names to a relevant d2 checklist page?
  // ability to highlight blue users with overlap in missing requirements. Compare just to one missing thing or rank by similarity? or both?
  // right click user option to re-order columns so their incomplete columns are on the left
  // right click column option to send it to the right or left. May need to duplicate 3rd header if so... (or just remove it)

  // a settings page where users can login and control which pages they show up on?
  // connect to discord?
  // export as csv/excel?

  // table for each raid badge where the headers are encounters and subheaders are classes.
  //   Cell colors indicate status for completed that week, collected all drops for that encounter.
  //     Dark border and color if done that week?
  //     Red-yellow gradient for % completed?
  //   Cell icon might be the class symbol to better indicate the class for the character in case of duplicate class characters
  //     Auto-sort THW. Could change TTH order to THT (and HWW to WHW) so that the missing class is always replaced by a duplicate.
  //   Cell number for how many collectibles are available for that encounter?
  //   On cell hover, list the missing collectibles
  //   On header hover, list the possible gear


// Low priority list
  // for sets of gear in a collection, change text color to gold for each letter representing a class with a complete set

// Not fixing list
  // certain gear sets have very different names from each other and should be normalized to just the gear type
  // no support for gilded badges
  // tell which season a gilding triumph is for? I don't think this is in the api yet
  // harbinger seal's Lost No More triumph can have progress and be obscured. The number now shows but remains gray.
  // not distinguishing between unclaimed interval objectives and unclaimed but full-completed records
  // store updates for triumph progress for each person when updated. First seen and last seen timestamps for historical values.
  // a way to dive in to and explore the data for a particular triumph. E.g. list the successful and unsuccessful proving grounds runs for a player
  // fix up Bungie's descriptions (replace variables, things in [brackets], or unprintable icons from their font)
  // alternative rankings: triumph points; by fully completed triumphs and only using partial completion for tiebreaking


// Assumptions
  // interval objectives are always of the same kind.

function route() {
  if (isset($_GET['page'])) {
    show_page($_GET['page'], $_GET['type'] ?? null);
    return;
  }

  list_pages();
}


function get_page_definitions() {
  $pages = array(
    'last_wish' => array(
      'name' => 'Last Wish',
      'category' => 'Seals',
      'subcategory' => 'Raid',
      'seal_node_hash' => 1486062207,
      'badge_node_hash' => 1086048586,
      'other_node_hashes' => array(1525933460),
      'records' => array(
         2756328801 => array('column_name' => 'Badge', 'order' => 1),
         3448775736 => array('column_name' => 'Raid', 'order' => 2),
         4078980921 => array('column_name' => 'Clan', 'order' => 3),
         3000516033 => array('column_name' => 'Arc', 'number_objectives' => true, 'order' => 4),
         2826160801 => array('column_name' => 'Void', 'number_objectives' => true, 'order' => 5),
         623283604  => array('column_name' => 'Solar', 'number_objectives' => true, 'order' => 6),
         2588923804 => array('column_name' => 'Stasis', 'number_objectives' => true, 'order' => 7),
         342038729  => array('column_name' => 'Class', 'number_objectives' => true, 'order' => 8),
         717856991  => array('column_name' => 'Wishes', 'order' => -4),
         1359055399 => array('column_name' => 'Raid banners', 'order' => -3),
         628370196  => array('column_name' => 'Chests', 'order' => -2),
         380332968  => array('column_name' => "Petra's Run", 'order' => -1),
      ),
    ),
    'garden_of_salvation' => array(
      'name' => 'Garden of Salvation',
      'category' => 'Seals',
      'subcategory' => 'Raid',
      'seal_node_hash' => 1827854727,
      'badge_node_hash' => 223465203,
      'other_node_hashes' => array(615240848),
      'records' => array(
        3866024089 => array('column_name' => 'Badge', 'order' => 1),
        3804486505 => array('column_name' => 'Raid', 'order' => 2),
        1221037312 => array('column_name' => 'Clan', 'order' => 3),
        3427328428 => array('column_name' => 'Arc', 'number_objectives' => true, 'order' => 4),
        277137394  => array('column_name' => 'Void', 'number_objectives' => true, 'order' => 5),
        2571794337 => array('column_name' => 'Solar', 'number_objectives' => true, 'order' => 6),
        2629178011 => array('column_name' => 'Stasis', 'number_objectives' => true, 'order' => 7),
        1830799772 => array('column_name' => 'Class', 'number_objectives' => true, 'order' => 8),
        1922270325 => array('column_name' => 'Chests',),
        521675034  => array('column_name' => 'Divinity',),
        1522774125 => array('column_name' => 'Flawless', 'suppress' => true),
      ),
      // TODO
      // 1: accrued redemption, zealot's reward, legs
      // 2: reckless oracle, prophet of doom, arms
      // 3: sacred provenance, ancient gospel, chest
      // 4: omniscent eye, helmet, class
    ),
    'dsc' => array(
      'name' => 'Deep Stone Crypt',
      'category' => 'Seals',
      'subcategory' => 'Raid',
      'seal_node_hash' => 2960810718,
      'badge_node_hash' => 1235050036,
      'other_node_hashes' => array(1726708384),
      'records' => array(
        3504856768 => array('column_name' => 'Badge', 'order' => 1),
        3185876102 => array('column_name' => 'Raid', 'order' => 2),
        518342793  => array('column_name' => 'Clan', 'order' => 3),
        3834307795 => array('column_name' => 'Arc', 'number_objectives' => true, 'order' => 4),
        3875695735 => array('column_name' => 'Void', 'number_objectives' => true, 'order' => 5),
        3200831458 => array('column_name' => 'Solar', 'number_objectives' => true, 'order' => 6),
        513707022  => array('column_name' => 'Stasis', 'number_objectives' => true, 'order' => 7),
        564366615  => array('column_name' => 'Class', 'number_objectives' => true, 'order' => 8),
        992355976  => array('column_name' => 'Chests', 'number_objectives' => true),
        3323713181 => array('column_name' => 'Exo Logs', 'number_objectives' => true),
        2699580344 => array('column_name' => 'Day One', 'number_objectives' => true, 'suppress' => true),
        3560923614 => array('column_name' => 'Flawless', 'suppress' => true),
      ),
    ),
    'vog' => array(
      'name' => 'Vault of Glass',
      'category' => 'Seals',
      'subcategory' => 'Raid',
      'seal_node_hash' => 3734352323,
      'badge_node_hash' => 1154828558,
      'other_node_hashes' => array(132375837), // Just adds Tempo's edge and flawless
      'records' => array(
        2782679117 => array('column_name' => 'Badge'),
        578313932 => array('number_objectives' => true),
        932039090 => array('number_objectives' => true),
        1983700615 => array('column_name' => 'Arc', 'number_objectives' => true),
        1961032859 => array('column_name' => 'Void', 'number_objectives' => true),
        2592913942 => array('column_name' => 'Solar', 'number_objectives' => true),
        3969659747 => array('column_name' => 'Class', 'number_objectives' => true),
        3790077074 => array('number_objectives' => true),
        2384429092 => array('number_objectives' => true),
      ),
    ),
    'crucible' => array(
      'name' => 'Crucible',
      'category' => 'Seals',
      'subcategory' => 'Activity',
      'seal_node_hash' => 2107507397,
      'badge_node_hash' => 701100740,
      'hide_badge_unless_explicit' => true,
      'other_node_hashes' => array(
        3973313476 /* account crucible */,
        339137305 /* chosen/13 crucible */,
        1667143694 /* hunt/12 crucible */,
        3049172190 /* iron banner */
      ),
    ),
    'gambit' => array(
      'name' => 'Gambit',
      'category' => 'Seals',
      'subcategory' => 'Activity',
      'seal_node_hash' => 3665267419,
      'badge_node_hash' => 1420354007,
      'hide_badge_unless_explicit' => true,
      'other_node_hashes' => array(
        97371225 /* account gambit */,
        22122108 /* chosen/13 gambit */,
        3758722403 /* hunt/12 gambit */,
      ),
    ),
    'trials' => array(
      'name' => 'Trials of Osiris',
      'category' => 'Seals',
      'subcategory' => 'Activity',
      'seal_node_hash' => 1733555826,
      'badge_node_hash' => 564984975,
      'hide_badge_unless_explicit' => true,
      'other_node_hashes' => array(
        2739258696 /* account trials */,
        2463489289 /* chosen/13 trials */,
        3813527194 /* hunt/12 trials */,
      ),
    ),
    'strikes' => array(
      'name' => 'Strikes',
      'category' => 'Seals',
      'subcategory' => 'Activity',
      'seal_node_hash' => 3776992251,
      'other_node_hashes' => array(
        1954283988 /* account nightfalls */,
        1990811028 /* account strikes */,
        636644708 /* chosen/13 strikes */,
        2675905563 /* hunt/12 strikes */,
        4285884347 /* dreaming city strikes */,
        1427965125 /* tangled shore strikes */,
        69244313 /*  nessus strikes */,
        245634203 /* edz strikes */,
        2973304209 /* cosmodrome strikes */,
      ),
    ),
    // 'conqueror' => array( // season 14 doesn't have triumphs for strikes/crucible/gambit
    //   'name' => 'Conqueror + season 13 strikes',
    //   'category' => 'Seals',
    //   'subcategory' => 'Activity',
    //   'seal_node_hash' => null,
    //   'other_node_hashes' => array(
    //     3776992251 /* conqueror seal */,
    //     // 1954283988 /* account nightfalls */,
    //     // 1990811028 /* account strikes */,
    //     // 636644708 /* chosen/13 strikes */,
    //     // 2675905563 /* hunt/12 strikes */,
    //     // 4285884347 /* dreaming city strikes */,
    //     // 1427965125 /* tangled shore strikes */,
    //     // 69244313 /*  nessus strikes */,
    //     // 245634203 /* edz strikes */,
    //     // 2973304209 /* cosmodrome strikes */,
    //   ),
    //   'require_at_least_one_record_hash' => array( // TODO
    //     3663146391, // devil's lair
    //     3176422761, // arms dealer
    //     2483704578, // proving grounds
    //     2589774932, // warden
    //     371577627, // saber
    //     2117601105, // insight terminus
    //     1820446245, // devil's lair
    //     1404404279, // arms dealer
    //     2867134615, // proving grounds
    //     4018693329, // warden
    //     8651357, // saber
    //     1451485767, // insight terminus
    //   ),
    // ),

    'shadowkeep' => array(
      'name' => 'Shadowkeep', // seal name is harbinger, not to be confused with the harbinger exotic quest
      'category' => 'Seals',
      'subcategory' => 'Seasonal',
      'seal_node_hash' => 379405979,
      'badge_node_hash' => 2388540594,
      'hide_badge_unless_explicit' => true,
      'other_node_hashes' => array(
        1172527717 /* shadowkeep */,
        3580665945 /* nightmares */,
        2130735626 /* nightmare time trials */,
        1325869705 /* altar of sorrows */,
        2832559544 /* exploration */,
        1676236275 /* world */,
      ),
    ),
    'beyond_light' => array(
      'name' => 'Beyond Light',
      'category' => 'Seals',
      'subcategory' => 'Seasonal',
      'seal_node_hash' => 79180995,
      'badge_node_hash' => 2078340986,
      'hide_badge_unless_explicit' => true,
      'other_node_hashes' => array(
        135736218 /* house salvation */,
        3692479600 /* exploration */,
        148653552 /* quests */,
        2322553724 /* secrets */,
      ),
    ),
    'season_12' => array(
      'name' => 'Season of the Hunt',
      'category' => 'Seals',
      'subcategory' => 'Seasonal',
      'seal_node_hash' => 1321008463,
      'other_node_hashes' => array(
        3669331558 /* quests */,
        3937870096 /* activities */,
        2802812434 /* gear */,
        1808459779 /* general */,
      ),
    ),
    'season_13' => array(
      'name' => 'Season of the Chosen',
      'category' => 'Seals',
      'subcategory' => 'Seasonal',
      'seal_node_hash' => 1321008462,
      'other_node_hashes' => array(
        643487148 /* quests */,
        1071337794 /* activities */,
        121075568 /* gear */,
        3006777794 /* general */,
      ),
    ),
    'season_14' => array(
      'name' => 'Season of the Splicer',
      'category' => 'Seals',
      'subcategory' => 'Seasonal',
      'seal_node_hash' => 1321008457,
      'other_node_hashes' => array(
        1134387311 /* quests */,
        2826444925 /* activities */,
        529389631 /* gear */,
        3807851309 /* prismatic lenses */,
        933409053 /* general */,
      ),
    ),
    'mmxxi' => array(
      'name' => 'MMXXI',
      'category' => 'Seals',
      'subcategory' => 'Seasonal',
      'disable_reason' => 'not yet available',
    ),

    'dreaming_city' => array(
      'name' => 'Dreaming City',
      'category' => 'Seals',
      'subcategory' => 'Destination',
      'seal_node_hash' => 560097044,
      'badge_node_hash' => 3642989833,
      'hide_badge_unless_explicit' => true,
      'other_node_hashes' => array(
        1318886167 /* missions */,
        3424890260 /* ascendant challenges */,
        2983489279 /* exploration */,
        3593914021 /* public events */,
        1995542897 /* bounties */,
        302201398 /* the curse */,
      ),
    ),
    'tangled_shore' => array(
      'name' => 'Tangled Shore',
      'category' => 'Seals',
      'subcategory' => 'Destination',
      'other_node_hashes' => array(
        1128540555 /* baron hunts */,
        1764843934 /* challenges */,
        4294103237 /* exploration */,
        1876261587 /* public events */,
      ),
    ),
    'nessus' => array(
      'name' => 'Nessus',
      'category' => 'Seals',
      'subcategory' => 'Destination',
      'other_node_hashes' => array(
        1663192739 /* world */,
        4161172201 /* exploration */,
      ),
    ),
    'edz' => array(
      'name' => 'European Dead Zone',
      'category' => 'Seals',
      'subcategory' => 'Destination',
      'other_node_hashes' => array(
        748764525 /* world */,
        2074120351 /* exploration */,
      ),
    ),
    'cosmodrome' => array(
      'name' => 'Cosmodrome',
      'category' => 'Seals',
      'subcategory' => 'Destination',
      'other_node_hashes' => array(
        3177164055 /* exploration */,
      ),
    ),
    'lost_sectors' => array(
      'name' => 'Lost Sectors',
      'category' => 'Seals',
      'subcategory' => 'Destination',
      'records' => array( // TODO it would be better if these were grouped
        520634566 => array(), // Concealed Void
        2854743101 => array(),
        1416307185 => array(),
        4076413958 => array(), // Bunker E15
        631767421 => array(),
        1525617457 => array(),
        430920723 => array(), // Perdition
        3227342880 => array(),
        745577862 => array(),
        4003962220 => array(), // Veles Labyrinth
        767109427 => array(),
        3965319255 => array(),
        411957691 => array(), // Exodus Garden 2A
        817142456 => array(),
        2203010110 => array(),
        1887599917 => array(), // K1 Logistics
        1327177738 => array(),
        6245488 => array(),
        1511640986 => array(), // K1 Revelation
        3983292393 => array(),
        1565741749 => array(),
        2561650494 => array(), // K1 Crew Quarters
        1435133189 => array(),
        114953849 => array(),
        1803530104 => array(), // K1 Communion
        2317819527 => array(),
        4040235491 => array(),
      ),
    ),

    'new_light' => array(
      'name' => 'New Light',
      'category' => 'Lifetime',
      'subcategory' => null,
      'other_node_hashes' => array(
        2748609922, // progression
        2957698451, // combatants
        1132985648, // gear
        1573488630, // clans (social)
        3346731843, // fireteam (social)
      ),
    ),
    'titan' => array(
      'name' => 'Titan',
      'category' => 'Lifetime',
      'subcategory' => null,
      'other_node_hashes' => array(
        3436349154,
      ),
    ),
    'hunter' => array(
      'name' => 'Hunter',
      'category' => 'Lifetime',
      'subcategory' => null,
      'other_node_hashes' => array(
        264195358,
      ),
    ),
    'warlock' => array(
      'name' => 'Warlock',
      'category' => 'Lifetime',
      'subcategory' => null,
      'other_node_hashes' => array(
        1424071291,
      ),
    ),

    // Lost Sectors
    // Region Chests
    'corrupted_eggs' => array(
      'name' => 'Corrupted Eggs',
      'category' => 'Checklists',
      'subcategory' => null,
      'checklist_hash' => 2609997025,
    ),
    'ahamkara_bones' => array(
      'name' => 'Ahamkara Bones',
      'category' => 'Checklists',
      'subcategory' => null,
      'checklist_hash' => 1297424116,
    ),
    // Jade Rabbits
    // Dead Ghosts
    'cat_statues' => array(
      'name' => 'Cat Statues',
      'category' => 'Checklists',
      'subcategory' => null,
      'checklist_hash' => 2726513366,
    ),
    'penguins' => array(
      'name' => 'Penguin Souvenirs',
      'category' => 'Checklists',
      'subcategory' => null,
      'checklist_hash' => 817948795,
    ),
    'entropic_shards' => array(
      'name' => 'Entropic Shards',
      'category' => 'Checklists',
      'subcategory' => null,
      'checklist_hash' => 1885088224,
    ),
    'dead_exos' => array(
      'name' => 'Dead Exos',
      'category' => 'Checklists',
      'subcategory' => null,
      'checklist_hash' => 2568476210,
    ),
    'glykon_clues' => array(
      'name' => 'Glykon Clues',
      'category' => 'Checklists',
      'subcategory' => null,
      'checklist_hash' => 3975225462,
    ),

    'shattered_throne' => array(
      'name' => 'Shattered Throne',
      'category' => 'Dungeons',
      'subcategory' => null,
      'other_node_hashes' => array(1347078175),
    ),
    'pit_of_heresey' => array(
      'name' => 'Pit of Heresy',
      'category' => 'Dungeons',
      'subcategory' => null,
      'other_node_hashes' => array(2828966211),
    ),
    'prophecy' => array(
      'name' => 'Prophecy',
      'category' => 'Dungeons',
      'subcategory' => null,
      'other_node_hashes' => array(2228154284),
    ),

    'harbinger' => array(
      'name' => 'Harbinger',
      'category' => 'Quests',
      'subcategory' => null,
      'other_node_hashes' => array(1460167656),
    ),
    'presage' => array(
      'name' => 'Presage',
      'category' => 'Quests',
      'subcategory' => null,
      'other_node_hashes' => array(3108806378),
    ),

    'season_10_badge' => array(
      'name' => 'Season of Arrivals',
      'category' => 'Badges',
      'subcategory' => null,
      'type' => 'badge',
      'badge_node_hash' => 3459575786,
    ),
    'season_9_badge' => array(
      'name' => 'Season of Dawn',
      'category' => 'Badges',
      'subcategory' => null,
      'type' => 'badge',
      'badge_node_hash' => 4257248973,
    ),
    'season_8_badge' => array(
      'name' => 'Season of the Undying',
      'category' => 'Badges',
      'subcategory' => null,
      'type' => 'badge',
      'badge_node_hash' => 3267852685,
    ),
    'season_7_badge' => array(
      'name' => 'Season of Opulence',
      'category' => 'Badges',
      'subcategory' => null,
      'type' => 'badge',
      'badge_node_hash' => 2759158924,
    ),
    'season_6_badge' => array(
      'name' => 'Season of the Drifter',
      'category' => 'Badges',
      'subcategory' => null,
      'type' => 'badge',
      'badge_node_hash' => 2503214417,
    ),
    'season_5_badge' => array(
      'name' => 'Season of the Forge',
      'category' => 'Badges',
      'subcategory' => null,
      'type' => 'badge',
      'badge_node_hash' => 2399267278,
    ),
    'destination_forsaken_badge' => array(
      'name' => 'Forsaken',
      'category' => 'Badges',
      'subcategory' => null,
      'type' => 'badge',
      'badge_node_hash' => 2881240068,
    ),
    'exotics_forsaken_badge' => array(
      'name' => 'Forsaken Exotics',
      'category' => 'Badges',
      'subcategory' => null,
      'type' => 'badge',
      'badge_node_hash' => 3333531796,
    ),
    'destination_curse_badge' => array(
      'name' => 'Curse of Osiris and Warmind',
      'category' => 'Badges',
      'subcategory' => null,
      'type' => 'badge',
      'badge_node_hash' => 1331476689,
    ),
    'exotics_curse_badge' => array(
      'name' => 'Curse of Osiris and Warmind Exotics',
      'category' => 'Badges',
      'subcategory' => null,
      'type' => 'badge',
      'badge_node_hash' => 1419883649,
    ),
    'destination_red_war_badge' => array(
      'name' => 'Red War',
      'category' => 'Badges',
      'subcategory' => null,
      'type' => 'badge',
      'badge_node_hash' => 2904806741,
    ),
    'exotics_red_war_badge' => array(
      'name' => 'Red War Exotics',
      'category' => 'Badges',
      'subcategory' => null,
      'type' => 'badge',
      'badge_node_hash' => 3241617029,
    ),

    'milestones' => array(
      'name' => 'Milestones',
      'category' => 'Other',
      'subcategory' => null,
      'other_node_hashes' => array(),
      'records' => array(

      ),
      'disable_reason' => 'in development',
    ),
    'catalysts' => array(
      'name' => 'Catalysts',
      'category' => 'Other',
      'subcategory' => null,
      'other_node_hashes' => array(2538646043, 185103480, 3788273704),
      'records' => array(
        2660706768 => array('suppress' => true), // bastion
        3068761227 => array('suppress' => true), // devil's ruin
      ),
    ),
    'mods' => array(
      'name' => 'Mods',
      'category' => 'Other',
      'subcategory' => null,
      'suppress_seasonal_mods' => true,
      'other_node_hashes' => array(
        2819021773 /* Head */,
        2390416266 /* Arms */,
        4163848934 /* Chest */,
        1817221096 /* Legs */,
        1170707857 /* Class */,
        1929360037 /* General */,
        123185593 /* Combat Style */,
        2154827630 /* Legacy and Raid */,
        3839307707 /* Weapons */,
        3110461398 /* Ghost */,
      ),
      'collectibles' => array(
        '737130625' => array('column_name' => 'Riven\'s Curse', 'suppress' => true), // not acquireable
      ),
    ),
    'seasonal_challenges' => array(
      'name' => 'Seasonal Challenges',
      'category' => 'Other',
      'subcategory' => null,
      'other_node_hashes' => array(1243102869, 2412404671, 2412404668, 2412404669, 2412404666, 2412404667, 2412404664, 2412404665, 2412404662, 2412404663, 445954461),
      // 'other_node_hashes' => array(193232030, 1371596488, 1371596491, 1371596490, 1371596493, 1371596492, 1371596495, 1371596494, 1371596481, 1371596480, 2058046696), // season 13
      'records' => array(

      ),
    ),
    'solstice' => array(
      'name' => 'Solstice of Heroes',
      'category' => 'Other',
      'subcategory' => null,
      'other_node_hashes' => array(760002588),
    ),
    'guardian_games' => array(
      'name' => 'Guardian Games',
      'category' => 'Other',
      'subcategory' => null,
      'other_node_hashes' => array(1965217294),
    ),
    // 'dawning' => array(
    //   'name' => 'Dawning',
    //   'category' => 'Other',
    //   'subcategory' => null,
    //   'other_node_hashes' => array(12380736, 2293230544),
    // ),
  );

  // other_node_hashes should only have nodes that are direct parents of records
  // if a record is in the records list, it should be displayed even if not part of a relevant node.
  // if a record is suppressed, don't show it

  return $pages;
}

function list_pages() {
  echo "<title>D2 Clan Seal Tracker</title>";

  $pages = get_page_definitions();
  $nodes = definitions::get('PresentationNode');
  $records = definitions::get('Record');

  $page_index = array();
  foreach ($pages as $key => $page) {
    $page['key'] = $key;
    $page_index[$page['category']][$page['subcategory']][] = $page;
  }

  foreach ($page_index as $category => $category_info) {
    echo '<h2>' . $category . '</h2>';

    foreach ($category_info as $subcategory => $subcategory_info) {
      echo '<h3>' . $subcategory . '</h3>';

      echo '<ul>';
      foreach ($subcategory_info as $page) {
        $disabled = !empty($page['disable_reason']);
        if ($disabled) {
          echo "<li disabled=1>{$page['name']} ({$page['disable_reason']})</li>";
        } else {
          $other_pages = '';
          if (!empty($page['seal_node_hash'])) {
            $seal_node = $nodes[$page['seal_node_hash']];
            $seal_record = $records[$seal_node['completionRecordHash']];  // has title. ignore objective
            $other_pages .= ' (<a href="?page=' . $page['key'] . '&type=seal">' . reset($seal_record['titleInfo']['titlesByGender']) . ' seal</a>)';
          }
          if (
            !empty($page['badge_node_hash']) &&
            (empty($page['type']) || $page['type'] !== 'badge')
          ) {
            $badge_node = $nodes[$page['badge_node_hash']];
            $other_pages .= ' (<a href="?page=' . $page['key'] . '&type=badge">Badge</a>)';
          }
          echo "<li><a href='?page={$page['key']}'>{$page['name']}</a>$other_pages</li>";
        }
      }
      echo '</ul>';
    }
  }
}

/**
 * Notes:
 * - Private players aren't shown at all
 * @param  [string] $page_name
 * @param  [string?] $type
 * @return null
 */
function show_page($page_key, $type = null) {
  $pages = get_page_definitions();

  if (empty($pages[$page_key])) {
    throw new Exception('Page ' . $page_key . ' not found');
  }

  $page = $pages[$page_key];

  if ($type === 'seal') {
    $nodes = definitions::get('PresentationNode');
    $records = definitions::get('Record');

    $seal_node = $nodes[$page['seal_node_hash']];
    $seal_record = $records[$seal_node['completionRecordHash']];

    $title = reset($seal_record['titleInfo']['titlesByGender']) . ' (' . $page['name'] . ' Seal)';
  } else if ($type === 'badge') {
    $nodes = definitions::get('PresentationNode');

    $badge_node = $nodes[$page['badge_node_hash']];

    $title = $badge_node['displayProperties']['name'] . " ({$page['name']} Badge)";
  } else {
    $title = $page['name'];
  }

  echo "<title>$title</title>";
  echo "<h1>$title</h1>";


  // $players = profiles::get_cached_players();
  $players = bungie_api::get_group_members(get_setting("group_id"));

  $headings = get_headings($page, $type);
  $rows = get_rows($page_key, $headings, $players);
  $max_completion = count($headings) - 1;

  
  $th1 = '';
  $th2 = '';
  // $th_bg = '<tr><th colspan="' . count($headings) . '"" id="header-bg"></th</tr>'; // display none until loaded table-row?
  // I have found no way to style below a tr or th, including using after
  // chrome moves divs out of the table
  // I can add a third sticky tr, but I don't know how to hide it until it is scrolled past
  // If border-collapse is collapse, header borders aren't sticky.
  // If border-spacing is 0, the borders look too thick
  foreach ($headings as $heading) {
    $column_name = $heading['column_name'] ?? $heading['name'];

    $heading_attributes = 'title="' . htmlspecialchars($heading['description']) . '"'; // first row
    $heading_attributes_2 = ''; // second row / objectives
    if (!empty($heading['for_gilding'])) {
      $heading_attributes .= ' gild';
      $heading_attributes_2 .= ' gild';
    }
    if (!empty($heading['record_hash'])) {
      $heading_attributes .= " record_hash='{$heading['record_hash']}'";
    }
    if (!empty($heading['checklist_entry_hash'])) {
      $heading_attributes .= " checklist_entry_hash='{$heading['checklist_entry_hash']}'";
    }
    if (!empty($heading['collectible_hash'])) {
      $heading_attributes .= " collectible_hash='{$heading['collectible_hash']}'";
    }
    if (!empty($heading['collectible_hash_set'])) {
      $heading_attributes .= ' collectible_hash="' . implode(' ', $heading['collectible_hash_set']) . '"';
    }

    if (empty($heading['objectives']) || count($heading['objectives']) === 1) {
      $th1 .= "<th rowspan='2' $heading_attributes>{$column_name}</th>";
    } else {
      $count = count($heading['objectives']);
      $th1 .= "<th colspan='$count' $heading_attributes}'>{$column_name}</th>";
      foreach ($heading['objectives'] as $key => $objective) {
        $subcolumn_name = !empty($heading['number_objectives']) ? $key + 1 : $objective['name'];
        $title = !empty($heading['number_objectives']) ? 'title="' . htmlspecialchars($objective['name']) . '"' : '';
        $th2 .= "<th $title objective_hash='{$objective['hash']}' $heading_attributes_2>$subcolumn_name</th>";
      }
    }
  }

  $table = "<table><thead><tr class='first'>$th1</tr><tr class='second'>$th2</tr></thead><tbody>";


  foreach ($rows as $player_data) {
    $table .= "<tr id='{$player_data['id']}'>";
    foreach ($headings as $heading) {
      if ($heading['name'] === 'Player') {
        $completed = rtrim(rtrim(number_format($player_data['total_completion'], 2), '0'), '.');
        $title = "title='$completed/$max_completion'";
        if (profiles::is_stadia($player_data['name'])) {
          $name = explode('#', $player_data['name']);
          $table .= "<td $title>{$name[0]}<span class=name-number>#{$name[1]}</span></td>";
        } else {
          $table .= "<td $title>{$player_data['name']}</td>";
        }
        continue;
      }

      if (!empty($heading['record_hash'])) {
        $table .= get_player_record_tds($player_data, $heading);
      } else if (!empty($heading['checklist_entry_hash'])) {
        $table .= get_player_checklist_entry_td($player_data, $heading);
      } else if (!empty($heading['collectible_hash']) || !empty($heading['collectible_hash_set'])) {
        $table .= get_player_collectible_td($player_data, $heading);
      } else {
        echo_pretty_json($heading);
        throw new Exception('unhandled heading');
      }

    }
    $table .= "</tr>"; //break;
  }

  $table .= '</tbody></table>';
  echo $table;
}
function get_player_record_tds($player_data, $heading) {
  $player_record = $player_data['records'][$heading['record_hash']];
  if (!empty($heading['objectives'])) {
    $html = '';
    foreach ($heading['objectives'] as $key => $objective) {
      $player_objective = $player_record['objectives'][$key];
      if ($player_objective['objectiveHash'] !== $objective['hash']) { // ensure the order is constant
        throw new Exception("hashes don't match. {$player_objective['objectiveHash']} !== {$objective['hash']}");
      }

      $class = '';
      if (count($heading['objectives']) > 1) {
        if ($objective === reset($heading['objectives'])) {
          $class = 'group first';
        } else if ($objective === end($heading['objectives'])) {
          $class = 'group last';
        } else {
          $class = 'group middle';
        }
      }
      if ($heading['number_objectives'] ?? false) {
        $class .= ' numbered';
      }

      $progress = $player_objective['progress'];
      if ($progress === 0 || $progress === $objective['completionValue']) {
        $progress = '';
      }
      $recordState = get_player_objective_state($player_record, $key);

      $html .= "<td recordState='$recordState' title='{$player_objective['progress']}/{$objective['completionValue']}' class='$class'>$progress</td>";
    }
    return $html;
  }

  if (!empty($heading['interval_objectives'])) {
    $key = count($heading['interval_objectives']) - 1; // assume last one is the highest. They should all have progress up to their cap
    $player_objective = $player_record['intervalObjectives'][$key];
    $progress = $player_objective['progress'];
    if ($progress === 0 || $progress === $player_objective['completionValue']) {
      $progress = '';
    }
    $recordState = get_player_objective_state($player_record, $key);
    return "<td recordState='$recordState' title='{$player_objective['progress']}/{$player_objective['completionValue']}'>$progress</td>";
  }

  if (count($player_record) === 2 && !array_diff(array_keys($player_record), array('state', 'intervalsRedeemedCount'))) {
    // certain unearnable triumphs only have state and intervalsRedeemedCount
    // I haven't seen the state be zero, and it probably isn't possible to leave it unredeemed over seasons
    $recordState = (($player_record['state'] === 0) || ($player_record['state'] & 1)) ? 'complete' : 'incomplete';
    return "<td recordState='$recordState'></td>";
  }

  echo_pretty_json($heading);
  throw new Exception('unhandled heading');
}
function get_player_checklist_entry_td($player_data, $heading) {
  $complete = $player_data['checklist_entries'][$heading['checklist_entry_hash']];
  $recordState = $complete ? 'complete' : 'incomplete';
  return "<td recordState='$recordState'></td>";
}
function get_player_collectible_td($player_data, $heading) {
  // echo_pretty_json($heading, $player_data);
  
  if (!empty($heading['collectible_hash'])) {
    $key = $heading['collectible_hash'];
  } else {
    $key = implode(',', array_values($heading['collectible_hash_set']));
  }

  $player_collectible = $player_data['collectibles'][$key];
  // echo_pretty_json($key, $player_collectible);
  // exit();

  return "<td recordState='{$player_collectible['state_text']}'>{$player_collectible['description']}</td>";
}

function get_headings($page, $type = null) {
  $headings = array();

  $headings[] = array(
    'name' => 'Player',
    'description' => 'Name in Destiny',
    'order' => 0,
  );

  $next_default_order = 100;

  ///// RECORD HEADINGS
  $nodes = definitions::get('PresentationNode');
  $records = definitions::get('Record');
  $objectives = definitions::get('Objective');

  $record_hash_lists = array();
  $collectible_hash_lists = array();
  if ((!$type || $type === 'seal') && !empty($page['seal_node_hash'])) {
    $seal_node = $nodes[$page['seal_node_hash']];
    $record_hash_lists[] = array_column($seal_node['children']['records'], 'recordHash');
  }
  if (!$type) {
    if (!empty($page['other_node_hashes'])) {
      foreach ($page['other_node_hashes'] as $node_hash) {
        $record_hash_lists[] = array_column($nodes[$node_hash]['children']['records'], 'recordHash');
        $collectible_hash_lists[] = array_column($nodes[$node_hash]['children']['collectibles'], 'collectibleHash');
      }
    }

    if (!empty($page['records'])) {
      $record_hash_lists[] = array_keys($page['records']);
    }
  }

  foreach ($record_hash_lists as $record_hash_list) {
    foreach ($record_hash_list as $record_hash) {
      $record = $records[$record_hash];

      if (!empty($headings[$record['hash']])) {
        continue; // already added from a different list
      }
      if (!empty($page['records'][$record['hash']]['suppress'])) {
        continue;
      }

      $heading = array(
        'record_hash' => $record['hash'],
        'name' => $record['displayProperties']['name'],
        'description' => $record['displayProperties']['description'] .
          ($record['expirationInfo']['description'] ? ' (' . $record['expirationInfo']['description'] . ')' : '') .
          ($record['requirements']['entitlementUnavailableMessage'] ? ' (' . $record['requirements']['entitlementUnavailableMessage'] . ')' : ''),
        'icon' => $record['displayProperties']['icon'],
        'objectives' => array(),
        'interval_objectives' => array(),
        'scope' => $record['scope'], // 0 account, 1 character
        'for_gilding' => $record['forTitleGilding'],
        'order' => $page['records'][$record['hash']]['order'] ?? ($next_default_order++),
        // not handling rewards and interval rewards
        // not handling ScoreValue and intervalScoreValues
        // not handling featuredPriority. Usually min or max int, but sometimes something like 91000
      ) + ($page['records'][$record['hash']] ?? array());

      foreach ($record['objectiveHashes'] as $hash) {
        $objective = $objectives[$hash]; // completion value, progress description
        $heading['objectives'][] = array(
          'hash' => $hash,
          'name' => $objective['progressDescription'],
          'completionValue' => $objective['completionValue'],
          // valueStyle uses enum DestinyUnlockValueUIStyle. how to properly display progress as a number/checkbox/etc
        );
      }
      if (!empty($record['intervalInfo']['intervalObjectives'])) {
        foreach ($record['intervalInfo']['intervalObjectives'] as $interval_objective) {
          // $interval_objective is just intervalValueScore and hash
          $objective = $objectives[$interval_objective['intervalObjectiveHash']];
          $heading['interval_objectives'][] = array(
            'hash' => $objective['hash'],
            'name' => $objective['progressDescription'],
            'completionValue' => $objective['completionValue'],
          );
        }
      }

      $headings[$record['hash']] = $heading;
    }
  }
  if (array_filter($collectible_hash_lists)) {
    // Unlike badges, these don't get merged
    $collectibles = definitions::get('Collectible');
    $items = definitions::get('InventoryItemLite');

    if (!empty($page['suppress_seasonal_mods'])) {
      $artifacts = definitions::get('Artifact');
      $artifact_item_hashes = array();
      foreach ($artifacts as $artifact) {
        foreach ($artifact['tiers'] as $tier) {
          foreach ($tier['items'] as $item) {
            $artifact_item_hashes[] = $item['itemHash'];
          }
        }
      }
    }

    foreach ($collectible_hash_lists as $collectible_hash_list) {
      foreach ($collectible_hash_list as $collectible_hash) {
        $collectible = $collectibles[$collectible_hash];
        $item = $items[$collectible['itemHash']];
        // not showing mod perks

        if (!empty($page['collectibles'][$collectible_hash]['suppress'])) {
          continue;
        }
        if (!empty($headings[$collectible['hash']])) {
          continue; // already added from a different list
        }

        if (
          !empty($page['suppress_seasonal_mods']) &&
          in_array($collectible['itemHash'], $artifact_item_hashes)
        ) {
          continue;
        }

        $headings[] = array(
          'collectible_hash' => $collectible['hash'],
          'name' => $collectible['displayProperties']['name'],
          'description' => $item['itemTypeDisplayName'],
          'scope' => $collectible['scope'],
          'order' => ($next_default_order++),
        );
      }
    }
  }

  // CHECKLIST HEADINGS
  if (!$type && !empty($page['checklist_hash'])) {
    $checklists = definitions::get('Checklist');
    $checklist = $checklists[$page['checklist_hash']];
    foreach ($checklist['entries'] as $entry) {
      $headings[] = array(
        'checklist_hash' => $page['checklist_hash'],
        'checklist_entry_hash' => $entry['hash'],
        'name' => $entry['displayProperties']['name'],
        'description' => $entry['displayProperties']['description'], // always empty right now
        'scope' => $entry['scope'],
        'location_hash' => $entry['destinationHash'] ?? null,
        'destination_hash' => $entry['locationHash'] ?? null,
        'bubble_hash' => $entry['bubbleHash'] ?? null,
        'order' => ($next_default_order++),
      );
    }
  }

  // BADGE HEADINGS
  // note: currently ignores page.collectibles
  if (
    ($type === 'badge') ||
    (!$type && !empty($page['badge_node_hash']) && empty($page['hide_badge_unless_explicit']))
  ) {
    $collectibles = definitions::get('Collectible');
    $items = definitions::get('InventoryItemLite');

    $badge_node = $nodes[$page['badge_node_hash']];
    $class_node_hashs = array_column($badge_node['children']['presentationNodes'], 'presentationNodeHash');

    $collectible_hash_sets = array();
    foreach ($class_node_hashs as $class_node_hash) {
      $badge_class_node = $nodes[$class_node_hash];
      $class = $badge_class_node['displayProperties']['name']; // All current badges have 3 nodes with the same number of items, one named for each class

      $collectible_hashs = array_column($badge_class_node['children']['collectibles'], 'collectibleHash');
      foreach ($collectible_hashs as $key => $collectible_hash) {
        $collectible_hash_sets[$key][$class] = $collectible_hash;
      }
    }

    $class_names = array(
      0 => 'Titan',
      1 => 'Warlock',
      2 => 'Hunter',
    );

    foreach ($collectible_hash_sets as $collectible_hash_set) {
      $identical = (count(array_unique(array_values($collectible_hash_set))) === 1);

      $collectible = $collectibles[reset($collectible_hash_set)];
      $item = $items[$collectible['itemHash']];
      // echo_pretty_json($collectible, $item);

      if ($identical) {
        $headings[] = array(
          'collectible_hash' => $collectible['hash'],
          'name' => $collectible['displayProperties']['name'],
          'description' => $item['itemTypeDisplayName'],
          'scope' => $collectible['scope'], // should be 0
          'order' => ($next_default_order++),
        );
      } else if ($item['inventory']['tierTypeName'] === 'Exotic') {
        foreach ($collectible_hash_set as $key => $collectible_hash) {
          $collectible = $collectibles[$collectible_hash];
          $item = $items[$collectible['itemHash']];

          $headings[] = array(
            'collectible_hash' => $collectible['hash'],
            'name' => $collectible['displayProperties']['name'],
            'description' => 'Exotic ' . $class_names[$item['classType']] . ' ' . $item['itemTypeDisplayName'],
            'scope' => $collectible['scope'], // should be 1
            'order' => ($next_default_order++),
          );
        }
      } else {
        $item_names = array();
        foreach ($collectible_hash_set as $key => $collectible_hash) {
          $collectible = $collectibles[$collectible_hash];
          $item = $items[$collectible['itemHash']];
          $item_names[] = $collectible['displayProperties']['name'];
          // echo_pretty_json($collectible, $item);
        }
        $type = $item['itemTypeDisplayName'];
        if (in_array($type, array('Titan Mark', 'Hunter Cloak', 'Warlock Bond'))) {
          $type = 'Class Item';
        }
        $headings[] = array(
          'collectible_hash_set' => $collectible_hash_set,
          'name' => get_normalized_item_name($item),
          'description' => $type . ': ' . implode(', ', $item_names),
          'scope' => $collectible['scope'], // should be 1
          'order' => ($next_default_order++),
        );
      }
    }
  }

  usort($headings, 'column_sorter');
  // echo_pretty_json($headings);
  return $headings;
}
function get_normalized_item_name($item) {
  // DestinyClass
    // Titan: 0
    // Hunter: 1
    // Warlock: 2
    // Unknown: 3

  // Note: this won't necessarily convert all three related items to the same name. E.g. Temptation's Mark and Cloak of Temptation 

  if ($item['classType'] === 3) {
    return $item['displayProperties']['name'];
  }

  $replacements = array(
    0 => array( // Titan
      'Helmet' => array('Helm'),
      'Gauntlets' => array('Gauntlets'),
      'Chest Armor' => array('Plate'),
      'Leg Armor' => array('Greaves'),
      'Titan Mark' => array('Mark'), // Class Item
    ),
    1 => array( // Warlock
      'Helmet' => array('Cowl', 'Cover'),
      'Gauntlets' => array('Grips'),
      'Chest Armor' => array('Vest'),
      'Leg Armor' => array('Strides'),
      'Hunter Cloak' => array('Cloak'), // Class Item
    ),
    2 => array( // Hunter
      'Helmet' => array('Mask', 'Cowl', 'Hood', 'Cover', 'Crown', 'Helmet'),
      'Gauntlets' => array('Gloves', 'Wraps'),
      'Chest Armor' => array('Robes', 'Robe', 'Tabard'),
      'Leg Armor' => array('Boots', 'Legs'),
      'Warlock Bond' => array('Bond'), // Class Item
    ),
  );

  $name = $item['displayProperties']['name'];

  $replacement = $item['itemTypeDisplayName'];
  if (in_array($replacement, array('Titan Mark', 'Hunter Cloak', 'Warlock Bond'))) {
    $replacement = 'Class Item';
  }
  if ($replacement === 'Sword') {
    return $replacement;
  }

  $normalized = false;
  foreach ($replacements[$item['classType']][$item['itemTypeDisplayName']] as $search) {
    if (strpos($name, $search) !== false) {
      $name = str_replace($search, $replacement, $name);
      $normalized = true;
      break;
    }
  }
    
  if (!$normalized) {
    // Note: some of the older sets have completely different names for each class. Examples: crucible, forge
    // Exotics don't even remotely have a pattern
    
    // echo 'possible name issue: ';
    // echo implode(' | ', array(
    //   'name: ' . $item['displayProperties']['name'],
    //   'type: ' . $item['itemTypeDisplayName'],
    //   'classType: ' . $item['classType'],
    // ));
    // echo PHP_EOL;

    // echo_pretty_json($item);
    // throw new Exception('Could not normalize item name');
  }

  return $name;
}

function get_rows($page_key, $headings, $players) {
  $rows = array();

  $private_players = array();

  $pinned_profile_ids = array(
    // '5_4611686018500895898', // kalium
    // '2_4611686018449964451', // pirate
    // '5_4611686018501984731', // migs
    // '5_4611686018495301011', // cptylor
    // '2_4611686018434203724', // bundle
    // '5_4611686018495302579', // valent
    // '2_4611686018445720014', // vader
    // '3_4611686018490731084', // scorpin
    // '5_4611686018503337845', // gyrados
    // '3_4611686018498588294', // shy
    // '2_4611686018432856064', // drkraven
    // '1_4611686018448818630', // vault
    // '5_4611686018495369222', // arcanesage
    // '2_4611686018449964451', // blackflame
  );

  $skip_page_profile = get_setting('hide_page_profile');

  foreach ($players as $player) {
    $id = $player['destinyUserInfo']['membershipType'] . '_' . $player['destinyUserInfo']['membershipId'];

    if (!in_array($id, $pinned_profile_ids) && $pinned_profile_ids) { continue; }
    if (!empty($skip_page_profile[$page_key][$id])) { continue; }

    // if ($id !== '5_4611686018500895898') { continue; } // kalium
    // if ($id !== '5_4611686018503337845') { continue; } // gyrados
    // if ($id !== '2_4611686018449964451') { continue; } // pirate
    // echo_pretty_json($player); exit();

    $last_seen = $player['lastOnlineStatusChange'] ?? null;
    if (!empty($player['isOnline'])) {
      $last_seen = time(); // last seen now
    }
    $profile = profiles::get($player['destinyUserInfo']['membershipType'], $player['destinyUserInfo']['membershipId'], $last_seen);

    if (empty($profile['profileRecords']['data'])) {
      $private_players[$id] = profiles::normalize_name($profile['profile']['data']['userInfo']['displayName']);
      continue;
    }
    $player_data = array(
      'name' => profiles::get_display_name($profile),
      'id' => $id,
      'total_completion' => 0,
      'pinned' => in_array($id, $pinned_profile_ids),
      'records' => array(),
      'checklist_entries' => array(),
      'collectibles' => array(),
    );
    // $has_record_from_list = false;
    // echo_pretty_json($headings);
    foreach ($headings as $heading) {
      if ($heading['name'] === 'Player') {
        continue;
      }

      if (!empty($heading['record_hash'])) {
        update_player_data_for_record_heading($player_data, $profile, $heading);
      } else if (!empty($heading['checklist_hash'])) {
        update_player_data_for_checklist_heading($player_data, $profile, $heading);
      } else if (!empty($heading['collectible_hash']) || !empty($heading['collectible_hash_set'])) {
        update_player_data_for_collectible_heading($player_data, $profile, $heading);
      } else {
        echo_pretty_json($heading);
        throw new Exception('unhandled heading');
      }
      
    }
    // if (
    //   ($page['require_at_least_one_record_hash'] ?? []) &&
    //   !$has_record_from_list
    // ) {
    //   continue;
    // }
    $rows[] = $player_data;
    // echo_pretty_json($player_data);
  }

  $max_completion = count($headings) - 1; // ignore player column. Maybe should work differently, but this is ok for now.
  usort($rows, get_row_sorter($max_completion));

  // echo 'Private players:'; echo_pretty_json($private_players);

  return $rows;
}
function update_player_data_for_record_heading(&$player_data, $profile, $heading) {
  if ($heading['scope'] === 0) { // account scope
      $profile_record = $profile['profileRecords']['data']['records'][$heading['record_hash']];
      $player_data['records'][$heading['record_hash']] = $profile_record;
      $player_data['total_completion'] += estimate_player_record_progress($profile_record);
  } else if ($heading['scope'] === 1) { // character scope
    // Example: season of chosen battlegrounds has multiple objectives. progress is the same across characters, but state may differ. e.g. 4 vs 12
    //   Progress may be 0 instead of 1 for some completed objectives (Example: complete challenger's proving quest)
    // Example: season of chosen path of the chosen has one objective and progress differes between characters. state may differ. e.g. 7 vs 67

    $best_character_record = null;

    $all_character_records = array();
    foreach ($profile['characterRecords']['data'] as $character_hash => $character_records) {
      $all_character_records[] = $character_records['records'][$heading['record_hash']];
    }

    $identical = (count(array_unique(array_map('json_encode_character_record_reduced', $all_character_records))) === 1);
    if ($identical) {
      $best_character_record = $all_character_records[0]; // may get random state if obscured for only some characters
    } else {
      // could index by progress, ksort SORT_NUMERIC, take the best one. if there were duplicates, re-estimate by progress only, then by progress only with no cap per item
      // ideally could display all the values on hover [T: 1/1, W: 3/1, H: 0/1]. TODO when redesigning output. Make sure it stays yellow if all reqs not met on 1 character
      foreach ($all_character_records as $character_record) {
        if (!$best_character_record) {
          $best_character_record = $character_record;
          continue;
        }
        foreach ($character_record['objectives'] as $key => $objective) { // would be wonky if there is differing progress on multiple objectives
          if ($objective['progress'] > $best_character_record['objectives'][$key]['progress']) {
            $best_character_record = $character_record;
          }
        }
      }
      if (count($character_record['objectives']) > 1) {
        // echo_pretty_json($heading);
        // echo_pretty_json($all_character_records);
        // throw new Exception('multiple objectives on character records that aren\'t identical. This isn\'t handled yet');
      }
    }

    $player_data['records'][$heading['record_hash']] = $best_character_record;
    $player_data['total_completion'] += estimate_player_record_progress($best_character_record);
  } else {
    throw new Exception('scope ' . $heading['scope'] . ' not handled');
  }
}
function estimate_player_record_progress($record) {
  $progress = 0;
  $count = null;

  if (!empty($record['objectives'])) {
    $count = count($record['objectives']);
    foreach ($record['objectives'] as $objective) {
      if ($objective['progress'] === 0 && $objective['complete']) {
        // I don't know why progress is sometimes zero.
        // Example: season 13 guardian games, one fell strike. Some players have the a real value and others don't.
        //   D2checklist shows the correct value. reloading the data does not resolve
        $progress += 1;
      } else {
        $progress += min(1, $objective['progress'] / $objective['completionValue']); // assume no zeroes in denominator
      }
    }
  } else if (!empty($record['intervalObjectives'])) {
    $count = 1;
    $objective = end($record['intervalObjectives']);
    $progress += min(1, $objective['progress'] / $objective['completionValue']); // assume no zeroes in denominator
  } else if (isset($record['state'])) {
    // state is not normally on a record.
    // example: season 12 trials confidence is high.

    $count = 1;
    if (($record['state'] === 0) || ($record['state'] & 1)) { // complete or just not redeemed yet
      $progress = 1;
    } else {
      $progress = 0;
    }
  } else {
    echo_pretty_json($record);
    throw new Exception('No objectives found');
  }

  return $progress / $count;
}
function update_player_data_for_checklist_heading(&$player_data, $profile, $heading) {
  if ($heading['scope'] !== 0) {
    throw new Exception('scope ' . $heading['scope'] . ' not handled');
  }

  $collected = $profile['profileProgression']['data']['checklists'][$heading['checklist_hash']][$heading['checklist_entry_hash']];
  $player_data['checklist_entries'][$heading['checklist_entry_hash']] = $collected;
  $player_data['total_completion'] += (int) $collected;
}
function update_player_data_for_collectible_heading(&$player_data, $profile, $heading) {
  $state_text = array();
  $description = '';

  // use first character's info. Except for a few dozen exceptions, they have the same values. Mainly mida minitool, drang, and man o war.
  $character_collectibles = reset($profile['characterCollectibles']['data']);


  if (!empty($heading['collectible_hash'])) {
    $hash = $heading['collectible_hash'];

    if ($heading['scope'] === 0) {
      $state = $profile['profileCollectibles']['data']['collectibles'][$heading['collectible_hash']]['state'];
    } else {
      $character_collectibles = reset($profile['characterCollectibles']['data']);
      $state = $character_collectibles['collectibles'][$heading['collectible_hash']]['state'];
    }

    $state_text += array_filter(array(
      'complete' => !($state & 1),
      'incomplete' => $state & 1,
      'obscured' => $state & 2,
      'invisible' => $state & 4,
    ));
  } else {
    $hash = implode(',', array_values($heading['collectible_hash_set']));
    $states = array();

    foreach ($heading['collectible_hash_set'] as $key => $collectible_hash) {
      if (empty($character_collectibles['collectibles'][$collectible_hash])) {
        // rare. applies to some trials gear like the helmet
        $character_state = $profile['profileCollectibles']['data']['collectibles'][$collectible_hash]['state'];
      } else {
        $character_state = $character_collectibles['collectibles'][$collectible_hash]['state'];
      }
      $states[$key] = $character_state;

      $state_text += array_filter(array(
        'complete' => !($character_state & 1),
        'incomplete' => $character_state & 1,
        'obscured' => $character_state & 2,
        'invisible' => $character_state & 4,
      ));

      if (!($character_state & 1)) {
        $description .= substr($key, 0, 1);
      } else {
        $description .= '&nbsp;';
      }
    }

    // if any one is complete, ignore the other details
    if (!empty($state_text['complete'])) {
      unset($state_text['incomplete']);
      unset($state_text['obscured']);
      unset($state_text['invisible']);
    }
  }

  $player_data['collectibles'][$hash] = array(
    'state' => $state ?? $states,
    'description' => $description,
    'state_text' => implode(' ', array_keys($state_text)),
  );
  $player_data['total_completion'] += (empty($state_text['complete']) ? 0 : 1);
}


function get_player_objective_state($record, $key) {
  // Combines objective progress with overall record state

  if ($record['state'] === 0) {
    // not yet redeemed.
    // this also works for interval objectives (e.g. guardian games bronze medals 681149483)
    return '';
  }

  $objective = $record['objectives'][$key] ?? $record['intervalObjectives'][$key];
  if (
    !empty($record['intervalObjectives']) &&
    !$objective['complete'] &&
    $objective['progress']
  ) {
    // sometimes a particular record with one interval complete will return state 7 instead of state 6 for all such players
    // example: EDZ lost sectors
    return 'incomplete progress';
  }

  $complete = ($record['state'] & 1) || $objective['complete'];

  $enums = array(
    'complete' => $complete, // this state technically means "redeemed"
    // 'reward' => ($record['state'] & 2) && !$complete,
    'incomplete' => ($record['state'] & 4) && (!$objective['complete']),
    'obscured' => ($record['state'] & 8) && !$complete,
    'hidden' => ($record['state'] & 16) && !$complete,
    'unowned' => $record['state'] & 32,
    // 'title' => $record['state'] & 64,
    'progress' => !$complete && ($objective['progress'] > 0),
  );

  return implode(' ', array_keys(array_filter($enums)));
}

function get_row_sorter($max_completion) {
    return function ($a, $b) use ($max_completion) {
        // return value is cast to int, so returning a float less than 1 may cause incorrect sort order.
        if ($a['pinned'] && !$b['pinned']) {
          return -1;
        }
        if (!$a['pinned'] && $b['pinned']) {
          return 1;
        }
        if ($a['total_completion'] === $b['total_completion']) {
          return 0;
        }
        if ($a['total_completion'] === $max_completion) {
          return 1;
        }
        if ($b['total_completion'] === $max_completion) {
          return -1;
        }
        if ($a['total_completion'] > $b['total_completion']) {
          return -1;
        }
        return 1;
    };
}

function column_sorter($a, $b) {
  // This is not a stable sort. Provide default values to columns to guarantee an order.

  // order
  $ao = $a['order'] ?? null;
  $bo = $b['order'] ?? null;

  // group
  // 0 player name, 1 positive, 2 null/unsorted, 3 negative
  $ag = $ao === 0 ? 0 : ($ao > 0 ? 1 : ($ao === null ? 2 : 3));
  $bg = $bo === 0 ? 0 : ($bo > 0 ? 1 : ($bo === null ? 2 : 3));

  if ($ag !== $bg) {
    return $ag - $bg;
  }
  return $ao - $bo;
}

function json_encode_character_record_reduced($character_record) {
  $character_record['state'] &= 5; // ignore obscured/etc
  return json_encode($character_record);
}



















