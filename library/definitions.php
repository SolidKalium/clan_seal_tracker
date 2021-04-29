<?php


class definitions {

  private static $definitions_updated = false;
  private static $dir = 'definitions';

  public static function update() {
    if (self::$definitions_updated) {
      return;
    }

    $definitions_to_update = array(
      'DestinyObjectiveDefinition',
      'DestinyRecordDefinition',
      'DestinyPresentationNodeDefinition',
      // 'DestinyMilestoneDefinition',
    );

    $current_filenames = self::get_current_filenames();

    $manifest = bungie_api::get_manifest();
    $definitions = $manifest['jsonWorldComponentContentPaths']['en']; // NOTE: using individual files may not be supported long term

    foreach ($definitions_to_update as $key) {
      $path = $definitions[$key];
      $new_filename = end(explode('/', $path));
      if (isset($current_filenames[$key])) {
        if ($current_filenames[$key] !== $new_filename) {
          // echo $key . ' file changed: ' . $new_filename . ' ' . $current_filenames[$key] . PHP_EOL;
          file_put_contents(self::$dir . '/' . $new_filename, fetch_resource($path));
          unlink(self::$dir . '/' . $current_filenames[$key]);
        } else {
          // echo $key . ' is up to date' . PHP_EOL;
        }
      } else {
        // echo $key . ' doesn\'t exist yet' . PHP_EOL;
        file_put_contents(self::$dir . '/' . $new_filename, fetch_resource($path));
      }
    }

    self::$definitions_updated = true;
  } 

  private static $memo = array();
  public static function get($type) {
    if (isset(self::$memo[$type])) {
      return self::$memo[$type];
    }

    $full_type = 'Destiny' . $type . 'Definition';

    $current_filenames = self::get_current_filenames();

    if (!$current_filenames[$full_type]) {
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
