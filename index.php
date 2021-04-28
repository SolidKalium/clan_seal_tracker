<?php

include 'api.php';

echo '<link rel="stylesheet" type="text/css" href="/tracker.css" media="screen">';
echo '<pre>';

// $records = get_definitions('Record');
// $objectives = get_definitions('Objective');
// $nodes = get_definitions('PresentationNode');

// cache results for all views?

// TODO router
list_pages();


function get_page_definitions() {
  $pages = array(
    array(
      'name' => 'Last Wish',
      'category' => 'Seals',
      'subcategory' => 'Raid',
      'seal_node_hash' => 1486062207,
      'other_nodes' => array(1525933460),
      'records' => array(

      ),
    ),
    array(
      'name' => 'Garden of Salvation',
      'category' => 'Seals',
      'subcategory' => 'Raid',
      'seal_node_hash' => 1827854727,
      'other_nodes' => array(615240848),
      'records' => array(

      ),
    ),
    array(
      'name' => 'Deep Stone Crypt',
      'category' => 'Seals',
      'subcategory' => 'Raid',
      'seal_node_hash' => 2960810718,
      'other_nodes' => array(1726708384),
      'records' => array(

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

  $pages = get_page_definitions();
  $nodes = get_definitions('PresentationNode');
  $records = get_definitions('Record');
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
        echo '<li' . (empty($page['disable_reason']) ? '' :  ' disabled=1') . '>';
        echo $page['name']; // TODO links
        if (!empty($page['seal_node_hash'])) {
          $seal_node = $nodes[$page['seal_node_hash']];
          $seal_record = $records[$seal_node['completionRecordHash']];
          echo ' (' . reset($seal_record['titleInfo']['titlesByGender']) . ')';
        }
        if (!empty($page['disable_reason'])) {
          echo ' (' . $page['disable_reason'] . ')';
        }
        echo '</li>';
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

function show_page() {
  // main table
  // separate list for people who've hidden their triumphs?
  // show other details when clicking a column header or a cell? or on hover?
  // add sort capability
  // auto-sort complete to bottom. what is complete? closest to complete at the top
}


