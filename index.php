<?php

include 'include.php';

enable_implicit_flush(); // doesn't work with <link> css
echo '<style> ' . file_get_contents('resources/tracker.css') . ' </style>';
echo '<script> ' . file_get_contents('resources/tracker.js') . ' </script>';
echo '<link rel="shortcut icon" href="resources/favicon_16.png" type="image/x-icon">';
echo '<pre>';


route();

// TODO list
  // support non-seal pages (all raid triumphs, gear, checklists, catalysts, challenges, weekly milestones?)
  // highlight column on hover? (without bumping elements around. needs js)
  // fix gap in sticky header?
  // show other details when clicking a column header or a cell? or on hover? (interval objectives, rewards, score, etc)
  // add sort capability on columns? (for sorting columns after load)
  // put clan name and icon somewhere? Show seal icon if relevant?
  // distinguish groups of columns?
  // make a page that can select users?
  // column order (before load)
  // when to update definitions from manifest?
  // how to tell which season a gilding triumph is for? I don't think this is in the api yet


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
      'other_nodes' => array(1525933460),
      'records' => array(
         2756328801 => array('column_name' => 'Badge', 'order' => 1),
         3448775736 => array('column_name' => 'Raid', 'order' => 2),
         4078980921 => array('column_name' => 'Clan', 'order' => 3),
         3000516033 => array('column_name' => 'Arc', 'number_objectives' => true, 'order' => 4),
         623283604  => array('column_name' => 'Solar', 'number_objectives' => true, 'order' => 5),
         2826160801 => array('column_name' => 'Void', 'number_objectives' => true, 'order' => 6),
         342038729  => array('column_name' => 'Class', 'number_objectives' => true, 'order' => 7),
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
      'other_nodes' => array(615240848),
      'records' => array(
        3866024089 => array('column_name' => 'Badge',),
        3804486505 => array('column_name' => 'Raid',),
        1221037312 => array('column_name' => 'Clan',),
        3427328428 => array('column_name' => 'Arc', 'number_objectives' => true),
        277137394  => array('column_name' => 'Void', 'number_objectives' => true),
        2571794337 => array('column_name' => 'Solar', 'number_objectives' => true),
         // => array('column_name' => 'Stasis', 'number_objectives' => true),
         // => array('column_name' => 'Class', 'number_objectives' => true),
        1922270325 => array('column_name' => 'Chests',),
        521675034  => array('column_name' => 'Divinity',),
      ),
    ),
    'dsc' => array(
      'name' => 'Deep Stone Crypt',
      'category' => 'Seals',
      'subcategory' => 'Raid',
      'seal_node_hash' => 2960810718,
      'other_nodes' => array(1726708384),
      'records' => array(
        3504856768 => array('column_name' => 'Badge',),
        3185876102 => array('column_name' => 'Raid',),
        518342793  => array('column_name' => 'Clan',),
        564366615  => array('column_name' => 'Class', 'number_objectives' => true),
        3834307795 => array('column_name' => 'Arc', 'number_objectives' => true),
        3200831458 => array('column_name' => 'Solar', 'number_objectives' => true),
        513707022  => array('column_name' => 'Stasis', 'number_objectives' => true),
        3875695735 => array('column_name' => 'Void', 'number_objectives' => true),
        992355976  => array('column_name' => 'Chests', 'number_objectives' => true),
        3323713181 => array('column_name' => 'Exo Logs', 'number_objectives' => true),
      ),
    ),
    'vog' => array(
      'name' => 'Vault of Glass',
      'category' => 'Seals',
      'subcategory' => 'Raid',
      'disable_reason' => 'not yet available',
    ),
    'crucible' => array(
      'name' => 'Crucible',
      'category' => 'Seals',
      'subcategory' => 'Activity',
      'seal_node_hash' => 2107507397,
      'other_nodes' => array(),
      'records' => array(

      ),
    ),
    'gambit' => array(
      'name' => 'Gambit',
      'category' => 'Seals',
      'subcategory' => 'Activity',
      'seal_node_hash' => 3665267419,
      'other_nodes' => array(),
      'records' => array(

      ),
    ),
    'trials' => array(
      'name' => 'Trials of Osiris',
      'category' => 'Seals',
      'subcategory' => 'Activity',
      'seal_node_hash' => 1733555826,
      'other_nodes' => array(),
      'records' => array(

      ),
    ),
    'strikes' => array(
      'name' => 'Strikes',
      'category' => 'Seals',
      'subcategory' => 'Activity',
      'seal_node_hash' => 3776992251,
      'other_nodes' => array(),
      'records' => array(

      ),
    ),
    'shadowkeep' => array(
      'name' => 'Shadowkeep',
      'category' => 'Seals',
      'subcategory' => 'Seasonal',
      'seal_node_hash' => 379405979,
      'other_nodes' => array(),
      'records' => array(

      ),
    ),
    'beyond_light' => array(
      'name' => 'Beyond Light',
      'category' => 'Seals',
      'subcategory' => 'Seasonal',
      'seal_node_hash' => 79180995,
      'other_nodes' => array(),
      'records' => array(

      ),
    ),
    'season_12' => array(
      'name' => 'Season of the Hunt',
      'category' => 'Seals',
      'subcategory' => 'Seasonal',
      'seal_node_hash' => 1321008463,
      'other_nodes' => array(),
      'records' => array(

      ),
    ),
    'season_13' => array(
      'name' => 'Season of the Chosen',
      'category' => 'Seals',
      'subcategory' => 'Seasonal',
      'seal_node_hash' => 1321008462,
      'other_nodes' => array(),
      'records' => array(

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
      'other_nodes' => array(),
      'records' => array(

      ),
    ),
    'corrupted_eggs' => array(
      'name' => 'Corrupted Eggs',
      'category' => 'Checklists',
      'subcategory' => null,
      'other_nodes' => array(),
      'records' => array(

      ),
      'disable_reason' => 'in development',
    ),
    'ahamkara_bones' => array(
      'name' => 'Ahamkara Bones',
      'category' => 'Checklists',
      'subcategory' => null,
      'other_nodes' => array(),
      'records' => array(

      ),
      'disable_reason' => 'in development',
    ),
    'glykon_clues' => array(
      'name' => 'Glykon Clues',
      'category' => 'Checklists',
      'subcategory' => null,
      'other_nodes' => array(),
      'records' => array(

      ),
      'disable_reason' => 'in development',
    ),
    'milestones' => array(
      'name' => 'Milestones',
      'category' => 'Other',
      'subcategory' => null,
      'other_nodes' => array(),
      'records' => array(

      ),
      'disable_reason' => 'in development',
    ),
    'catalysts' => array(
      'name' => 'Catalysts',
      'category' => 'Other',
      'subcategory' => null,
      'other_nodes' => array(),
      'records' => array(

      ),
      'disable_reason' => 'in development',
    ),
    'seasonal_challenges' => array(
      'name' => 'Seasonal Challenges',
      'category' => 'Other',
      'subcategory' => null,
      'other_nodes' => array(),
      'records' => array(

      ),
      'disable_reason' => 'in development',
    ),
  );

  // if a record is in the records list, it should be displayed even if not part of a relevant node.
  // if a record is suppressed, don't show it

  return $pages;
}

function list_pages() {
  // NOTE: could use more div containers for styling.
  // TODO also have links for raid gear / collections, have maps for the encounter it drops from?

  echo "<title>D2 Clan Seal Tracker</title>";

  $pages = get_page_definitions();
  $nodes = definitions::get('PresentationNode');
  $records = definitions::get('Record');
  // echo_pretty_json($nodes);

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
        // TODO handle non-seals
        $disabled = !empty($page['disable_reason']);
        if ($disabled) {
          echo "<li disabled=1>{$page['name']} ({$page['disable_reason']})</li>";
        } else {
          $seal_text = '';
          if (!empty($page['seal_node_hash'])) {
            $seal_node = $nodes[$page['seal_node_hash']];
            $seal_record = $records[$seal_node['completionRecordHash']];
            $seal_text = ' (<a href="?page=' . $page['key'] . '&type=seal">' . reset($seal_record['titleInfo']['titlesByGender']) . '</a>)';
          }
          echo "<li><a href='?page={$page['key']}'>{$page['name']}</a>$seal_text</li>";
        }
      }
      echo '</ul>';
    }
  }
  

  // $root_seal_node = $nodes['616318467'];
  // // echo_pretty_json($root_seal_node);
  // foreach ($root_seal_node['children']['presentationNodes'] as $node) {
  //   $seal_node = $nodes[$node['presentationNodeHash']];
  //   $seal_record = $records[$seal_node['completionRecordHash']];
  //   echo 'node ' . $seal_node['hash'] . ' record ' . $seal_record['hash'] . ' ' . $seal_node['displayProperties']['name'] . ' ' . reset($seal_record['titleInfo']['titlesByGender']) . PHP_EOL;
  //   // echo_pretty_json($node);
  // }
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

  echo "<title>{$page['name']}</title>";
  echo "<h1>{$page['name']}</h1>";


  $players = profiles::get_cached_players(); // TODO flag for using cache vs current roster
  // $players = bungie_api::get_group_members(4331943); // Anomaly

  $headings = get_headings($page);
  $rows = get_rows($headings, $players);

  
  $th1 = '';
  $th2 = '';
  foreach ($headings as $heading) {
    $column_name = $heading['column_name'] ?? $heading['name'];

    $heading_attributes = "title='{$heading['description']}'";
    if (!empty($heading['for_gilding'])) {
      $heading_attributes .= ' gild';
    }
    if (!empty($heading['record_hash'])) {
      $heading_attributes .= " record_hash='{$heading['record_hash']}'";
    }

    if (empty($heading['objectives']) || count($heading['objectives']) === 1) {
      $th1 .= "<th rowspan='2' $heading_attributes>{$column_name}</th>";
    } else {
      $count = count($heading['objectives']);
      $th1 .= "<th colspan='$count' $heading_attributes}'>{$column_name}</th>";
      foreach ($heading['objectives'] as $key => $objective) {
        $subcolumn_name = !empty($heading['number_objectives']) ? $key + 1 : $objective['name'];
        $th2 .= "<th objective_hash='$key'>$subcolumn_name</th>";
      }
    }
  }

  $table = "<table><thead><tr class='first'>$th1</tr><tr class='second'>$th2</tr></thead><tbody>";


  foreach ($rows as $player_data) {
    $table .= "<tr id='{$player_data['id']}'>";
    foreach ($headings as $heading) {
      if ($heading['name'] === 'Player') {
        if (profiles::is_stadia($player_data['name'])) {
          $name = explode('#', $player_data['name']);
          $table .= "<td>{$name[0]}<span class=name-number>#{$name[1]}</span></td>";
        } else {
          $table .= "<td>{$player_data['name']}</td>";
        }
        continue;
      }

      $player_record = $player_data['records'][$heading['record_hash']];
      if (!empty($heading['objectives'])) {
        foreach ($heading['objectives'] as $key => $objective) {
          $player_objective = $player_record['objectives'][$key];
          if ($player_objective['objectiveHash'] !== $objective['hash']) { // ensure the order is constant
            throw new Exception("hashes don't match. {$player_objective['objectiveHash']} !== {$objective['hash']}");
          }
          $progress = $player_objective['progress'];
          if ($progress === 0 || $progress === $objective['completionValue']) {
            $progress = '';
          }
          $recordState = get_player_objective_state($player_record, $key);
          $table .= "<td recordState='$recordState' title='{$player_objective['progress']}/{$objective['completionValue']}'>$progress</td>";
        }
      } else if (!empty($heading['interval_objectives'])) {
        $key = count($heading['interval_objectives']) - 1; // assume last one is the highest. They should all have progress up to their cap
        $player_objective = $player_record['intervalObjectives'][$key];
        $progress = $player_objective['progress'];
        if ($progress === 0 || $progress === $player_objective['completionValue']) {
          $progress = '';
        }
        $recordState = get_player_objective_state($player_record, $key);
        $table .= "<td recordState='$recordState' title='{$player_objective['progress']}/{$player_objective['completionValue']}'>$progress</td>";
      }

    }
    $table .= "</tr>"; //break;
  }

  $table .= '</tbody></table>';
  echo $table;
}

function get_headings($page) {
  $nodes = definitions::get('PresentationNode');
  $records = definitions::get('Record');
  $objectives = definitions::get('Objective');

  $seal_node = $nodes[$page['seal_node_hash']];
  $seal_record = $records[$seal_node['completionRecordHash']]; // has title. ignore objective

  // echo_pretty_json($seal_node);
  // echo_pretty_json($seal_record);

  $headings[] = array(
    'name' => 'Player',
    'description' => 'Name in Destiny',
    'order' => 0,
  );

  $add_index = 0;

  foreach ($seal_node['children']['records'] as $record_skeleton) {
    $record = $records[$record_skeleton['recordHash']];
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
      'order' => $page['records'][$record['hash']]['order'] ?? (100 + $add_index++),
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

    $headings[] = $heading;
  }

  usort($headings, 'column_sorter');
  // echo_pretty_json($headings);
  return $headings;
}
function get_rows($headings, $players) {
  $rows = array();

  foreach ($players as $player) {
    $profile = profiles::get($player['destinyUserInfo']['membershipType'], $player['destinyUserInfo']['membershipId']);
    if (empty($profile['profileRecords']['data'])) {
      // echo profiles::normalize_name($profile['profile']['data']['userInfo']['displayName']) . ' is hidding' . PHP_EOL;
      continue;
    }
    $player_data = array(
      'name' => profiles::get_display_name($profile),
      'id' => $player['destinyUserInfo']['membershipType'] . '_' . $player['destinyUserInfo']['membershipId'],
      'total_completion' => 0,
      'records' => array(),
    );
    foreach ($headings as $heading) {
      if ($heading['name'] === 'Player') {
        continue;
      }

      if ($heading['scope'] === 0) { // account scope
        $profile_record = $profile['profileRecords']['data']['records'][$heading['record_hash']];
        $player_data['records'][$heading['record_hash']] = $profile_record;
        $player_data['total_completion'] += estimate_player_record_progress($profile_record);
      } else if ($heading['scope'] === 1) { // character scope
        // Example: season of chosen battlegrounds has multiple objectives. progress is the same across characters, but state may differ. e.g. 4 vs 12
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
            echo_pretty_json($heading);
            echo_pretty_json($all_character_records);
            throw new Exception('multiple objectives on character records that aren\'t identical. This isn\'t handled yet');
          }
        }
          
        $player_data['records'][$heading['record_hash']] = $best_character_record;
        $player_data['total_completion'] += estimate_player_record_progress($best_character_record);
      } else {
        throw new Exception('scope ' . $heading['scope'] . ' not handled');
      }
    }
    $rows[] = $player_data;
  }

  $max_completion = count($headings) - 1; // ignore player column. Maybe should work differently, but this is ok for now.
  usort($rows, get_row_sorter($max_completion));

  return $rows;
}

function estimate_player_record_progress($record) {
  $progress = 0;
  $count = null;

  if (!empty($record['objectives'])) {
    $count = count($record['objectives']);
    foreach ($record['objectives'] as $objective) {
      $progress += min(1, $objective['progress'] / $objective['completionValue']); // assume no zeroes in denominator
    }
  } else if (!empty($record['intervalObjectives'])) {
    $count = 1;
    $objective = end($record['intervalObjectives']);
    $progress += min(1, $objective['progress'] / $objective['completionValue']); // assume no zeroes in denominator
  } else {
    echo_pretty_json($record);
    throw new Exception('No objectives found');
  }

  return $progress / $count;
}

function get_player_objective_state($record, $key) {
  // Combines objective progress with overall record state

  if ($record['state'] === 0) {
    return ''; // not yet redeemed
  }

  $objective = $record['objectives'][$key] ?? $record['intervalObjectives'][$key];

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



















