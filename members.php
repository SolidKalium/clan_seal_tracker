<?php

include 'include.php';

$format = strtolower($_GET['format'] ?? 'member_table');
$force_refresh = isset($_GET['refresh']);

$members = get_clan_members($force_refresh);
array_multisort(array_column($members, 'joined_clan'), SORT_ASC, $members);

if ($format === 'csv') {
  header("Content-disposition: attachment; filename=\"members.csv\"");
  echo get_csv($members), PHP_EOL;
} else if ($format === 'table') {
  display_table($members);
} else if ($format === 'member_table') {
  display_member_table($members);
}



function get_clan_members($force_refresh) {
  $members = groups::get_group_members(get_setting("group_id"));
  profiles::precache_players($members, $force_refresh);

  $membership_types = array(
    // https://www.bungie.net/img/theme/destiny/icons/{icon}.png // color logos on profile page
    // https://www.bungie.net/7/ca/bungie/icons/logos/egs/icon.png // white logos on identity settings page
    1 => array('name' => 'xbox', 'icon' => 'xboxLiveLogo'),
    2 => array('name' => 'playstation', 'icon' =>  'psnLogo'),
    3 => array('name' => 'steam', 'icon' =>  'steamLogo'),
    4 => array('name' => 'blizzard', 'icon' =>  ''), // DEPRECATED. This info is no longer returned
    5 => array('name' => 'stadia', 'icon' => 'icon_stadia'), // will be deprecated :(
    6 => array('name' => 'epic', 'icon' => 'icon_egs'), // Epic Game Store
    // 10 => array('name' => 'demon', 'icon' => ''), // ?
    // 254 => array('name' => 'bungie next', 'icon' => ''), // bungie.net
  );

  foreach ($members as $member) {
    // echo_pretty_json($member); exit();

    $profile = profiles::get($member['destinyUserInfo']['membershipType'], $member['destinyUserInfo']['membershipId']);
    // echo_pretty_json($profile); exit();

    $versions_owned = $profile['profile']['data']['versionsOwned'];
    $season_hashes = $profile['profile']['data']['seasonHashes'] ?? array();
    $event_card_hashes = $profile['profile']['data']['eventCardHashesOwned'] ?? array();
    $character_progressions = $profile['characterProgressions']['data'] ?? array();
    $character_progression = reset($character_progressions); // first character. Should be mostly the same across all characters

    $row = array(
      // 'member_type' => $member['destinyUserInfo']['membershipType'],
      // 'member_id' => $member['destinyUserInfo']['membershipId'],
      'bungie_name' => $member['bungieNetUserInfo']['displayName'] ?? '',
      // 'bungie_name2' => $member['bungieNetUserInfo']['bungieGlobalDisplayName'] ?? '', // gwsar14 and cobolkevb don't have this. I don't know why. The two names are otherwise the same
      // cobolkevb no longer has bungieNetUserInfo
      'bungie_number' => $member['bungieNetUserInfo']['bungieGlobalDisplayNameCode'] ?? '',
      'bungie_url' => isset($member['bungieNetUserInfo']) ? 'https://www.bungie.net/7/en/User/Profile/' . $member['bungieNetUserInfo']['membershipType'] . '/' . $member['bungieNetUserInfo']['membershipId'] : '', // type should always be 254?
      'stadia_name' => '',
      'xbox_name' => '',
      'playstation_name' => '',
      'steam_name' => '',
      'epic_name' => '',
      // 'blizzard_name' => '',
      'twitch_name' => $profile['bungieNetUser']['twitchDisplayName'] ?? '',
      'cross_save' => $member['destinyUserInfo']['crossSaveOverride'] ? $membership_types[$member['destinyUserInfo']['crossSaveOverride']]['name'] : '',
      'last_platform' => $membership_types[$member['destinyUserInfo']['LastSeenDisplayNameType']]['name'],
      'last_seen' => date('Y-m-d H:i:s', $member['lastOnlineStatusChange']),
      'joined_clan' => date('Y-m-d H:i:s', strtotime($member['joinDate'])),
      // https://bungie-net.github.io/multi/schema_Destiny-DestinyGameVersions.html
      'owns_destiny2' => ($versions_owned & 1) && true,
      'owns_dlc_1' => ($versions_owned & 2) && true,
      'owns_dlc_2' => ($versions_owned & 4) && true,
      'owns_forsaken' => ($versions_owned & 8) && true,
      'owns_year_2_annual_pass' => ($versions_owned & 16) && true,
      'owns_shadowkeep' => ($versions_owned & 32) && true,
      'owns_beyond_light' => ($versions_owned & 64) && true,
      'owns_30th_anniversary' => ($versions_owned & 128) && true,
      'owns_witch_queen' => ($versions_owned & 256) && true,
      // 'owns_witch_queen_dungeons' => 47843291 (dummy item id), // TODO where is this reported?
      'owns_light_fall' => ($versions_owned & 512) && true,
      // 'owns_light_fall_dungeons' => , // TODO
      // 'owns_???' => ($versions_owned & 1024) && true, // just checking
      // No one has the first 7 seasons.
      // 'owns_season_1' => in_array('965757574', $season_hashes), // <No name>
      // 'owns_season_2' => in_array('2973407602', $season_hashes), // Curse of Osiris
      // 'owns_season_3' => in_array('4033618594', $season_hashes), // Resurgence
      // 'owns_season_4' => in_array('2026773320', $season_hashes), // Outlaw
      // 'owns_season_5' => in_array('2236269318', $season_hashes), // Forge
      // 'owns_season_6' => in_array('2891088360', $season_hashes), // Drifter
      // 'owns_season_7' => in_array('4275747712', $season_hashes), // Opulence
      'owns_season_8' => in_array('1743682818', $season_hashes), // Undying
      'owns_season_9' => in_array('1743682819', $season_hashes), // Dawn
      'owns_season_10' => in_array('2809059425', $season_hashes), // Worthy
      'owns_season_11' => in_array('2809059424', $season_hashes), // Arrivals
      'owns_season_12' => in_array('2809059427', $season_hashes), // Hunt
      'owns_season_13' => in_array('2809059426', $season_hashes), // Chosen
      'owns_season_14' => in_array('2809059429', $season_hashes), // Splicer
      'owns_season_15' => in_array('2809059428', $season_hashes), // Lost
      'owns_season_16' => in_array('2809059431', $season_hashes), // Risen
      'owns_season_17' => in_array('2809059430', $season_hashes), // Haunted
      'owns_season_18' => in_array('2809059433', $season_hashes), // Plunder
      'owns_season_19' => in_array('2809059432', $season_hashes), // Seraph
      'owns_season_20' => in_array('2758726568', $season_hashes), // Defiance
      'owns_season_21' => in_array('2758726569', $season_hashes), // Deep
      'owns_season_22' => in_array('2758726570', $season_hashes), // ???
      'owns_season_23' => in_array('2758726571', $season_hashes), // ???
      // Currently no other seasons in the dictionary (3/12/2023)
      'owns_solstice_2022' => in_array('3841872876', $event_card_hashes),
      'owns_festival_of_the_lost_2022' => in_array('3265920761', $event_card_hashes),
      'owns_dawning_2022' => in_array('2302439334', $event_card_hashes),
      'owns_guardian_games_2023' => in_array('3461628897', $event_card_hashes),
      // silver is only returned for logged-in profiles. $profile['platformSilver']['data'][membershipType]. Component 105
      // Find ids using: https://data.destinysets.com/
      'season_xp' => $profile['profileProgression']['data']['seasonalArtifact']['powerBonusProgression']['currentProgress'] ?? '',
      'gifted_subs' => $character_progression['progressions']['2350534509']['currentProgress'] ?? '',
      'match_reactions' => $character_progression['progressions']['1345591265']['currentProgress'] ?? '',
      // Could show current and liftimeHighest guardian ranks. profile['data']
      // I don't think dungeon keys are reported in the API
    );

    // if ($member['bungieNetUserInfo']['displayName'] === '') {
    //   echo_pretty_json($row);
    //   echo_pretty_json($member);
    //   echo_pretty_json($profile['destinyMemberships']);
    // }


    foreach ($profile['destinyMemberships'] as $membership) {
      $platform = $membership_types[$membership['membershipType']]['name'];
      $row[$platform . '_name'] = $membership['displayName'];
      if ($membership['displayName'] !== $membership['LastSeenDisplayName']) {
        echo "Non-matching names for $platform: {$membership['displayName']} | {$membership['LastSeenDisplayName']}" . PHP_EOL;
      }
    }

    $rows[] = $row;
  }

  return $rows;
}

function display_member_table($members) {
  $rows = array();

  foreach($members as $member) {
    $rows[] = array(
      'Bungie' => get_name_span($member, 'bungie'),
      'Stadia' => get_name_span($member, 'stadia'),
      'Xbox' => get_name_span($member, 'xbox'),
      'PlayStation' => get_name_span($member, 'playstation'),
      'Steam' => get_name_span($member, 'steam'),
      'Epic' => get_name_span($member, 'epic'),
      'Twitch' => get_name_span($member, 'twitch'),
      'Cross-save' => ucfirst($member['cross_save']),
      'Last Platform' => ucfirst($member['last_platform']),
      'Destiny 2' => $member['owns_destiny2'] ? 'Yes' : '',
      'DLC1' => $member['owns_dlc_1'] ? 'Yes' : '',
      'DLC2' => $member['owns_dlc_2'] ? 'Yes' : '',
      'Forsaken' => $member['owns_forsaken'] ? 'Yes' : '',
      'Year 2 Annual Pass' => $member['owns_year_2_annual_pass'] ? 'Yes' : '',
      'Shadowkeep' => $member['owns_shadowkeep'] ? 'Yes' : '',
      'Beyond Light' => $member['owns_beyond_light'] ? 'Yes' : '',
      '30th Anniversary' => $member['owns_30th_anniversary'] ? 'Yes' : '',
      'Witch Queen' => $member['owns_witch_queen'] ? 'Yes' : '',
      // 'WQ Dungeons' => $member['owns_witch_queen_dungeons'] ? 'Yes' : '',
      'Light Fall' => $member['owns_light_fall'] ? 'Yes' : '',
      // 'LF Dungeons' => $member['owns_light_fall_dungeons'] ? 'Yes' : '',
      // 'Owns ???' => $member['owns_???'] ? 'Yes' : '',
      // 'Season 1' => $member['owns_season_1'] ? 'Yes' : '',
      // 'Season 2' => $member['owns_season_2'] ? 'Yes' : '',
      // 'Season 3' => $member['owns_season_3'] ? 'Yes' : '',
      // 'Season 4' => $member['owns_season_4'] ? 'Yes' : '',
      // 'Season 5' => $member['owns_season_5'] ? 'Yes' : '',
      // 'Season 6' => $member['owns_season_6'] ? 'Yes' : '',
      // 'Season 7' => $member['owns_season_7'] ? 'Yes' : '',
      'Season 8' => $member['owns_season_8'] ? 'Yes' : '',
      'Season 9' => $member['owns_season_9'] ? 'Yes' : '',
      'Season 10' => $member['owns_season_10'] ? 'Yes' : '',
      'Season 11' => $member['owns_season_11'] ? 'Yes' : '',
      'Season 12' => $member['owns_season_12'] ? 'Yes' : '',
      'Season 13' => $member['owns_season_13'] ? 'Yes' : '',
      'Season 14' => $member['owns_season_14'] ? 'Yes' : '',
      'Season 15' => $member['owns_season_15'] ? 'Yes' : '',
      'Season 16' => $member['owns_season_16'] ? 'Yes' : '',
      'Season 17' => $member['owns_season_17'] ? 'Yes' : '',
      'Season 18' => $member['owns_season_18'] ? 'Yes' : '',
      'Season 19' => $member['owns_season_19'] ? 'Yes' : '',
      'Season 20' => $member['owns_season_20'] ? 'Yes' : '',
      'Season 21' => $member['owns_season_21'] ? 'Yes' : '',
      'Season 22' => $member['owns_season_22'] ? 'Yes' : '',
      'Season 23' => $member['owns_season_23'] ? 'Yes' : '',
      'Solstice 2022' => $member['owns_solstice_2022'] ? 'Yes' : '',
      'FotL 2022' => $member['owns_festival_of_the_lost_2022'] ? 'Yes' : '',
      'Dawning 2022' => $member['owns_dawning_2022'] ? 'Yes' : '',
      'GG 2023' => $member['owns_guardian_games_2023'] ? 'Yes' : '',
      'Seasonal Level' => is_numeric($member['season_xp']) ? number_format($member['season_xp'] / 100000, 2) : $member['season_xp'],
      'Gifted Subs' => $member['gifted_subs'],
      'Match Reactions' => $member['match_reactions'],
    );
  }

  // TODO Put icons in the header?
  display_table($rows);

  echo "</br>" . PHP_EOL;
  echo "Note: Entitlements are for the most recently logged-in platform </br>" . PHP_EOL;
  echo "Stadia pro seasons may not show up when not on stadia or there is no stadia pro active" . PHP_EOL;
}


function get_name_span($member, $type) {
  $name = $member[$type.'_name'];
  $number = '';
  $href = '';

  if ($type === 'bungie') {
    $number = get_number_span($member['bungie_number']);
    $url = $member['bungie_url'];
  } else if ($type === 'stadia') {
    $parts = explode('#', $name);
    if (count($parts) > 1) {
      $number = get_number_span(array_pop($parts)); // The stuff after the last #
    }
    $name = implode('#', $parts);
    // $url = 'https://stadia.google.com/profile/' . '7992987864485636980'; // I don't think stadia supports friendly urls
    // Might be able to use javascript and search to make it work in a delayed fashion?
    // Nothing here: https://developers.google.com/apis-explorer
    // Nothing here: https://github.com/googleapis
    // Profile and search results here: https://stadia.google.com/_/CloudcastPortalFeWebUi/data/batchexecute
    // https://kovatch.medium.com/deciphering-google-batchexecute-74991e4e446c
  } else if ($type === 'xbox') {
    $url = 'https://account.xbox.com/en-us/profile?gamertag='.$name;
  } else if ($type === 'steam') {
    // $url = 'https://steamcommunity.com/id/'.$name; // This won't always work
    $url = 'https://steamcommunity.com/search/users/#text='.$name;
  } else if ($type === 'twitch') {
    $url = 'https://www.twitch.tv/'.$name;
  }
  // PlayStation does not have profiles on the web

  $span = '<span style="color:black;margin-right:10px">'.$name.$number.'</a>';

  if (!empty($url)) {
    $href = 'href="'.$url.'"';
  }

  return '<a '.$href.'>'.$span.'</a>';
}
function get_number_span($number, $color='lightgrey') { // royalblue?
  if ($number === '' || $number === null) { // 0 is a real number
    return '';
  }

  $number = str_pad($number, 4, '0', STR_PAD_LEFT);

  $result = '<span style="color:lightgrey">#</span>';
  $result .= '<span style="color:'.$color.'">';
  $result .= $number;
  $result .= '</span>';
  return $result;
}

// Requires extra login. Not sure how to do that. Contains real name (facebook) for self. Does include steam id (credentialAsString) and twitch name for others.
// credentialType is different than membership type. https://bungie-net.github.io/multi/schema_BungieCredentialType.html#schema_BungieCredentialType
// $result = bungie_api::api('/User/GetCredentialTypesForTargetAccount/31110/'); // kalium bungie
// echo_pretty_json($result);
// $result = bungie_api::api('/User/GetMembershipFromHardLinkedCredential/SteamId/76561198057090403/'); # kalium. Wrong direction: Steam => Bungie.
// echo_pretty_json($result);

