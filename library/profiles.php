<?php


class profiles {

  // Not memoizing profiles. That would need over 500M
  // Not currently using cookies, even if it might help in the event of two webrequests being made at the same time

  private static $dir = 'profiles';
  private static $standard_components = array('Profiles', 'ProfileProgression', 'CharacterProgressions', 'PresentationNodes', 'Collectibles', 'Records'); // These are the components that will be fetched and stored
  private static $cache_minutes = 5;

  private static $updated_profiles = array();

  public static function get($membership_type, $membership_id, $last_seen = null, $refresh = 7 * 24 * 60 * 60) {
    // refresh: if int, use api if file is older than that many seconds. if true, always use api.
    // last_seen: optional timestamp of when the player was last online

    // Note: the clan list's status change time can be finnicky, but is when the profile last logged in or logged out. Going to orbit or switching characters doesn't matter. It can be slightly late. If a profile logs out then back in, it may briefly show the previous login time before being updated to the new login time, even if it showed the correct logout time in the gap.
    // Theoretically, we could fetch just the profile's characters, but that still takes a moment, so it's only worth it to use the timestamps from the clan member list.

    $key = self::get_key($membership_type, $membership_id);
    $path = self::$dir . '/' . $key . '.json';

    if (self::_use_cache($membership_type, $membership_id, $last_seen, $refresh)) {
      // echo 'cached user ' . $key . PHP_EOL;
      $profile = json_decode(file_get_contents($path), true);
      if ($profile === null) {
        throw new Exception('Failed to decode ' . $path);
      }
      return $profile;
    }

    // echo 'fetching user ' . $key . PHP_EOL;
    $profile = bungie_api::get_profile($membership_type, $membership_id, self::$standard_components);

    if (
      empty($profile['profileRecords']['data']) &&
      file_exists($path)
    ) {
      // prefer cached data if the player is currently in private mode.
      // Happens to prevent trivial update if old data was also private.
      // Could do a fancier merge based on which data is privat, instead of all-or-nothing
      $profile = json_decode(file_get_contents($path), true);
      if ($profile === null) {
        throw new Exception('Failed to decode ' . $path);
      }
      self::$updated_profiles[$key] = true;
      return $profile;
    } else {
      $profile += bungie_api::get_memberships($membership_id, $membership_type); // only takes about 0.1 seconds
      file_put_contents($path, json_encode($profile));
    }

    self::$updated_profiles[$key] = true;
    return $profile;
  }
  private static function _use_cache($membership_type, $membership_id, $last_seen, $refresh = 7 * 24 * 60 * 60) {
    $key = self::get_key($membership_type, $membership_id);
    $path = self::$dir . '/' . $key . '.json';

    if (!empty(self::$updated_profiles[$key])) {
      // echo $key . ' is already updated' . PHP_EOL;
      return true;
    }

    if ($refresh === true) { // refresh requested explicitly
      return false;
    }

    if (!file_exists($path)) {
      return false;
    }

    // cache exists for account
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

    return $use_cache;
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

  private static function get_current_filenames() { // deprecated
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

  public static function get_display_name($profile_data, $type = null) {
    if ($type && !empty($profile_data['destinyMemberships'])) {
      foreach ($profile_data['destinyMemberships'] as $membership) {
        if ($membership['membershipType'] === $type) {
          return self::normalize_name($membership['displayName']);
        }
      }
    }

    $user_info = $profile_data['profile']['data']['userInfo'];
    return $user_info['bungieGlobalDisplayName'];

    // return self::normalize_name($profile_data['profile']['data']['userInfo']['displayName']);
  }
  public static function get_display_names($profile_data) {
    $names = array();

    $user_info = $profile_data['profile']['data']['userInfo'];
    if (!empty($user_info['bungieGlobalDisplayName'])) {
      $names['Bungie'] = $user_info['bungieGlobalDisplayName'] . '#' . $user_info['bungieGlobalDisplayNameCode'];
    }

    $type_name = array(
      0 => 'None',
      1 => 'Xbox',
      2 => 'PSN',
      3 => 'Steam',
      4 => 'Blizzard',
      5 => 'Stadia',
      6 => 'Epic',
      10 => 'Demon',
      254 => 'BungieNext',
    );

    if (!empty($profile_data['destinyMemberships'])) {
      foreach ($profile_data['destinyMemberships'] as $membership) {
        $names[$type_name[$membership['membershipType']]] = self::normalize_name($membership['displayName']);
        if ($membership['membershipType'] === $user_info['membershipType']) {
          $names[$type_name[$membership['membershipType']]] .= ' (cross-save)';
        }
      }
    }

    if (!empty($profile_data['bungieNetUser']['twitchDisplayName'])) {
      $names['Twitch'] = $profile_data['bungieNetUser']['twitchDisplayName'];
    }

    return $names;
  }


  public static function precache_players($players, $force_refresh = false) {
    self::_precache_players($players, $force_refresh);
    gc_collect_cycles(); // bonus magic
  }
  private static function _precache_players($players, $force_refresh) {
    $queue = array();

    foreach ($players as $player) {
      $last_seen = $player['lastOnlineStatusChange'] ?? null;
      if (!empty($player['isOnline'])) {
        $last_seen = time(); // last seen now
      }
      if ($force_refresh || !self::_use_cache($player['destinyUserInfo']['membershipType'], $player['destinyUserInfo']['membershipId'], $last_seen)) {
        $queue[] = $player;
      }
    }

    // echo count($queue) . ' players need to be re-cached' . PHP_EOL;
    if (empty($queue)) {
      return;
    }

    $chunk_size = 20;
    $components = self::normalize_component_codes(self::$standard_components);
    $base = 'https://www.bungie.net/Platform';
    $default_curl_opts = array(
      CURLOPT_HTTPHEADER => array(
        'X-API-Key: ' . get_setting("secret_key"),
      ),
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_USERAGENT => 'kalium/clan_seal_tracker/v0',
    );
    $expected = array( // First draft for result error checking. If this error checking causes issues, improve it.
      "ErrorCode" => 1,
      "ThrottleSeconds" => 0,
      "ErrorStatus" => "Success",
      "Message" => "Ok",
      "MessageData" => array(),
    );

    // TODO refactor into bungie_api class?


    // init
    $mh = curl_multi_init();
    $profile_chs = array();
    $membership_chs = array();

    while (count($queue)) {
      // echo count($queue) . ' players remaining to be re-cached' . PHP_EOL;
      for ($i = 0; $i < $chunk_size; $i++) {
        $player = array_pop($queue);

        if (!$player) {
          // early cleanup

          if (isset($profile_chs[$i])) {
            curl_multi_remove_handle($mh, $profile_chs[$i]);
            curl_close($profile_chs[$i]);
            unset($profile_chs[$i]);

            curl_multi_remove_handle($mh, $membership_chs[$i]);
            curl_close($membership_chs[$i]);
            unset($membership_chs[$i]);
          }

          continue;
        }

        $membership_type = (int) $player['destinyUserInfo']['membershipType'];
        $membership_id = (int) $player['destinyUserInfo']['membershipId'];

        // profile
        $ch = $profile_chs[$i] = $profile_chs[$i] ?? curl_init();
        curl_setopt_array($ch, $default_curl_opts + array(
          CURLOPT_URL => $base . '/Destiny2/' . $membership_type . '/Profile/' . $membership_id. '/?components=' . implode(',', $components),
        ));
        curl_multi_add_handle($mh, $ch);

        // memberships
        $ch = $membership_chs[$i] = $membership_chs[$i] ?? curl_init();
        curl_setopt_array($ch, $default_curl_opts + array(
          CURLOPT_URL => $base . '/User/GetMembershipsById/' . $membership_id . '/' . $membership_type . '/',
        ));
        curl_multi_add_handle($mh, $ch);
      }
      // var_dump($profile_chs, $membership_chs);

      // magic for the live server, otherwise it exceeds the limit of 256MB.
      // This one line consistently prevents crashing
      // Adding "return;" to the start of this function also makes it work.
      // GC is turned on there. PHP is v7.0 instead of 7.3. I don't know why it doesn't crash on my computer with the same limit.
      // https://stackoverflow.com/questions/38850391/when-does-php-run-garbage-collection-in-long-running-scripts/38850392
      gc_collect_cycles();

      // fetch data
      do {
        curl_multi_exec($mh, $running);
        curl_multi_select($mh, 0.1);
      } while ($running > 0);

      // process data
      foreach ($profile_chs as $i => $ch) {
        $profile_text = curl_multi_getcontent($ch);
        if ($profile_text === false) {
          echo_pretty_json(curl_getinfo($ch, CURLINFO_EFFECTIVE_URL));
          throw new Exception("curl_exec error for pre-cache profile $i " . curl_errno($ch) . ": " . curl_error($ch));
        }
        curl_multi_remove_handle($mh, $ch);
        $profile = json_decode($profile_text, true);
        if ($profile === null) {
          // NOTE: if the server isn't working, the response will be html
          echo htmlspecialchars($profile_text);
          echo_pretty_json(curl_getinfo($ch, CURLINFO_EFFECTIVE_URL));
          throw new Exception("json_decode error for pre-cache profile $i " . json_last_error() . ": " . json_last_error_msg());
        }
        // unset($profile_text);
        foreach ($expected as $key => $value) {
          if ($profile[$key] !== $value) {
            // if ($key === 'ErrorCode' && $profile[$key] === 1618) {
            //   // Skip over the DestinyUnexpectedError, because there's nothing we can do about it
            //   // Previously happened when the character data was unavailable due to the emblems on a character, possibly messed up by an update
            //   // https://www.bungie.net/en/Forums/Post/262050968
            //   $url_parts = explode('/', curl_getinfo($ch, CURLINFO_EFFECTIVE_URL));
            //   $profile = array(
            //     'Response' => array(
            //       'profile' => array(
            //         'data' => array(
            //           'userInfo' => array(
            //             'membershipType' => $url_parts[count($url_parts) - 4],
            //             'membershipId' => $url_parts[count($url_parts) - 2]
            //           )
            //         )
            //       )
            //     )
            //   );
            //   break;
            // }
            echo_pretty_json($profile);
            echo_pretty_json(curl_getinfo($ch, CURLINFO_EFFECTIVE_URL));
            throw new Exception("pre-cache profile $i expected " . $key . " => " . json_encode($value) . ", but received " . json_encode($profile[$key]));
          }
        }


        $membership_text = curl_multi_getcontent($membership_chs[$i]);
        if ($membership_text === false) {
          throw new Exception("curl_exec error for pre-cache membership $i " . curl_errno($membership_chs[$i]) . ": " . curl_error($membership_chs[$i]));
        }
        curl_multi_remove_handle($mh, $membership_chs[$i]);
        $membership = json_decode($membership_text, true);
        if ($membership === null) {
          // NOTE: if the server isn't working, the response will be html
          echo htmlspecialchars($membership_text);
          throw new Exception("json_decode error for pre-cache membership $i " . json_last_error() . ": " . json_last_error_msg());
        }
        // unset($membership_text);
        foreach ($expected as $key => $value) {
          if ($membership[$key] !== $value) {
            echo_pretty_json($membership);
            throw new Exception("pre-cache membership $i expected " . $key . " => " . json_encode($value) . ", but received " . json_encode($membership[$key]));
          }
        }

        $user_info = $profile['Response']['profile']['data']['userInfo'];
        $key = self::get_key($user_info['membershipType'], $user_info['membershipId']);
        $path = self::$dir . '/' . $key . '.json';

        if (
          empty($profile['Response']['profileRecords']['data']) &&
          file_exists($path)
        ) {
          // echo $key . ' has no new info' . PHP_EOL;
          // nothing
        } else {
          file_put_contents($path, json_encode($profile['Response'] + $membership['Response']));
        }
        self::$updated_profiles[$key] = true;
      }
    }

    // cleanup
    foreach ($profile_chs as $i => $ch) {
      curl_multi_remove_handle($mh, $ch);
      curl_close($ch);

      curl_multi_remove_handle($mh, $membership_chs[$i]);
      curl_close($membership_chs[$i]);
    }
    curl_multi_close($mh);
  }

  public static function normalize_component_codes($components) {
    // returns an array of ints

    $map = array(
      'None' => 0,
      'Profiles' => 100,
      'VendorReceipts' => 101,
      "ProfileInventories" => 102,
      "ProfileCurrencies" => 103,
      "ProfileProgression" => 104, // checklists and artifact, even with some privacy on
      "PlatformSilver" => 105, // logged in user only
      "Characters" => 200, // minutes played, light level, selected title, emblem, etc.
      "CharacterInventories" => 201,
      "CharacterProgressions" => 202, // might include season pass info. progression, faction, quest, milestone, quests, non-instanced item objectives, checklists, artifact
      "CharacterRenderData" => 203,
      "CharacterActivities" => 204,
      "CharacterEquipment" => 205,
      "ItemInstances" => 300,
      "ItemObjectives" => 301,
      "ItemPerks" => 302,
      "ItemRenderData" => 303,
      "ItemStats" => 304,
      "ItemSockets" => 305, // slow
      "ItemTalentGrids" => 306, // labelled as itemComponents
      "ItemCommonData" => 307,
      "ItemPlugStates" => 308,
      "ItemPlugObjectives" => 309, // big, only get if needed
      "ItemReusablePlugs" => 310,
      "Vendors" => 400, // none
      "VendorCategories" => 401, // none
      "VendorSales" => 402, // none
      "Kiosks" => 500,
      "CurrencyLookups" => 600,
      "PresentationNodes" => 700,
      "Collectibles" => 800,
      "Records" => 900,
      "Transitory" => 1000, // currently empty
      "Metrics" => 1100,
      "StringVariables" => 1200,
      "Craftables" => 1300,
    );

    foreach ($components as $key => $value) {
      if (isset($map[$value])) {
        $components[$key] = $map[$value];
      } else {
        $components[$key] = (int) $value;
      }
    }

    return $components;
  }

}
