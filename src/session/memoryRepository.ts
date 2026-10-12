// In-memory repository: used for tests and as an explicitly labelled memory-only fallback
// when browser storage is unavailable. Nothing here survives a page reload.
import type { AnyEvent } from '../engine/types.ts';
import { PersistenceError, type LockStatus, type SessionMeta, type SessionRepository } from './repository.ts';

export class MemorySessionRepository implements SessionRepository {
  readonly kind = 'memory' as const;
  failNextWrites = 0;
  private events = new Map<string, AnyEvent[]>();
  private metas = new Map<string, SessionMeta>();
  private drafts = new Map<string, Record<string, unknown>>();
  private active: string | null = null;

  listSessions(): SessionMeta[] {
    return [...this.metas.values()];
  }
  loadEvents(sessionId: string): AnyEvent[] {
    return [...(this.events.get(sessionId) ?? [])];
  }
  append(sessionId: string, events: AnyEvent[], expectedLastSequence: number): void {
    if (this.failNextWrites > 0) {
      this.failNextWrites -= 1;
      throw new PersistenceError('Simulated storage failure.', 'write_failed');
    }
    const cur = this.events.get(sessionId) ?? [];
    if (cur.length !== expectedLastSequence) throw new PersistenceError('Session log changed elsewhere.', 'conflict');
    this.events.set(sessionId, [...cur, ...events]);
  }
  saveMeta(meta: SessionMeta): void {
    this.metas.set(meta.session_id, meta);
  }
  loadDrafts(sessionId: string): Record<string, unknown> {
    return { ...(this.drafts.get(sessionId) ?? {}) };
  }
  saveDrafts(sessionId: string, drafts: Record<string, unknown>): void {
    this.drafts.set(sessionId, { ...drafts });
  }
  getActiveSessionId(): string | null {
    return this.active;
  }
  setActiveSessionId(id: string | null): void {
    this.active = id;
  }
  acquireLock(): LockStatus {
    return { ok: true, heldByOtherTab: false };
  }
  releaseLock(): void {}
}
