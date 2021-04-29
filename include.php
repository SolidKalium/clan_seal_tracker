<?php

function exception_error_handler($errno, $errstr, $errfile, $errline ) {
  echo '<pre>';
  throw new ErrorException($errstr, 0, $errno, $errfile, $errline);
}
set_error_handler("exception_error_handler");


include_once 'bungie_api.php';
include_once 'definitions.php';
include_once 'profiles.php';


function echo_pretty_json($json) {
  echo '<pre>' . htmlspecialchars(json_encode($json, JSON_PRETTY_PRINT)) . PHP_EOL . PHP_EOL . '</pre>';
}

function enable_implicit_flush() {
  // @apache_setenv('no-gzip', 1);
  @ini_set('zlib.output_compression', 0);
  @ini_set('implicit_flush', 1);
  for ($i = 0; $i < ob_get_level(); $i++) { ob_end_flush(); }
  ob_implicit_flush(1);
}

