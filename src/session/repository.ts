// SessionRepository adapter boundary. Local storage today; a server (e.g. Supabase) can implement
// the same interface later without changing the educational flow.
import type { AnyEvent, SessionKind, SessionState } from '../engine/types.ts';

export interface SessionMeta {
  session_id: string;
  participant_code: string;
  session_kind: SessionKind;
  started_at_utc: string;
  updated_at_utc: string;
  stage: string;
  status: SessionState['status'];
  event_count: number;
}

export class PersistenceError extends Error {
  constructor(message: string, readonly kind: 'write_failed' | 'conflict' | 'corrupt' | 'unavailable') {
    super(message);
  }
}

export interface LockStatus {
  ok: boolean;
  heldByOtherTab: boolean;
}

export interface SessionRepository {
  readonly kind: 'local' | 'memory';
  /** Developer review hook: the next N writes fail (used to verify AT24). */
  failNextWrites: number;
  listSessions(): SessionMeta[];
  loadEvents(sessionId: string): AnyEvent[];
  /** Atomic append. Throws PersistenceError('conflict') if the stored log is not at expectedLastSequence. */
  append(sessionId: string, events: AnyEvent[], expectedLastSequence: number): void;
  saveMeta(meta: SessionMeta): void;
  loadDrafts(sessionId: string): Record<string, unknown>;
  saveDrafts(sessionId: string, drafts: Record<string, unknown>): void;
  getActiveSessionId(): string | null;
  setActiveSessionId(id: string | null): void;
  acquireLock(sessionId: string, tabId: string, force: boolean): LockStatus;
  releaseLock(sessionId: string, tabId: string): void;
}

export function validateEventLog(events: unknown, sessionId: string): AnyEvent[] {
  if (!Array.isArray(events)) throw new PersistenceError('Stored session is not an event list.', 'corrupt');
  events.forEach((e, i) => {
    const ev = e as Partial<AnyEvent>;
    if (
      !ev ||
      typeof ev.event_id !== 'string' ||
      typeof ev.event_type !== 'string' ||
      typeof ev.sequence !== 'number' ||
      ev.session_id !== sessionId ||
      ev.sequence !== i + 1 ||
      typeof ev.payload !== 'object'
    ) {
      throw new PersistenceError(`Stored event ${i + 1} is malformed or out of order.`, 'corrupt');
    }
  });
  return events as AnyEvent[];
}
