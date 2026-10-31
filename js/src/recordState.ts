export interface RecordCondition { code: 'unowned' | 'hidden' | 'obscured'; label: string; description: string }
// DestinyRecordState flags. These describe visibility/permissions, not missing profile data.
const flags: readonly (readonly [number, RecordCondition['code'], string, string])[] = [
  [32, 'unowned', 'Content locked', 'Bungie reports a missing entitlement or permission, such as required DLC.'],
  [16, 'hidden', 'Hidden in game', 'Bungie marks this triumph as hidden in game. Its progress is still shown here.'],
  [8, 'obscured', 'Obscured in game', 'Bungie marks this triumph’s details as obscured in game.'],
];
export function recordConditions(state: number): RecordCondition[] {
  return flags.filter(([bit]) => !!(state & bit)).map(([, code, label, description]) => ({ code, label, description }));
}
