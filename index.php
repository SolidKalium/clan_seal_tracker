<?php

include 'include.php';

enable_implicit_flush(); // doesn't work with <link>
echo '<style> ' . file_get_contents('tracker.css') . ' </style>';
echo '<pre>';


route();


// $manifest = bungie_api::get_manifest();
// echo_pretty_json($manifest);
// $members = bungie_api::get_group_members(4331943); // Anomaly
// echo_pretty_json($members);
// // $member = end($members);
// // echo_pretty_json($member);
// // $profile = bungie_api::get_profile($member['destinyUserInfo']['membershipType'], $member['destinyUserInfo']['membershipId']);
// // $profile = profiles::get($member['destinyUserInfo']['membershipType'], $member['destinyUserInfo']['membershipId']);
// // echo_pretty_json($profile);
// foreach ($members as $member) {
//   echo 'fetch ' . profiles::normalize_name($member['destinyUserInfo']['displayName']) . PHP_EOL;
//   $profile = profiles::get($member['destinyUserInfo']['membershipType'], $member['destinyUserInfo']['membershipId']);
//   if (count($profile['profileRecords']) === 1) {
//     echo '  high privacy' . PHP_EOL;
//   }
// }


function route() {
  if (isset($_GET['page'])) {
    show_page($_GET['page'], $_GET['type'] ?? null);
    return;
  }

  list_pages();
}


function get_page_definitions() {
  $pages = array(
    array(
      'name' => 'Last Wish',
      'category' => 'Seals',
      'subcategory' => 'Raid',
      'seal_node_hash' => 1486062207,
      'other_nodes' => array(1525933460),
      'records' => array(
         2756328801 => array('column_name' => 'Badge',),
         3000516033 => array('column_name' => 'Arc', 'number_objectives' => true),
         4078980921 => array('column_name' => 'Clan',),
         342038729  => array('column_name' => 'Class', 'number_objectives' => true),
         3448775736 => array('column_name' => 'Raid',),
         623283604  => array('column_name' => 'Solar', 'number_objectives' => true),
         2826160801 => array('column_name' => 'Void', 'number_objectives' => true),
         717856991  => array('column_name' => 'Wishes',),
         1359055399 => array('column_name' => 'Raid banners',),
         628370196  => array('column_name' => 'Chests',),
      ),
    ),
    array(
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
    array(
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
    array(
      'name' => 'Vault of Glass',
      'category' => 'Seals',
      'subcategory' => 'Raid',
      'disable_reason' => 'not yet available',
    ),
    array(
      'name' => 'Crucible',
      'category' => 'Seals',
      'subcategory' => 'Activity',
      'seal_node_hash' => 2107507397,
      'other_nodes' => array(),
      'records' => array(

      ),
    ),
    array(
      'name' => 'Gambit',
      'category' => 'Seals',
      'subcategory' => 'Activity',
      'seal_node_hash' => 3665267419,
      'other_nodes' => array(),
      'records' => array(

      ),
    ),
    array(
      'name' => 'Trials of Osiris',
      'category' => 'Seals',
      'subcategory' => 'Activity',
      'seal_node_hash' => 1733555826,
      'other_nodes' => array(),
      'records' => array(

      ),
    ),
    array(
      'name' => 'Strikes',
      'category' => 'Seals',
      'subcategory' => 'Activity',
      'seal_node_hash' => 3776992251,
      'other_nodes' => array(),
      'records' => array(

      ),
    ),
    array(
      'name' => 'Shadowkeep',
      'category' => 'Seals',
      'subcategory' => 'Seasonal',
      'seal_node_hash' => 379405979,
      'other_nodes' => array(),
      'records' => array(

      ),
    ),
    array(
      'name' => 'Beyond Light',
      'category' => 'Seals',
      'subcategory' => 'Seasonal',
      'seal_node_hash' => 79180995,
      'other_nodes' => array(),
      'records' => array(

      ),
    ),
    array(
      'name' => 'Season of the Hunt',
      'category' => 'Seals',
      'subcategory' => 'Seasonal',
      'seal_node_hash' => 1321008463,
      'other_nodes' => array(),
      'records' => array(

      ),
    ),
    array(
      'name' => 'Season of the Chosen',
      'category' => 'Seals',
      'subcategory' => 'Seasonal',
      'seal_node_hash' => 1321008462,
      'other_nodes' => array(),
      'records' => array(

      ),
    ),
    array(
      'name' => 'MMXI',
      'category' => 'Seals',
      'subcategory' => 'Seasonal',
      'disable_reason' => 'not yet available',
    ),
    array(
      'name' => 'Dreaming City',
      'category' => 'Seals',
      'subcategory' => 'Destination',
      'seal_node_hash' => 560097044,
      'other_nodes' => array(),
      'records' => array(

      ),
    ),
    array(
      'name' => 'Corrupted Eggs',
      'category' => 'Checklists',
      'subcategory' => null,
      'other_nodes' => array(),
      'records' => array(

      ),
    ),
    array(
      'name' => 'Ahamkara Bones',
      'category' => 'Checklists',
      'subcategory' => null,
      'other_nodes' => array(),
      'records' => array(

      ),
    ),
    array(
      'name' => 'Glykon Clues',
      'category' => 'Checklists',
      'subcategory' => null,
      'other_nodes' => array(),
      'records' => array(

      ),
    ),
    array(
      'name' => 'Catalysts',
      'category' => 'Other',
      'subcategory' => null,
      'other_nodes' => array(),
      'records' => array(

      ),
    ),
    array(
      'name' => 'Seasonal Challenges',
      'category' => 'Other',
      'subcategory' => null,
      'other_nodes' => array(),
      'records' => array(

      ),
    ),
  );

  // if a record is in the records list, it should be displayed even if not part of a relevant node.
  // if a record is suppressed, don't show it

  return $pages;
}

function list_pages() {
  // NOTE: could use more div containers for styling.
  // TODO also have links for raid gear / collections, have maps for the encounter it drops from?

  $pages = get_page_definitions();
  $nodes = definitions::get('PresentationNode');
  $records = definitions::get('Record');
  // echo_pretty_json($nodes);

  $page_index = array();
  foreach ($pages as $page) {
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
            $seal_text = ' (<a href="?page=' . $page['name'] . '&type=seal">' . reset($seal_record['titleInfo']['titlesByGender']) . '</a>)';
          }
          echo "<li><a href='?page={$page['name']}'>{$page['name']}</a>$seal_text</li>";
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
function show_page($page_name, $type = null) {
  echo "<h1>$page_name</h1>";

  $pages = get_page_definitions();
  foreach ($pages as $page) {
    if ($page_name === $page['name']) {
      break;
    }
  }

  if (empty($page) || $page_name !== $page['name']) {
    throw new Exception('Page not found');
  }

  $nodes = definitions::get('PresentationNode');
  $records = definitions::get('Record');
  $objectives = definitions::get('Objective');

  $seal_node = $nodes[$page['seal_node_hash']];
  $seal_record = $records[$seal_node['completionRecordHash']]; // has title. ignore objective

  // echo_pretty_json($seal_node);
  // echo_pretty_json($seal_record);

  $headings = array();
  $rows = array();

  $headings[] = array(
    'name' => 'Player',
  );

  foreach ($seal_node['children']['records'] as $record_skeleton) { // move the insides of this loop to a function?
    $record = $records[$record_skeleton['recordHash']];
    $heading = array(
      'record_hash' => $record['hash'],
      'name' => $record['displayProperties']['name'],
      'description' => $record['displayProperties']['description'],
      'icon' => $record['displayProperties']['icon'],
      'objectives' => array(),
    ) + ($page['records'][$record['hash']] ?? array());
    // echo_pretty_json($record);
    // echo "record {$record['hash']} {$record['displayProperties']['name']}" . PHP_EOL;
    foreach ($record['objectiveHashes'] as $hash) {
      $objective = $objectives[$hash]; // completion value, progress description
      $heading['objectives'][] = array(
        'hash' => $hash,
        'name' => $objective['progressDescription'],
        'completionValue' => $objective['completionValue'],
      );
      // echo "\tobjective {$objective['hash']} {$objective['progressDescription']}" . PHP_EOL;
      // echo_pretty_json($objective);
    }

    $headings[] = $heading;
  }
  // echo_pretty_json($headings);

  
  $th1 = '';
  $th2 = '';
  foreach ($headings as $heading) {
    $column_name = $heading['column_name'] ?? $heading['name'];
    if (empty($heading['objectives']) || count($heading['objectives']) === 1) {
      $th1 .= "<th rowspan='2'>{$column_name}</th>";
    } else {
      $count = count($heading['objectives']);
      $th1 .= "<th colspan='$count'>{$column_name}</th>";
      foreach ($heading['objectives'] as $key => $objective) {
        $subcolumn_name = !empty($heading['number_objectives']) ? $key + 1 : $objective['name'];
        $th2 .= "<th>$subcolumn_name</th>";
      }
    }
  }

  $table = "<table><tr>$th1</tr><tr>$th2</tr>";

  $players = profiles::get_cached_players(); // TODO flag for using cache vs current roster
  foreach ($players as $player) {
    $profile = profiles::get($player['destinyUserInfo']['membershipType'], $player['destinyUserInfo']['membershipId']);
    if (empty($profile['profileRecords']['data'])) {
      // echo profiles::normalize_name($profile['profile']['data']['userInfo']['displayName']) . ' is hidding' . PHP_EOL;
      continue;
    }
    $player_data = array(
      'name' => profiles::normalize_name($profile['profile']['data']['userInfo']['displayName']),
      'total_completion' => 0,
      'records' => array(),
    );
    foreach ($headings as $heading) {
      if ($heading['name'] === 'Player') {
        continue;
      }

      $profile_record = $profile['profileRecords']['data']['records'][$heading['record_hash']];
      $player_data['records'][$heading['record_hash']] = $profile_record;
      $player_data['total_completion'] += estimate_player_record_progress($profile_record);
    }
    $rows[] = $player_data;
  }  

  $max_completion = count($headings) - 1; // ignore player column. Maybe should work differently, but this is ok for now.
  usort($rows, build_sorter($max_completion));

  foreach ($rows as $player_data) {
    $table .= "<tr>";
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
      // echo_pretty_json($player_record);
      foreach ($heading['objectives'] as $key => $objective) {
        // echo_pretty_json($objective);
        $player_objective = $player_record['objectives'][$key];
        if ($player_objective['objectiveHash'] !== $objective['hash']) { // ensure the order is constant
          throw new Exception("hashes don't match. {$player_objective['objectiveHash']} !== {$objective['hash']}");
        }
        // echo_pretty_json($player_objective);
        $progress = $player_objective['progress'];
        if ($progress === 0 || $progress === $objective['completionValue']) {
          $progress = '';
        }
        $recordState = get_player_objective_state($player_record, $key);
        $table .= "<td recordState='$recordState'>$progress</td>"; // TODO tooltip showing min/max
      }
    }
    $table .= "</tr>";
  }

  $table .= '</table>';
  echo $table;

  // get seal triumphs
  // if all, add other cateogry triumphs

  // make header float?
  // show other details when clicking a column header or a cell? or on hover?
  // add sort capability on columns?
  // auto-sort complete to bottom. what is complete? closest to complete at the top
  // put clan name and icon somewhere? Show seal icon if relevant?
  // handle gilding?
  // distinguish groups of columns?
}

// TODO force stadia name?
// TODO highlight row and column on hover? (without bumping elements around)

function estimate_player_record_progress($record) {
  $progress = 0;
  foreach ($record['objectives'] as $objective) {
    $progress += min(1, $objective['progress'] / $objective['completionValue']); // assume no zeroes in denominator?
  }
  return $progress / count($record['objectives']);
}

function get_player_objective_state($record, $key) {
  if ($record['state'] === 0) {
    return 0; // not yet redeemed
  }

  $objective = $record['objectives'][$key];
  if ($objective['complete']) {
    return 1; // "redeemed"
  }
  if ($objective['progress'] > 0) {
    return 'p';
  }
  return $record['state'];
}

function build_sorter($max_completion) {
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



















