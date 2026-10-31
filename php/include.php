<?php

// SETUP
define('APP_ROOT', __DIR__); // file paths resolve from here, not the working directory

function exception_error_handler($errno, $errstr, $errfile, $errline ) {
  echo '<pre>';
  throw new ErrorException($errstr, 0, $errno, $errfile, $errline);
}
set_error_handler("exception_error_handler");

$limit = ini_get('memory_limit');
if (
  (strtolower(substr($limit, -1)) === 'k') ||
  (strtolower(substr($limit, -1)) === 'm' && ((int) substr($limit, 0, strlen($limit) - 1) < 1024))
) {
  ini_set('memory_limit', '1024M');
}

include_once APP_ROOT . '/library/bungie_api.php';
include_once APP_ROOT . '/library/definitions.php';
include_once APP_ROOT . '/library/profiles.php';
include_once APP_ROOT . '/library/groups.php';


// DEBUG ASSIST
function echo_pretty_json(...$jsons) {
  foreach ($jsons as $json) {
    echo '<pre>' . htmlspecialchars(json_encode($json, JSON_PRETTY_PRINT)) . PHP_EOL . PHP_EOL . '</pre>';
  }
}

function display_table($rows) {
  if (empty($rows)) {
    echo 'No data to display' . PHP_EOL;
    return;
  }

  $keys = array_keys(array_merge(...array_map('array_flip', array_map('array_keys', $rows))));

  $html = '<table><thead><tr><th>' . implode('</th><th>', $keys) . '</th></tr></thead><tbody>';
  foreach ($rows as $row) {
    $html .= '<tr>';
    foreach ($keys as $key) {
      $value = $row[$key] ?? '';
      if (is_array($value)) { $value = json_encode($value); }
      $html .= '<td>' . $value . '</td>';
    }
    $html .= '</tr>';
  }
  $html .= '</tbody></table>';

  echo $html;
}
function get_csv($rows) {
  // assume all keys are the same and in a consistent order...
  $columns = array_keys(current($rows));

  $handle = fopen(APP_ROOT . '/temp.csv', 'w');

  fputcsv($handle, $columns);
  foreach ($rows as $row) {
    fputcsv($handle, $row);
  }

  fclose($handle);

  $csv = file_get_contents(APP_ROOT . '/temp.csv');

  unlink(APP_ROOT . '/temp.csv');

  return $csv;
}

function display_node_hierarchy($root_hash = '1866538467' /* records root */, $display_level = 0, $current_depth = 0) {
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
  echo_definition_line($node, $current_depth);

  if ($display_level > 0) {
    $child_types = array(
      'collectibles' => array('name' => 'collectible', 'definition_type' => 'Collectible'),
      'records' => array('name' => 'record', 'definition_type' => 'Record'),
      // 'metrics' => array('name' => 'metric', 'definition_type' => 'Metric'),
    );
    foreach ($child_types as $key => $info) {
      if (!empty($node['children'][$key])) {
        echo_info_line('has ', count($node['children'][$key]), ' ' . $key, $current_depth + 1);
        if ($display_level > 1) {
          $definitions = definitions::get($info['definition_type']);
          foreach (array_column($node['children'][$key], $info['name'] . 'Hash') as $child_hash) {
            $child = $definitions[$child_hash];
            echo echo_definition_line($child, $current_depth + 1);
          }
        }
      }
    }
  }

  if (!empty($node['children'])) {
    foreach ($node['children']['presentationNodes'] as $child) {
      display_node_hierarchy($child['presentationNodeHash'], $display_level, $current_depth + 1);
    }
  }

  if (!$current_depth) {
    echo PHP_EOL;
  }
}
function display_node_hierarchy_reverse($root_hash, $current_depth = 0) {
  $type = '';

  $nodes = definitions::get('PresentationNode');
  if (!empty($nodes[$root_hash])) {
    $node = $nodes[$root_hash];
  } else {
    // not a node, but probably has the fields we need. Some things like item would need more effort.

    $child_types = array(
      'collectibles' => array('name' => 'collectible', 'definition_type' => 'Collectible'),
      'records' => array('name' => 'record', 'definition_type' => 'Record'),
      // 'metrics' => array('name' => 'metric', 'definition_type' => 'Metric'),
    );

    foreach ($child_types as $key => $info) {
      $definitions = definitions::get($info['definition_type']);
      if (!empty($definitions[$root_hash])) {
        $node = $definitions[$root_hash];
        $type = ' (' . $info['name'] . ')';
        break;
      }
    }
  }


  echo_definition_line($node, $current_depth, $type);


  foreach ($node['parentNodeHashes'] as $parent_hash) {
    display_node_hierarchy_reverse($parent_hash, $current_depth + 1);
  }

  if (!$current_depth) {
    echo PHP_EOL;
  }
}

function display_hash_info($hash) {
  $types = array(
    'PresentationNode',
    'Record',
    'Objective',
    'Milestone',
    'Checklist',
    'Collectible',
    'SandboxPerk',
    // 'InventoryItem', // very big
    'InventoryItemLite', // still big, but smaller
    // 'ItemCategory',

    // 'RewardSource', // empty
    'Artifact', // just the current artifact
    // 'EntitlementOffer', // these entries have no useful data

    // 'Activity',
    // 'ActivityGraph',
    // 'ActivityInteractable', // I think the presence of an entry here indicates a player can interact with it.
    // 'ActivityMode',
    // 'ActivityModifier',
    // 'ActivityType',

    // 'Destination',
    // 'Location',
    // 'Place',

    'Progression',
    // 'ProgressionLevelRequirement',
    // 'ProgressionMapping',
    // 'RewardAdjusterProgressionMap',
    // 'RewardAdjusterPointer',
    // 'RewardSource',
    // 'RewardMapping',
    // 'RewardSheet',
    // 'RewardItemList',
    // 'SackRewardItemList',
  );

  foreach ($types as $type) {
    $definitions = definitions::get($type, true); // just warn if not loaded
    if (!empty($definitions[$hash])) {
      echo $type . ' ' . $hash;
      echo_pretty_json($definitions[$hash]);

      if ($type === 'Collectible') {
        $items = definitions::get('InventoryItemLite');
        $item = $items[$definitions[$hash]['itemHash']];
        echo_pretty_json($item);
      }
      return;
    }
  }

  echo 'hash not found: ' . $hash . PHP_EOL;
}


// UTILITY
function enable_implicit_flush() {
  // @apache_setenv('no-gzip', 1);
  @ini_set('zlib.output_compression', 0);
  @ini_set('implicit_flush', 1);
  for ($i = 0; $i < ob_get_level(); $i++) { ob_end_flush(); }
  ob_implicit_flush(1);
}

$settings = null;
function get_setting($key) { // TODO defaults?
  global $settings;
  if (empty($settings)) {
    $settings = load_json(APP_ROOT . '/settings.json');
  }

  return $settings[$key];
}

$page_definitions = null;
function get_page_definitions() {
  global $page_definitions;
  if (empty($page_definitions)) {
    $page_definitions = load_json(APP_ROOT . '/pages.json');
  }

  return $page_definitions;
}

function load_json($path) {
  $file_contents = file_get_contents($path);

  // minimalist comment stripping and hanging comma stripping
  $file_contents = preg_replace("/\/\/[^\n]*\n/", "\n", $file_contents);
  $file_contents = preg_replace("/,\s*}/", "\n}", $file_contents);
  $file_contents = preg_replace("/,\s*]/", "\n]", $file_contents);

  $json = json_decode($file_contents, true);
  if ($json === null) {
    throw new Exception('Invalid ' . $path . ' ' . json_last_error() . ": " . json_last_error_msg());
  }
  return $json;
}

function echo_definition_line($definition, $depth = 0, $extra_description = '') {
  $padding = str_pad('', 2 * $depth);
  echo $padding . "<span style='color:silver; display: inline-block; vertical-align: top;'>" . str_pad($definition['hash'], 10) . "</span>"
    . " <span style='display: inline-block; vertical-align: top;'>{$definition['displayProperties']['name']}</span>"
    . " <span style='color:silver; display: inline-block; vertical-align: top;'>{$definition['displayProperties']['description']}$extra_description</span>"
    . PHP_EOL;
}
function echo_info_line($start, $focus, $end = '', $depth = 0) {
  $padding = str_pad('', 2 * $depth);
  echo $padding . "<span style='color:silver;''>$start<span style='color:grey;''>$focus</span>$end</span>" . PHP_EOL;
}

