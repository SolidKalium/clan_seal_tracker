<?php


class profiles {

  private static $dir = 'profiles';
  private static $standard_components = array('Profiles', 'ProfileProgression', 'CharacterProgressions', 'PresentationNodes', 'Collectibles', 'Records'); // These are the components that will be fetched and stored
  private static $cache_minutes = 5;

  private static $memo = array(); // currently disabled to keep memory usage low. Otherwise needs over 500M
  public static function get($membership_type, $membership_id, $last_seen = null, $refresh = 7 * 24 * 60 * 60) {
    // refresh: if int, use api if file is older than that many seconds. if true, always use api.
    // last_seen: optional timestamp of when the player was last online
    // Note: the clan list's status change time can be finnicky, but is when the profile last logged in or logged out. Going to orbit or switching characters doesn't matter. It can be slightly late. If a profile logs out then back in, it may briefly show the previous login time before being updated to the new login time, even if it showed the correct logout time in the gap.

    // Theoretically, we could fetch just the profile's characters, but that still takes a moment, so it's only worth it to use the timestamps from the clan member list.

    // TODO handle multithreaded server? use cookies so it's fast even if two requests sent?
    // TODO cache clan info every 5 minutes?

    $key = self::get_key($membership_type, $membership_id);
    $path = self::$dir . '/' . $key . '.json';

    // if (isset(self::$memo[$key])) {
    //   return self::$memo[$key];
    // }


    if ($refresh !== true) { // no explicit refresh requested
      $current_filenames = self::get_current_filenames(); // TODO check existence directly
      if (!empty($current_filenames[$key])) { // cache exists for account
        $mtime = filemtime($path);
        $now = time();

        $use_cache = false;
        if ($last_seen !== null) { // last_seen is known
          $last_seen = (int) $last_seen;
          if (
            ($last_seen > ($now - (self::$cache_minutes * 60))) && // last seen in the last x minutes
            ($last_seen < ($mtime + (self::$cache_minutes * 60))) // last seen no more than x minutes after last cache
          ) {
            // echo 'using cache from the last ' . self::$cache_minutes . ' minutes' . PHP_EOL;
            $use_cache = true;
          } else if ($last_seen < $mtime) {
            // echo 'last seen after cache' . PHP_EOL;
            $use_cache = true;
          }
          if ($refresh < ($now - $mtime)) {
            // always bust cache if old
            // This is 1 week for now, but could be tied to manifest updates
            $use_cache = false;
          }
        } else if ($refresh > ($now - $mtime)) {
          // echo 'using cache. last seen time unknown' . PHP_EOL;
          $use_cache = true;
        }

        $skip_profile_update = get_setting('skip_profile_update');
        if (!empty($skip_profile_update[$key])) {
          $use_cache = true;
        }

        if ($use_cache) {
          // echo 'cached user ' . $key . PHP_EOL;
          $profile = json_decode(file_get_contents($path), true);
          if ($profile === null) {
            throw new Exception('Failed to decode ' . $path);
          }
          // self::$memo[$key] = $profile;
          return $profile;
        }
      }
    }

    // echo 'fetching user ' . $key . PHP_EOL;
    $profile = bungie_api::get_profile($membership_type, $membership_id, self::$standard_components);
    $profile += bungie_api::get_memberships($membership_id, $membership_type); // only takes about 0.1 seconds
    file_put_contents($path, json_encode($profile));
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

  private static function get_current_filenames() { // NOTE: this is an inefficient approach, but I like keeping the directory reading separate
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
