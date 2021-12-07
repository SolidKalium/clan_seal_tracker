<?php

include 'include.php';

enable_implicit_flush(); // doesn't work with <link> css
echo '<style> ' . file_get_contents('resources/tracker.css') . ' </style>';
echo '<script> ' . file_get_contents('resources/tracker.js') . ' </script>';
echo '<link rel="shortcut icon" href="resources/favicon_16.png" type="image/x-icon">';
echo '<pre>';

definitions::update();
route();

// TODO list
  // support weekly milestones. three rows, one per character. two heading levels for raid phases
  // use a generic table display function so there's less of an arbitrary intermediate format that gets interpreted into html?
  // improve heading fetching. recursively handle nodes.
  // optionally suppress headings only if no one has it complete (or no progress)? records[].only_display_if => progress / complete
  //   Option to make heading not count toward progress?
  //   Store progress per cell, then sum at the end
  // use icons for gear classes acquired?
  // indicate somewhere that a triumph is per character instead of per account?
  // the names/descriptions/etc from Bungie may need to be html escaped in some places before displaying them. no known issues right now. use a linter or handle with the generic html table function.
  // database instead of filesystem?
  // improve style on main page. Header. Improve flow of chunks.
  // Use jquery?
  // gracefully handle api auth errors, other errors
  // use a data structure for membership ids? type can be optional but generally required. pickle/unpickle functions

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
    $start_time = microtime(true);

    show_page($_GET['page'], $_GET['type'] ?? null);

    $runtime = microtime(true) - $start_time;
    // echo "page load time: " . number_format($runtime, 3) . " seconds";
    return;
  }

  list_pages();
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
  $players = groups::get_group_members(get_setting("group_id"));
  profiles::precache_players($players);

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

  $progress_override = null;
  $override_profile_triumph_progress = get_setting('override_profile_triumph_progress');
  if (isset($override_profile_triumph_progress[$player_data['id']][$heading['record_hash']])) {
    $progress_override = $override_profile_triumph_progress[$player_data['id']][$heading['record_hash']];
  }

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

      $progress = $progress_override ?? $player_objective['progress'];
      $raw_progress = $progress;
      if ($progress === 0 || $progress === $objective['completionValue']) {
        $progress = '';
      }
      $recordState = get_player_objective_state($player_record, $key);

      $html .= "<td recordState='$recordState' title='$raw_progress/{$objective['completionValue']}' class='$class'>$progress</td>";
    }
    return $html;
  }

  if (!empty($heading['interval_objectives'])) {
    $key = count($heading['interval_objectives']) - 1; // assume last one is the highest. They should all have progress up to their cap
    $player_objective = $player_record['intervalObjectives'][$key];
    $progress = $progress_override ?? $player_objective['progress'];
    $raw_progress = $progress;
    if ($progress === 0 || $progress === $player_objective['completionValue']) {
      $progress = '';
    }
    $recordState = get_player_objective_state($player_record, $key);
    return "<td recordState='$recordState' title='$raw_progress/{$player_objective['completionValue']}'>$progress</td>";
  }

  if (count($player_record) === 2 && !array_diff(array_keys($player_record), array('state', 'intervalsRedeemedCount'))) {
    // certain unearnable triumphs only have state and intervalsRedeemedCount
    // I haven't seen the state be zero, and it probably isn't possible to leave it unredeemed over seasons
    $recordState = (($player_record['state'] === 0) || ($player_record['state'] & 1)) ? 'complete' : 'incomplete';
    return "<td recordState='$recordState'></td>";
  }

  if ($heading['name'] === 'Classified') {
    // classified triumphs may be missing objectives, but still have them present on the player
    // these can't be faked properly, so this condition can't rely on a non-empty objective list on the $player_record
    $recordState = (($player_record['state'] === 0) || ($player_record['state'] & 1)) ? 'complete' : 'incomplete';
    return "<td recordState='$recordState'></td>";
  }

  echo_pretty_json($heading);
  echo_pretty_json($player_record);
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

      $objective_text = '';
      $intervals_text = '';
      $score = $record['completionInfo']['ScoreValue'] ?? 0;
      $heading_objectives = array();
      $heading_interval_objectives = array();
      if (!empty($record['objectiveHashes'])) {
        foreach ($record['objectiveHashes'] as $hash) {
          $objective = $objectives[$hash]; // completion value, progress description
          $heading_objectives[] = array(
            'hash' => $hash,
            'name' => $objective['progressDescription'],
            'completionValue' => $objective['completionValue'],
            // valueStyle uses enum DestinyUnlockValueUIStyle. how to properly display progress as a number/checkbox/etc
          );
        }
        if (count($record['objectiveHashes']) == 1) {
          $objective_text = $objective['progressDescription'] ?: $objective['displayProperties']['description']; // second one is sometimes empty
        }
      }
      if (!empty($record['intervalInfo']['intervalObjectives'])) {
        foreach ($record['intervalInfo']['intervalObjectives'] as $interval_objective) {
          // $interval_objective is just intervalValueScore and hash
          $objective = $objectives[$interval_objective['intervalObjectiveHash']];
          $heading_interval_objectives[] = array(
            'hash' => $objective['hash'],
            'name' => $objective['progressDescription'],
            'completionValue' => $objective['completionValue'],
          );
          $score += $interval_objective['intervalScoreValue'];
          $intervals_text .= "\nInterval requirement: " . $objective['completionValue'] . ' (Score: ' . $interval_objective['intervalScoreValue'] . ')';
        }
      }

      $headings[$record['hash']] = array(
        'record_hash' => $record['hash'],
        'name' => $record['displayProperties']['name'],
        'description' => $record['displayProperties']['description'] .
          ($objective_text ? "\nObjective: " . $objective_text : '') .
          ($score ? "\nScore: " . $score : '') .
          ($intervals_text) .
          (!empty($record['expirationInfo']['description']) ? "\n" . $record['expirationInfo']['description'] : '') .
          (!empty($record['requirements']['entitlementUnavailableMessage']) ? "\n" . $record['requirements']['entitlementUnavailableMessage'] : ''),
        'icon' => $record['displayProperties']['icon'],
        'objectives' => $heading_objectives,
        'interval_objectives' => $heading_interval_objectives,
        'scope' => $record['scope'], // 0 account, 1 character
        'for_gilding' => $record['forTitleGilding'],
        'order' => $page['records'][$record['hash']]['order'] ?? ($next_default_order++),
        // not handling rewards and interval rewards
        // not handling ScoreValue and intervalScoreValues
        // not handling featuredPriority. Usually min or max int, but sometimes something like 91000
      ) + ($page['records'][$record['hash']] ?? array());;
    }
  }
  if (array_filter($collectible_hash_lists)) {
    // Unlike badges, these don't get merged
    $collectibles = definitions::get('Collectible');
    $items = definitions::get('InventoryItemLite');
    $perks = definitions::get('SandboxPerk');

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

        $description = $item['itemTypeDisplayName'];
        foreach ($item['perks'] as $perk_info) {
          $perk = $perks[$perk_info['perkHash']];
          if (!$perk['isDisplayable']) { // example: second perk on fusion rifle ammo finder (collectible 4017415783)
            continue;
          }
          if (empty($perk['displayProperties']['description'])) {
            echo_pretty_json($item);
            echo_pretty_json($perk);
          }
          $description .= "\nPerk: " . $perk['displayProperties']['description'];
        }
        if ($collectible['sourceString']) {
          $description .= "\n" . $collectible['sourceString'];
        }

        $headings[] = array(
          'collectible_hash' => $collectible['hash'],
          'name' => $collectible['displayProperties']['name'],
          'description' => $description,
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
        foreach ($collectible_hash_set as $class => $collectible_hash) {
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
        $item_names = '';
        foreach ($collectible_hash_set as $class => $collectible_hash) {
          $collectible = $collectibles[$collectible_hash];
          $item = $items[$collectible['itemHash']];
          $item_names .= "\n" . $class . ': ' . $collectible['displayProperties']['name'];
          // echo_pretty_json($collectible, $item);
        }
        $type = $item['itemTypeDisplayName'];
        if (in_array($type, array('Titan Mark', 'Hunter Cloak', 'Warlock Bond'))) {
          $type = 'Class Item';
        }
        $headings[] = array(
          'collectible_hash_set' => $collectible_hash_set,
          'name' => get_normalized_item_name($item),
          'description' => $type . $item_names,
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
    // '5_4611686018504639662', // l0cutus
    // '1_4611686018440477513', // bigred
    // '3_4611686018485645582', // alrt
    // '5_4611686018504988724', // tr1dent
    // '5_4611686018502793980', // iamatmo
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
      $profile_record = $profile['profileRecords']['data']['records'][$heading['record_hash']] ?? fake_empty_record_for_heading($heading);
      $player_data['records'][$heading['record_hash']] = $profile_record;
      $player_data['total_completion'] += estimate_player_record_progress($profile_record);
  } else if ($heading['scope'] === 1) { // character scope
    // Example: season of chosen battlegrounds has multiple objectives. progress is the same across characters, but state may differ. e.g. 4 vs 12
    //   Progress may be 0 instead of 1 for some completed objectives (Example: complete challenger's proving quest)
    // Example: season of chosen path of the chosen has one objective and progress differes between characters. state may differ. e.g. 7 vs 67

    $best_character_record = null;

    $all_character_records = array();
    foreach ($profile['characterRecords']['data'] as $character_hash => $character_records) {
      $all_character_records[] = $character_records['records'][$heading['record_hash']] ?? fake_empty_record_for_heading($heading);
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
function fake_empty_record_for_heading($heading) {
  // works for both profile and character records

  $record = array(
    'state' => 12, // incomplete and obscured
    'intervalObjectives' => $heading['interval_objectives'] ?? array(),
    'objectives' => $heading['objectives'] ?? array(),
    'intervalsRedeemedCount' => 0,
  );

  foreach (array('intervalObjectives', 'objectives') as $objectives_type) {
    foreach ($record[$objectives_type] as $i => $objective) {
      $record[$objectives_type][$i] += array(
        'objectiveHash' => $objective['hash'],
        'progress' => 0,
        // completionValue
        'complete' => false,
        'visible' => true,
      );
    }
  }

  return $record;
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
        $progress += min(1, $objective['progress'] / max(1, $objective['completionValue']));
      }
    }
  } else if (!empty($record['intervalObjectives'])) {
    $count = 1;
    $objective = end($record['intervalObjectives']);
    $progress += min(1, $objective['progress'] / max(1, $objective['completionValue']));
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
      $state = $profile['profileCollectibles']['data']['collectibles'][$heading['collectible_hash']]['state'] ?? 3;
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



















