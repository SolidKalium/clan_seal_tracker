<?php

function exception_error_handler($errno, $errstr, $errfile, $errline ) {
  echo '<pre>';
  throw new ErrorException($errstr, 0, $errno, $errfile, $errline);
}
set_error_handler("exception_error_handler");


include_once 'library/bungie_api.php';
include_once 'library/definitions.php';
include_once 'library/profiles.php';


function echo_pretty_json(...$jsons) {
  foreach ($jsons as $json) {
    echo '<pre>' . htmlspecialchars(json_encode($json, JSON_PRETTY_PRINT)) . PHP_EOL . PHP_EOL . '</pre>';
  }
}

function display_table($rows) {
  if (empty($rows)) {
    echo 'No data to display' . PHP_EOL;
    return;
  }

  $keys = array_keys(array_merge(...array_map('array_flip', array_map('array_keys', $rows))));
  
  $html = '<table><thead><tr><th>' . implode('</th><th>', $keys) . '</th></tr></thead><tbody>';
  foreach ($rows as $row) {
    $html .= '<tr>';
    foreach ($keys as $key) {
      $value = $row[$key] ?? '';
      if (is_array($value)) { $value = json_encode($value); }
      $html .= '<td>' . $value . '</td>';
    }
    $html .= '</tr>';
  }
  $html .= '</tbody></table>';

  echo $html;
}



function enable_implicit_flush() {
  // @apache_setenv('no-gzip', 1);
  @ini_set('zlib.output_compression', 0);
  @ini_set('implicit_flush', 1);
  for ($i = 0; $i < ob_get_level(); $i++) { ob_end_flush(); }
  ob_implicit_flush(1);
}

