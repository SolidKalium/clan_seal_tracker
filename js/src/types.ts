export interface Display { name: string; description?: string; icon?: string }
export interface ObjectiveDefinition { hash: number; completionValue: number; progressDescription?: string; displayProperties?: Display }
export interface RecordDefinition {
  hash: number; displayProperties: Display; scope: number; forTitleGilding?: boolean;
  objectiveHashes?: number[]; intervalInfo?: { intervalObjectives: { intervalObjectiveHash: number }[] };
  titleInfo?: { titlesByGender?: Record<string, string>; gildingTrackingRecordHash?: number };
}
export interface NodeDefinition {
  hash: number; displayProperties: Display; completionRecordHash: number;
  children: { records?: { recordHash: number }[] };
}
export interface Manifest { version: string; jsonWorldComponentContentPaths: Record<string, Record<string, string>> }
export interface Definitions {
  version: string; language: string;
  nodes: Record<string, NodeDefinition>; records: Record<string, RecordDefinition>; objectives: Record<string, ObjectiveDefinition>;
}
export interface ObjectiveProgress { objectiveHash: number; progress: number; completionValue: number; complete: boolean }
export interface RecordProgress { state: number; objectives?: ObjectiveProgress[]; intervalObjectives?: ObjectiveProgress[]; intervalsRedeemedCount?: number }
export interface UserInfo { membershipType: number; membershipId: string; displayName: string; bungieGlobalDisplayName?: string; bungieGlobalDisplayNameCode?: number; crossSaveOverride?: number }
export interface Member { destinyUserInfo: UserInfo; isOnline?: boolean; lastOnlineStatusChange?: string }
export interface Roster { name: string; members: Member[] }
export interface Profile {
  profile?: { data?: { userInfo: UserInfo; dateLastPlayed?: string }; privacy?: number };
  profileRecords?: { data?: { records: Record<string, RecordProgress> }; privacy?: number };
  characterRecords?: { data?: Record<string, { records: Record<string, RecordProgress> }>; privacy?: number };
}
export interface PageConfig { id: string; name: string; category: string; sealNodeHash: string; records: Record<string, { column_name?: string; suppress?: boolean; skip_for_completion?: boolean; order?: number } | undefined> }
export interface Heading { hash: string; name: string; label: string; description: string; scope: number; gilding: boolean; skip: boolean; order: number; objectives: ObjectiveDefinition[]; intervals: ObjectiveDefinition[] }
export interface Seal { page: PageConfig; title: string; description: string; icon?: string; completionHash: string; headings: Heading[]; unavailable?: string }
export type DataStatus = 'fresh' | 'cached' | 'stale' | 'private' | 'unavailable';
export interface Cached<T> { key: string; value: T; fetchedAt: number; components?: number[]; lastAttemptAt?: number; error?: string; private?: boolean }
export interface LoadResult<T> { entry?: Cached<T>; status: DataStatus; error?: string }
export interface PlayerData { member: Member; profile?: Profile; status: DataStatus | 'loading'; fetchedAt?: number; error?: string }
export interface Cell { fraction: number; complete: boolean; missing: boolean; text: string; detail: string; unowned: boolean }
