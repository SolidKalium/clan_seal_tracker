<?php

include 'include.php';

// $get_csv = 
$members = get_clan_members();

array_multisort(array_column($members, 'joined_clan'), SORT_ASC, $members);

// TODO make sorting or view type configurable via url?
// echo get_csv($members), PHP_EOL;
// display_table($members);
display_member_table($members);



function get_clan_members() {
  $members = groups::get_group_members(4331943);

  $membership_types = array(
    1 => array('name' => 'xbox', 'icon' => 'xboxLiveLogo'),
    2 => array('name' => 'playstation', 'icon' =>  'psnLogo'),
    3 => array('name' => 'steam', 'icon' =>  'steamLogo'),
    4 => array('name' => 'blizzard', 'icon' =>  ''), // DEPRECATED. This info is no longer returned
    5 => array('name' => 'stadia', 'icon' => 'icon_stadia'),
  );

  foreach ($members as $member) {
    $row = array(
      // 'member_type' => $member['destinyUserInfo']['membershipType'],
      // 'member_id' => $member['destinyUserInfo']['membershipId'],
      'bungie_name' => $member['bungieNetUserInfo']['displayName'],
      // 'bungie_name2' => $member['bungieNetUserInfo']['bungieGlobalDisplayName'] ?? '', // gwsar14 and cobolkevb don't have this. I don't know why. The two names are otherwise the same
      'bungie_number' => $member['bungieNetUserInfo']['bungieGlobalDisplayNameCode'] ?? '',
      'bungie_url' => 'https://www.bungie.net/7/en/User/Profile/' . $member['bungieNetUserInfo']['membershipType'] . '/' . $member['bungieNetUserInfo']['membershipId'], // type should always 254?
      'stadia_name' => '',
      'xbox_name' => '',
      'playstation_name' => '',
      'steam_name' => '',
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

// Requires extra login. Not sure how to do that.
// $result = bungie_api::api('/User/GetCredentialTypesForTargetAccount/4611686018495301011/'); // cpTylor stadia
// echo_pretty_json($result);
// $result = bungie_api::api('/User/GetCredentialTypesForTargetAccount/4611686018518157364/'); // cpTylor steam
// echo_pretty_json($result);
// $result = bungie_api::api('/User/GetMembershipFromHardLinkedCredential/SteamId/76561198057090403/'); # kalium. Wrong direction: Steam => Bungie.
// echo_pretty_json($result);

