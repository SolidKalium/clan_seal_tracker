<?php


class definitions {

  private static $definitions_updated = false;
  private static $dir = 'definitions';

  public static function update() {
    if (self::$definitions_updated) {
      return;
    }

    $definitions_to_update = array(
      'PresentationNode',
      'Record',
      'Objective',
      // 'Milestone',
      'Checklist',
      'Collectible',
      // 'InventoryItem', // very big
      'InventoryItemLite', // still big, but smaller
      // 'ItemCategory',
      // 'RewardSource', // empty
      'Artifact', // just the current artifact
      // 'EntitlementOffer', // these entries have no useful data
      // 'Destination',
      // 'Location',
      // 'Place',
    );

    $current_filenames = self::get_current_filenames();

    $manifest = bungie_api::get_manifest();
    $definitions = $manifest['jsonWorldComponentContentPaths']['en']; // NOTE: using individual files may not be supported long term

    foreach ($definitions_to_update as $type) {
      $key = 'Destiny' . $type . 'Definition';
      $path = $definitions[$key];
      $path_parts = explode('/', $path);
      $new_filename = end($path_parts);
      if (isset($current_filenames[$key])) {
        if ($current_filenames[$key] !== $new_filename) {
          // echo $key . ' file changed: ' . $new_filename . ' ' . $current_filenames[$key] . PHP_EOL;
          file_put_contents(self::$dir . '/' . $new_filename, bungie_api::fetch_resource($path));
          unlink(self::$dir . '/' . $current_filenames[$key]);
        } else {
          // echo $key . ' is up to date' . PHP_EOL;
        }
      } else {
        // echo $key . ' doesn\'t exist yet' . PHP_EOL;
        file_put_contents(self::$dir . '/' . $new_filename, bungie_api::fetch_resource($path));
      }
    }

    self::$definitions_updated = true;
  } 

  private static $memo = array();
  public static function get($type, $only_warn_if_missing = false) {
    if (isset(self::$memo[$type])) {
      return self::$memo[$type];
    }

    $full_type = 'Destiny' . $type . 'Definition';

    $current_filenames = self::get_current_filenames();

    if (!$current_filenames[$full_type]) {
      if ($only_warn_if_missing) {
        echo 'missing ' . $type . 'definition file' . PHP_EOL;
        return array();
      }
      throw new Exception('No definitions downloaded for ' . $type);
    }

    $contents = file_get_contents(self::$dir . '/' . $current_filenames[$full_type]);
    $data = json_decode($contents, true);

    if ($data === null) {
      throw new Exception("json_decode error " . json_last_error() . ": " . json_last_error_msg());
    }

    self::$memo[$type] = $data;
    return $data;
  }

  private static function get_current_filenames() {
    $current_filenames = array();

    if (!is_dir(self::$dir)) {
      mkdir(self::$dir); // side-effect ok
    }

    $dh = opendir(self::$dir); // assuming dh is not null
    while (($filename = readdir($dh)) !== false) {
      if (in_array($filename, array('.', '..'))) { continue; }
      $parts = explode('-', $filename, 2);
      $current_filenames[$parts[0]] = $filename;
    }
    closedir($dh);

    return $current_filenames;
  }
}
