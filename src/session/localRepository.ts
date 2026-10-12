// Browser localStorage repository. Each session's event log is one key, written in a single
// setItem call so an append is all-or-nothing. Local storage is for demonstration only: it can be
// cleared by the browser and is not a research-grade immutable database.
import type { AnyEvent } from '../engine/types.ts';
import { PersistenceError, validateEventLog, type LockStatus, type SessionMeta, type SessionRepository } from './repository.ts';

const PREFIX = 'edt.lum.v1';
const LOCK_TTL_MS = 15000;

export class LocalSessionRepository implements SessionRepository {
  readonly kind = 'local' as const;
  failNextWrites = 0;
  constructor(private readonly storage: Storage) {}

  static tryCreate(): LocalSessionRepository | null {
    try {
      const s = window.localStorage;
      const probe = `${PREFIX}.probe`;
      s.setItem(probe, '1');
      s.removeItem(probe);
      return new LocalSessionRepository(s);
    } catch {
      return null;
    }
  }

  private k(...parts: string[]) {
    return [PREFIX, ...parts].join('.');
  }

  private read<T>(key: string, fallback: T): T {
    const raw = this.storage.getItem(key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new PersistenceError(`Stored data at ${key} could not be read.`, 'corrupt');
    }
  }

  private write(key: string, value: unknown) {
    try {
      this.storage.setItem(key, JSON.stringify(value));
    } catch (err) {
      throw new PersistenceError(`Browser storage rejected the write (${(err as Error).message}).`, 'write_failed');
    }
  }

  listSessions(): SessionMeta[] {
    const ids = this.read<string[]>(this.k('index'), []);
    return ids
      .map((id) => {
        try {
          return this.read<SessionMeta | null>(this.k('meta', id), null);
        } catch {
          return null;
        }
      })
      .filter((m): m is SessionMeta => m !== null);
  }

  loadEvents(sessionId: string): AnyEvent[] {
    return validateEventLog(this.read<unknown>(this.k('events', sessionId), []), sessionId);
  }

  append(sessionId: string, events: AnyEvent[], expectedLastSequence: number): void {
    if (this.failNextWrites > 0) {
      this.failNextWrites -= 1;
      throw new PersistenceError('Simulated storage failure (developer review).', 'write_failed');
    }
    const key = this.k('events', sessionId);
    const current = this.read<unknown[]>(key, []);
    if (current.length !== expectedLastSequence) {
      throw new PersistenceError('This session was changed in another tab or window.', 'conflict');
    }
    this.write(key, [...current, ...events]);
    const ids = this.read<string[]>(this.k('index'), []);
    if (!ids.includes(sessionId)) this.write(this.k('index'), [...ids, sessionId]);
  }

  saveMeta(meta: SessionMeta): void {
    this.write(this.k('meta', meta.session_id), meta);
  }

  loadDrafts(sessionId: string): Record<string, unknown> {
    try {
      return this.read<Record<string, unknown>>(this.k('drafts', sessionId), {});
    } catch {
      return {};
    }
  }

  saveDrafts(sessionId: string, drafts: Record<string, unknown>): void {
    this.write(this.k('drafts', sessionId), drafts);
  }

  getActiveSessionId(): string | null {
    return this.storage.getItem(this.k('active'));
  }

  setActiveSessionId(id: string | null): void {
    if (id === null) this.storage.removeItem(this.k('active'));
    else this.storage.setItem(this.k('active'), id);
  }

  acquireLock(sessionId: string, tabId: string, force: boolean): LockStatus {
    const key = this.k('lock', sessionId);
    const lock = (() => {
      try {
        return this.read<{ tab: string; at: number } | null>(key, null);
      } catch {
        return null;
      }
    })();
    const fresh = lock !== null && Date.now() - lock.at < LOCK_TTL_MS;
    if (fresh && lock && lock.tab !== tabId && !force) return { ok: false, heldByOtherTab: true };
    try {
      this.write(key, { tab: tabId, at: Date.now() });
    } catch {
      /* lock is advisory */
    }
    return { ok: true, heldByOtherTab: false };
  }

  releaseLock(sessionId: string, tabId: string): void {
    try {
      const key = this.k('lock', sessionId);
      const lock = this.read<{ tab: string } | null>(key, null);
      if (lock?.tab === tabId) this.storage.removeItem(key);
    } catch {
      /* ignore */
    }
  }

  /** Key prefix of a session's event log, used to detect writes from other tabs. */
  eventsKey(sessionId: string): string {
    return this.k('events', sessionId);
  }
}
