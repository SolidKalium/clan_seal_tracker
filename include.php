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

