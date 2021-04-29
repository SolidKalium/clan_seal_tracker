<?php


class profiles {

  private static $dir = 'profiles';
  private static $components = array('Profiles', 'ProfileProgression', 'PresentationNodes', 'Collectibles', 'Records'); // These are the components that will be fetched and stored

  private static $memo = array(); // currently disabled to keep memory usage low. Otherwise needs over 500M
  public static function get($membership_type, $membership_id, $refresh = 7 * 24 * 60 * 60) {
    // refresh: only used on first access for that profile for the current run. if int, use api if file is older than that many seconds. if true, always use api.

    $key = self::get_key($membership_type, $membership_id);
    $path = self::$dir . '/' . $key . '.json';

    // if (isset(self::$memo[$key])) {
    //   return self::$memo[$key];
    // }

    $current_filenames = self::get_current_filenames();
    if (!empty($current_filenames[$key])) {
      $mtime = filemtime($path);
      $now = time();

      if (
        $refresh !== true &&
        $refresh > ($now - $mtime)
      ) {
        $profile = json_decode(file_get_contents($path), true);
        if ($profile === null) {
          throw new Exception('Failed to decode ' . $path);
        }
        // self::$memo[$key] = $profile;
        return $profile;
      }
    }

    $profile = bungie_api::get_profile($membership_type, $membership_id, self::$components);
    $memberships = bungie_api::get_memberships($membership_id, $membership_type);
    file_put_contents($path, json_encode($profile + $memberships));
    // self::$memo[$key] = $profile;
    return $profile;
  }

  public static function get_key($membership_type, $membership_id = null) { // accepts array of values or two separate values
    if (is_array($membership_type)) {
      return $membership_type['membership_type'] . '_' . $membership_type['membership_id'];
    }
    return $membership_type . '_' . $membership_id;
  }

  private static function get_filename_meaning($filename) {
    $parts = explode('.', $filename); // remove extension
    $parts = explode('_', $parts[0]);

    return array(
      'membership_type' => $parts[0],
      'membership_id' => $parts[1],
    );
  }

  private static function get_current_filenames() { // NOTE: this is an inefficient approach, but I like keeping the directory readingseparate
    $current_filenames = array();

    if (!is_dir(self::$dir)) {
      mkdir(self::$dir); // side-effect ok
    }

    $dh = opendir(self::$dir); // assuming dh is not null
    while (($filename = readdir($dh)) !== false) {
      if (in_array($filename, array('.', '..'))) { continue; }
      $parts = explode('.', $filename);
      $key = $parts[0];
      $current_filenames[$key] = $filename;
    }
    closedir($dh);

    return $current_filenames;
  }

  public static function get_cached_players() { // fake group membership list for fast load
    $filenames = self::get_current_filenames();

    $players = array();
    foreach ($filenames as $key => $filename) {
      $parts = explode('_', $key);
      $players[] = array(
        'destinyUserInfo' => array(
          'membershipType' => $parts[0],
          'membershipId' => $parts[1],
        )
      );
    }

    return $players;
  }

  public static function normalize_name($name) {
    // could also pass in the membership type or the whole profile. This is good enough for now.
    // membership lists don't have all of the names, nor does profile.
    // The only way to get it all is from getting the membership list

    if (substr($name, -2) === '#0') {
      return $name . '000'; // all stadia names get 4 digits.
    }

    return $name;
  }

  public static function is_stadia($name) {
    if (
      substr($name, -2) === '#0' ||
      (substr($name, -5, 1) === '#' && is_numeric(substr($name, -4)))
    ) {
      return true;
    }
    return false;
  }

  public static function get_display_name($profile_data, $type = 5) {
    if (!empty($profile_data['destinyMemberships'])) {
      foreach ($profile_data['destinyMemberships'] as $membership) {
        if ($membership['membershipType'] === $type) {
          return self::normalize_name($membership['displayName']);
        }
      }
    }

    return self::normalize_name($profile_data['profile']['data']['userInfo']['displayName']);
  }

}
