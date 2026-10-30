import Dexie, { type Table } from 'dexie';
import type { Cached } from './types';

export class TrackerDatabase extends Dexie {
  entries!: Table<Cached<unknown>, string>;
  preferences!: Table<{ key: string; value: unknown }, string>;
  constructor(name = 'clan-seal-tracker-v1') {
    super(name);
    this.version(1).stores({ entries: 'key, fetchedAt', preferences: 'key' });
  }
}
export class CacheStore {
  readonly db: TrackerDatabase;
  warning = '';
  private memory = new Map<string, Cached<unknown>>();
  private persistent = true;
  constructor(name?: string) { this.db = new TrackerDatabase(name); }
  private failed() { this.persistent = false; this.warning = 'Browser storage is unavailable or full. This session is using memory; cached data may not survive a reload.'; }
  async get<T>(key: string): Promise<Cached<T> | undefined> {
    if (this.memory.has(key)) return this.memory.get(key) as Cached<T>;
    if (this.persistent) {
      try {
        const value = await this.db.entries.get(key);
        if (value) this.memory.set(key, value);
        return value as Cached<T> | undefined;
      } catch { this.failed(); }
    }
  }
  async put<T>(entry: Cached<T>): Promise<void> {
    this.memory.set(entry.key, entry);
    if (this.persistent) try { await this.db.entries.put(entry as Cached<unknown>); } catch { this.failed(); }
  }
  async preference<T>(key: string, fallback: T): Promise<T> {
    if (this.persistent) try { return (await this.db.preferences.get(key))?.value as T ?? fallback; } catch { this.failed(); }
    return fallback;
  }
  async setPreference(key: string, value: unknown) {
    if (this.persistent) try { await this.db.preferences.put({ key, value }); } catch { this.failed(); }
  }
  async clearCache() {
    this.memory.clear();
    if (this.persistent) try { await this.db.entries.clear(); } catch { this.failed(); }
  }
}
