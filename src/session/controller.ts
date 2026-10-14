// SessionController: the only path by which events enter the log.
// Commands produce drafts -> drafts are stamped -> the batch is persisted atomically -> only then
// does in-memory state change. A persistence failure therefore cannot produce an unrecorded reveal.
import { CASE_ID, CONTENT_VERSION } from '../case/versions.ts';
import type { CommandContext, CommandResult } from '../engine/commands.ts';
import { applyEvent, foldEvents, initialState } from '../engine/reducer.ts';
import { TUTOR_EVENT_TYPES, type AnyEvent, type EventDraft, type SessionState } from '../engine/types.ts';
import { PersistenceError, type SessionMeta, type SessionRepository } from './repository.ts';

export type DispatchResult = { ok: true; events: AnyEvent[] } | { ok: false; code: string; message: string };
export type SaveStatus = 'idle' | 'saved' | 'failed' | 'memory_only' | 'conflict';

export interface IdSource {
  newId(prefix: string): string;
  now(): string;
}

export const defaultIds: IdSource = {
  newId(prefix: string) {
    const c = globalThis.crypto as Crypto | undefined;
    const raw = c?.randomUUID ? c.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    return `${prefix}-${raw}`;
  },
  now: () => new Date().toISOString(),
};

/** Deterministic id/time source for tests and the reference fixture. */
export function sequentialIds(startIso = '2026-10-12T12:00:00.000Z', stepMs = 15000): IdSource {
  let n = 0;
  let t = Date.parse(startIso);
  return {
    newId: (prefix) => `${prefix}-${String(++n).padStart(4, '0')}`,
    now: () => {
      const iso = new Date(t).toISOString();
      t += stepMs;
      return iso;
    },
  };
}

export function stampDrafts(
  state: SessionState,
  drafts: EventDraft[],
  sessionId: string,
  ids: IdSource,
): { events: AnyEvent[]; next: SessionState } {
  const transactionId = ids.newId('txn');
  const timestamp = ids.now();
  let cur = state;
  const out: AnyEvent[] = [];
  for (const d of drafts) {
    const before = cur.stage;
    const provisional = {
      event_id: ids.newId('evt'),
      session_id: sessionId,
      sequence: cur.lastSequence + 1,
      transaction_id: transactionId,
      event_type: d.event_type,
      source: d.source,
      timestamp_utc: timestamp,
      simulated_time: cur.simTime.code,
      case_id: CASE_ID,
      content_version: cur.versions?.content_version ?? CONTENT_VERSION,
      state_before: before,
      state_after: before,
      payload: d.payload,
    } as AnyEvent;
    const next = applyEvent(cur, provisional);
    const ev = { ...provisional, state_after: next.stage, simulated_time: next.simTime.code } as AnyEvent;
    out.push(ev);
    cur = applyEvent(cur, ev);
  }
  return { events: out, next: cur };
}

type Listener = () => void;

export class SessionController {
  private events: AnyEvent[] = [];
  private _state: SessionState = initialState();
  private listeners = new Set<Listener>();
  private _saveStatus: SaveStatus;
  private _lastError: string | null = null;
  private _drafts: Record<string, unknown> = {};
  private _readOnly = false;
  readonly tabId: string;

  constructor(
    readonly repo: SessionRepository,
    readonly ids: IdSource = defaultIds,
  ) {
    this._saveStatus = repo.kind === 'memory' ? 'memory_only' : 'idle';
    this.tabId = ids.newId('tab');
  }

  get state(): SessionState {
    return this._state;
  }
  get log(): readonly AnyEvent[] {
    return this.events;
  }
  get saveStatus(): SaveStatus {
    return this._saveStatus;
  }
  get lastError(): string | null {
    return this._lastError;
  }
  get readOnly(): boolean {
    return this._readOnly;
  }
  get drafts(): Record<string, unknown> {
    return this._drafts;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private notify() {
    this.listeners.forEach((l) => l());
  }

  private ctx(): CommandContext {
    return { newId: (p) => this.ids.newId(p) };
  }

  /** Run a guarded engine command and persist its events atomically. */
  dispatch<I>(command: (s: SessionState, input: I, ctx: CommandContext) => CommandResult, input: I, sessionIdForStart?: string): DispatchResult {
    if (this._readOnly) return { ok: false, code: 'READ_ONLY', message: 'This session is open in another tab. Reload to continue here.' };
    const result = command(this._state, input, this.ctx());
    if (!result.ok) return result;
    return this.commit(result.drafts, sessionIdForStart);
  }

  /** Tutor events only. The tutor cannot reach engine commands through this path. */
  appendTutorEvents(drafts: EventDraft[]): DispatchResult {
    for (const d of drafts) {
      if (!(TUTOR_EVENT_TYPES as readonly string[]).includes(d.event_type)) {
        return { ok: false, code: 'TUTOR_FORBIDDEN', message: `The tutor may not emit ${d.event_type}.` };
      }
    }
    if (this._state.stage === 'START') return { ok: false, code: 'NO_SESSION', message: 'No session.' };
    return this.commit(drafts);
  }

  /** Tutor events computed against the latest committed state (same contract as the remote gateway). */
  appendTutorWith(build: (state: SessionState) => EventDraft[] | null): DispatchResult | null {
    const drafts = build(this._state);
    if (!drafts || drafts.length === 0) return null;
    return this.appendTutorEvents(drafts);
  }

  private commit(drafts: EventDraft[], sessionIdForStart?: string): DispatchResult {
    const sessionId = this._state.sessionId ?? sessionIdForStart;
    if (!sessionId) return { ok: false, code: 'NO_SESSION', message: 'No active session.' };
    const { events, next } = stampDrafts(this._state, drafts, sessionId, this.ids);
    try {
      this.repo.append(sessionId, events, this._state.lastSequence);
    } catch (err) {
      const pe = err instanceof PersistenceError ? err : new PersistenceError(String(err), 'write_failed');
      if (pe.kind === 'conflict') {
        this._readOnly = true;
        this._saveStatus = 'conflict';
      } else {
        this._saveStatus = 'failed';
      }
      this._lastError = pe.message;
      this.notify();
      return {
        ok: false,
        code: pe.kind === 'conflict' ? 'CONFLICT' : 'PERSISTENCE_FAILED',
        message: pe.kind === 'conflict' ? pe.message : `Your entry could not be saved, so nothing was released. ${pe.message} Please try again.`,
      };
    }
    this.events = [...this.events, ...events];
    this._state = next;
    this._lastError = null;
    if (this.repo.kind === 'local') this._saveStatus = 'saved';
    this.writeMeta();
    this.notify();
    return { ok: true, events };
  }

  private writeMeta() {
    const s = this._state;
    if (!s.sessionId) return;
    const first = this.events[0];
    const last = this.events[this.events.length - 1];
    const meta: SessionMeta = {
      session_id: s.sessionId,
      participant_code: s.participantCode,
      session_kind: s.sessionKind,
      started_at_utc: first?.timestamp_utc ?? '',
      updated_at_utc: last?.timestamp_utc ?? '',
      stage: s.stage,
      status: s.status,
      event_count: this.events.length,
    };
    try {
      this.repo.saveMeta(meta);
      this.repo.setActiveSessionId(s.sessionId);
    } catch {
      /* metadata is derivable from events */
    }
  }

  /** Restore a stored session. Throws PersistenceError('corrupt') if the log cannot be replayed. */
  load(sessionId: string, force = false): { lockedElsewhere: boolean } {
    const events = this.repo.loadEvents(sessionId);
    let state: SessionState;
    try {
      state = foldEvents(events);
    } catch (err) {
      throw new PersistenceError(`Stored session could not be replayed: ${(err as Error).message}`, 'corrupt');
    }
    const lock = this.repo.acquireLock(sessionId, this.tabId, force);
    this.events = events;
    this._state = state;
    this._drafts = this.repo.loadDrafts(sessionId);
    this._readOnly = !lock.ok;
    this._saveStatus = this.repo.kind === 'memory' ? 'memory_only' : lock.ok ? 'saved' : 'conflict';
    this.repo.setActiveSessionId(sessionId);
    if (lock.ok && state.stage !== 'START') {
      this.commit([{ event_type: 'session_resumed', source: 'system', payload: { tab_id: this.tabId } }]);
    }
    this.notify();
    return { lockedElsewhere: !lock.ok };
  }

  /** Load a fully prepared event log (demonstration sessions). */
  loadPrepared(events: AnyEvent[]) {
    const sid = events[0]?.session_id;
    if (!sid) return;
    this.repo.append(sid, events, 0);
    this.events = events;
    this._state = foldEvents(events);
    if (this.repo.kind === 'local') this._saveStatus = 'saved';
    this.writeMeta();
    this.notify();
  }

  reset() {
    if (this._state.sessionId) this.repo.releaseLock(this._state.sessionId, this.tabId);
    this.events = [];
    this._state = initialState();
    this._drafts = {};
    this._readOnly = false;
    this._saveStatus = this.repo.kind === 'memory' ? 'memory_only' : 'idle';
    this.repo.setActiveSessionId(null);
    this.notify();
  }

  heartbeat() {
    if (this._state.sessionId && !this._readOnly) this.repo.acquireLock(this._state.sessionId, this.tabId, true);
  }

  /** Called when another tab writes this session's log. */
  externalChangeDetected() {
    const sid = this._state.sessionId;
    if (!sid) return;
    try {
      const stored = this.repo.loadEvents(sid);
      if (stored.length !== this.events.length) {
        this._readOnly = true;
        this._saveStatus = 'conflict';
        this._lastError = 'This session was changed in another tab or window.';
        this.notify();
      }
    } catch {
      /* ignore */
    }
  }

  setDraft(key: string, value: unknown) {
    this._drafts = { ...this._drafts, [key]: value };
    const sid = this._state.sessionId;
    if (sid) {
      try {
        this.repo.saveDrafts(sid, this._drafts);
      } catch {
        /* drafts are best-effort */
      }
    }
  }

  clearDraft(key: string) {
    if (!(key in this._drafts)) return;
    const { [key]: _removed, ...rest } = this._drafts;
    this._drafts = rest;
    const sid = this._state.sessionId;
    if (sid) {
      try {
        this.repo.saveDrafts(sid, this._drafts);
      } catch {
        /* ignore */
      }
    }
  }
}
