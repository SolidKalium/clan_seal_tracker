<?php

include 'include.php';

$format = strtolower($_GET['format'] ?? 'member_table');
$force_refresh = isset($_GET['refresh']);

$members = get_clan_members($force_refresh);
array_multisort(array_column($members, 'joined_clan'), SORT_ASC, $members);

if ($format === 'csv') {
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
    // echo_pretty_json($member);
    $row = array(
      // 'member_type' => $member['destinyUserInfo']['membershipType'],
      // 'member_id' => $member['destinyUserInfo']['membershipId'],
      'bungie_name' => $member['bungieNetUserInfo']['displayName'] ?? '',
      // 'bungie_name2' => $member['bungieNetUserInfo']['bungieGlobalDisplayName'] ?? '', // gwsar14 and cobolkevb don't have this. I don't know why. The two names are otherwise the same
      // cobolkevb no longer has bungieNetUserInfo
      'bungie_number' => $member['bungieNetUserInfo']['bungieGlobalDisplayNameCode'] ?? '',
      'bungie_url' => isset($member['bungieNetUserInfo']) ? 'https://www.bungie.net/7/en/User/Profile/' . $member['bungieNetUserInfo']['membershipType'] . '/' . $member['bungieNetUserInfo']['membershipId'] : null, // type should always 254?
      'stadia_name' => '',
      'xbox_name' => '',
      'playstation_name' => '',
      'steam_name' => '',
      'epic_name' => '',
      // 'blizzard_name' => '',
      'last_seen' => date('Y-m-d H:i:s', $member['lastOnlineStatusChange']),
      'joined_clan' => date('Y-m-d H:i:s', strtotime($member['joinDate'])),
    );

    $profile = profiles::get($member['destinyUserInfo']['membershipType'], $member['destinyUserInfo']['membershipId']);

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
    );
  }

  // TODO Put icons in the header?
  display_table($rows);
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

