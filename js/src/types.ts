export interface Color { red: number; green: number; blue: number; alpha: number }
export interface GuardianRankDefinition { hash: number; rankNumber: number; presentationNodeHash: number; displayProperties: Display }
export interface ChecklistDefinition { hash: number; scope: number; displayProperties: Display; entries: { hash: number; scope: number; displayProperties: Display }[] }
export interface CommendationDefinition { hash: number; displayProperties: Display; parentCommendationNodeHash?: number; childCommendationHashes?: number[]; childCommendationNodeHashes?: number[]; color?: Color; displayActivities?: Display[]; displayPriority?: number }
export interface Commendations { totalScore?: number; scoreDetailValues?: number[]; commendationNodeScoresByHash?: Record<string, number>; commendationNodePercentagesByHash?: Record<string, number>; commendationScoresByHash?: Record<string, number> }
export interface Display { name: string; description?: string; icon?: string }
export interface ObjectiveDefinition { hash: number; completionValue: number; progressDescription?: string; displayProperties?: Display }
export interface RecordDefinition {
  hash: number; displayProperties: Display; scope: number; recordTypeName?: string; forTitleGilding?: boolean;
  objectiveHashes?: number[]; intervalInfo?: { intervalObjectives: { intervalObjectiveHash: number }[] };
  titleInfo?: { titlesByGender?: Record<string, string>; gildingTrackingRecordHash?: number };
}
export interface NodeDefinition {
  hash: number; displayProperties: Display; completionRecordHash: number;
  children: { records?: { recordHash: number }[]; presentationNodes?: { presentationNodeHash: number }[]; collectibles?: { collectibleHash: number }[] };
}
export interface Manifest { version: string; jsonWorldComponentContentPaths: Record<string, Record<string, string>> }
export interface Definitions {
  otherDefinitionsVersion?: number; guardianRanks?: Record<string, GuardianRankDefinition>; checklists?: Record<string, ChecklistDefinition>; commendations?: Record<string, CommendationDefinition>; commendationNodes?: Record<string, CommendationDefinition>;
  version: string; language: string;
  collectibles?: Record<string, { hash: number; displayProperties: Display; scope: number; sourceString?: string; itemHash?: number }>;
  items?: Record<string, { displayProperties: Display; itemTypeDisplayName?: string; itemType?: number; perks?: { perkHash: number }[] }>;
  perks?: Record<string, { displayProperties: Display }>;
  nodes: Record<string, NodeDefinition>; records: Record<string, RecordDefinition>; objectives: Record<string, ObjectiveDefinition>;
}
export interface ObjectiveProgress { objectiveHash: number; progress: number; completionValue: number; complete: boolean }
export interface RecordProgress { completedCount?: number | null; state: number; objectives?: ObjectiveProgress[]; intervalObjectives?: ObjectiveProgress[]; intervalsRedeemedCount?: number }
export interface UserInfo { membershipType: number; membershipId: string; displayName: string; bungieGlobalDisplayName?: string; bungieGlobalDisplayNameCode?: number; crossSaveOverride?: number }
export interface Member { joinDate?: string; memberType?: number; destinyUserInfo: UserInfo; isOnline?: boolean; lastOnlineStatusChange?: string }
export interface Roster { name: string; members: Member[]; emblem?: import('./clanBanner').ClanEmblemData; emblemChecked?: boolean }
export interface Profile {
  profileProgression?: { data?: { checklists?: Record<string, Record<string, boolean>> }; privacy?: number };
  characterProgressions?: { data?: Record<string, { checklists?: Record<string, Record<string, boolean>> }>; privacy?: number };
  profileCommendations?: { data?: Commendations; privacy?: number };
  profileStringVariables?: { data?: { integerValuesByHash?: Record<string, number> }; privacy?: number };
  characterStringVariables?: { data?: Record<string, { integerValuesByHash?: Record<string, number> }>; privacy?: number };
  profileCollectibles?: { data?: { collectibles: Record<string, { state: number }> }; privacy?: number };
  characterCollectibles?: { data?: Record<string, { collectibles: Record<string, { state: number }> }>; privacy?: number };
  profile?: { data?: { userInfo: UserInfo; dateLastPlayed?: string; currentGuardianRank?: number; renewedGuardianRank?: number; lifetimeHighestGuardianRank?: number }; privacy?: number };
  profileRecords?: { data?: { records: Record<string, RecordProgress> }; privacy?: number };
  characterRecords?: { data?: Record<string, { records: Record<string, RecordProgress> }>; privacy?: number };
}
export interface PageConfig { groupByNode?: boolean; kind?: 'ranks' | 'commendations'; guardianRank?: number; checklistHash?: string; parentPageId?: string; tabLabel?: string; seasonNumber?: number; id: string; name: string; category: string; sealNodeHash?: string; unavailableReason?: string; badgeNodeHash?: string; otherNodeHashes?: string[]; collectibles?: Record<string, { column_name?: string; suppress?: boolean; skip_for_completion?: boolean } | undefined>; records: Record<string, { column_name?: string; suppress?: boolean; skip_for_completion?: boolean; order?: number } | undefined> }
export interface Heading { alternativeCollectibleHashes?: string[]; pattern?: { hash: string; scope: number }; hiddenObjectiveHashes?: string[]; recordType?: string; seals?: import('./sealMembership').SealMembership[]; metric?: 'gildingCount' | 'gilded' | 'guardianRank' | 'commendation'; metricKey?: string; checklist?: { hash: string; entryHash: string }; color?: string; armorSetKey?: string; armorSetName?: string; badgeRequirement?: boolean; group?: string; source?: string; itemType?: string; perks?: Display[]; collectibleHashes?: string[]; classNames?: string[]; classIcons?: (string | undefined)[]; hash: string; name: string; label: string; description: string; scope: number; gilding: boolean; skip: boolean; order: number; objectives: ObjectiveDefinition[]; intervals: ObjectiveDefinition[] }
export interface Seal { requirements?: import('./completion').SealRequirements; legacy?: boolean; page: PageConfig; title: string; description: string; icon?: string; completionHash: string; completionScope?: number; headings: Heading[]; unavailable?: string }
export type DataStatus = 'fresh' | 'cached' | 'stale' | 'private' | 'unavailable';
export interface Cached<T> { key: string; value: T; fetchedAt: number; components?: number[]; lastAttemptAt?: number; error?: string; errorInfo?: import('./diagnostics').RequestDiagnostic; private?: boolean }
export interface LoadResult<T> { entry?: Cached<T>; status: DataStatus; error?: string }
export interface PlayerData { member: Member; profile?: Profile; status: DataStatus | 'loading'; fetchedAt?: number; error?: string }
export interface ObjectiveCell { hash: string; name: string; progress: number; target: number; complete: boolean; missing: boolean; text: string; fraction: number }
export interface Cell { patternUnlocked?: boolean; scoringClass?: { name: string; icon?: string; armorFraction?: number; best: boolean }; conditions?: import('./recordState').RecordCondition[]; unclaimed?: boolean; variants?: { name: string; icon?: string; complete: boolean; missing: boolean; setComplete: boolean; setMissing: boolean }[]; objectives: ObjectiveCell[]; fraction: number; complete: boolean; missing: boolean; text: string; detail: string; unowned: boolean }
