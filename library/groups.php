<?php


class groups {

  private static $dir = 'groups';

  private static $group_members = array(); // cache
  public static function get_group_members($group_id, $refresh = 3 * 60) {
    // refresh: if true, always get new data. if int, use cache if it's less than that many seconds old
    $group_id = (int) $group_id;

    if (!empty(self::$group_members[$group_id])) {
      return self::$group_members[$group_id];
    }

    $path = self::$dir . '/' . $group_id . '.json';

    if (
      $refresh !== true &&
      file_exists($path)
    ) {
      $mtime = filemtime($path);
      $now = time();

      if ($now - $mtime < $refresh) {
        $players = json_decode(file_get_contents($path), true);
        self::$group_members[$group_id] = $players;
        return $players;
      }
    }

    if (!is_dir(self::$dir)) {
      mkdir(self::$dir);
    }

    $players = bungie_api::get_group_members($group_id);
    file_put_contents($path, json_encode($players));
    self::$group_members[$group_id] = $players;
    return $players;
  }

}