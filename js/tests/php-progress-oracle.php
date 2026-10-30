<?php
// Evaluate the existing calculation without invoking index.php's rendering/API side effects.
$source = file_get_contents(__DIR__ . '/../../index.php');
$start = strpos($source, 'function estimate_player_record_progress(');
$end = strpos($source, 'function update_player_data_for_checklist_heading(', $start);
if ($start === false || $end === false) { throw new Exception('Legacy calculation could not be located'); }
eval(substr($source, $start, $end - $start));
$records = json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);
echo json_encode(array_map('estimate_player_record_progress', $records), JSON_THROW_ON_ERROR);
