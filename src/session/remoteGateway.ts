// RemoteGateway: the participant page of the pilot. Every command is sent by name to the server
// engine, which holds the hidden case content and the authoritative append-only record. The page
// rebuilds its released view by applying the returned events with the shared reducer.
import type { CommandInput, CommandName } from '../engine/commandTypes.ts';
import { applyEvent, foldEvents, initialState } from '../engine/reducer.ts';
import type { AnyEvent, EventDraft, SessionState } from '../engine/types.ts';
import type { ApiRequest, ApiResponse, CommandOutcome, LoadedSession, WhoAmI } from '../server/api.ts';
import type { DispatchResult } from './controller.ts';
import type { GatewayCapabilities, GatewaySaveStatus, SessionGateway } from './gateway.ts';
import type { SessionMeta } from './repository.ts';

export type Transport = (req: ApiRequest) => Promise<ApiResponse>;

/** Minimal key-value store for unsent drafts (browser localStorage, or memory). */
export interface DraftStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export class NetworkError extends Error {}

export function fetchTransport(url: string, headers: Record<string, string> = {}): Transport {
  return async (req) => {
    let res: Response;
    try {
      res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(req) });
    } catch (err) {
      throw new NetworkError(`The study server could not be reached (${(err as Error).message}).`);
    }
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new NetworkError(`The study server returned an unreadable response (HTTP ${res.status}).`);
    }
    if (typeof body !== 'object' || body === null || typeof (body as { ok?: unknown }).ok !== 'boolean') {
      throw new NetworkError(`The study server returned an unexpected response (HTTP ${res.status}).`);
    }
    return body as ApiResponse;
  };
}

type Listener = () => void;

export class RemoteGateway implements SessionGateway {
  readonly mode = 'remote' as const;
  readonly capabilities: GatewayCapabilities = { storage: 'server', demo: false, devTools: false, assignedCode: true, chooseRoute: true };
  assignedParticipantCode: string | null = null;

  private events: AnyEvent[] = [];
  private _state: SessionState = initialState();
  private _saveStatus: GatewaySaveStatus = 'idle';
  private _lastError: string | null = null;
  private _readOnly = false;
  private _drafts: Record<string, unknown> = {};
  private listeners = new Set<Listener>();
  private tail: Promise<unknown> = Promise.resolve();
  private pending = new Map<string, Promise<DispatchResult>>();

  constructor(
    private readonly transport: Transport,
    private readonly token: string,
    private readonly draftStore: DraftStore,
  ) {}

  get state() {
    return this._state;
  }
  get log(): readonly AnyEvent[] {
    return this.events;
  }
  get saveStatus() {
    return this._saveStatus;
  }
  get lastError() {
    return this._lastError;
  }
  get readOnly() {
    return this._readOnly;
  }
  get drafts() {
    return this._drafts;
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  private notify() {
    this.listeners.forEach((l) => l());
  }

  /** Validates the personal link. Returns an error message when the link cannot be used. */
  async init(): Promise<string | null> {
    try {
      const r = await this.transport({ action: 'whoami', token: this.token });
      if (!r.ok) return r.message;
      this.assignedParticipantCode = (r.data as WhoAmI).participant_code;
      return null;
    } catch (err) {
      return (err as Error).message;
    }
  }

  private enqueue<T>(op: () => Promise<T>): Promise<T> {
    const next = this.tail.then(op, op);
    this.tail = next.catch(() => undefined);
    return next;
  }

  private applyServerEvents(events: AnyEvent[]) {
    let s = this._state;
    for (const e of events) s = applyEvent(s, e);
    this.events = [...this.events, ...events];
    this._state = s;
  }

  private async send(req: ApiRequest): Promise<DispatchResult> {
    if (this._readOnly) return { ok: false, code: 'READ_ONLY', message: 'This encounter was changed elsewhere. Reload the page to continue.' };
    this._saveStatus = 'saving';
    this.notify();
    let r: ApiResponse;
    try {
      r = await this.transport(req);
    } catch (err) {
      this._saveStatus = 'offline';
      this._lastError = (err as Error).message;
      this.notify();
      return { ok: false, code: 'OFFLINE', message: `${(err as Error).message} Nothing was saved or released. Please try again.` };
    }
    if (!r.ok) {
      if (r.code === 'CONFLICT') {
        this._readOnly = true;
        this._saveStatus = 'conflict';
        this._lastError = r.message;
      } else if (r.code === 'SERVER_ERROR' || r.code === 'LINK_INVALID') {
        this._saveStatus = 'failed';
        this._lastError = r.message;
      } else {
        // Engine guard: the entry was refused and nothing changed.
        this._saveStatus = this.events.length ? 'saved' : 'idle';
      }
      this.notify();
      return { ok: false, code: r.code, message: r.message };
    }
    const out = r.data as CommandOutcome;
    if (!this._state.sessionId) this.loadDraftsFor(out.session_id);
    this.applyServerEvents(out.events);
    this._saveStatus = 'saved';
    this._lastError = null;
    this.notify();
    return { ok: true, events: out.events };
  }

  run<N extends CommandName>(name: N, input: CommandInput<N>): Promise<DispatchResult> {
    // Identical repeated submissions (double clicks, re-renders) share one request.
    const key = `${name}:${JSON.stringify(input ?? null)}`;
    const existing = this.pending.get(key);
    if (existing) return existing;
    const p = this.enqueue(() =>
      this.send({
        action: 'command',
        token: this.token,
        session_id: this._state.sessionId,
        expected_last_sequence: this._state.lastSequence,
        name,
        input: input ?? null,
      }),
    ).finally(() => this.pending.delete(key));
    this.pending.set(key, p);
    return p;
  }

  appendTutorWith(build: (state: SessionState) => EventDraft[] | null): Promise<DispatchResult | null> {
    return this.enqueue(async () => {
      if (!this._state.sessionId || this._readOnly) return null;
      const drafts = build(this._state);
      if (!drafts || drafts.length === 0) return null;
      return this.send({ action: 'tutor_events', token: this.token, session_id: this._state.sessionId, expected_last_sequence: this._state.lastSequence, drafts });
    });
  }

  async listSessions(): Promise<SessionMeta[]> {
    const r = await this.transport({ action: 'list_sessions', token: this.token });
    if (!r.ok) throw new Error(r.message);
    return r.data as SessionMeta[];
  }

  async open(sessionId: string): Promise<{ lockedElsewhere: boolean }> {
    const r = await this.transport({ action: 'load_session', token: this.token, session_id: sessionId });
    if (!r.ok) throw new Error(r.message);
    const { events } = r.data as LoadedSession;
    this.events = events;
    this._state = foldEvents(events);
    this._readOnly = false;
    this._saveStatus = 'saved';
    this._lastError = null;
    this.loadDraftsFor(sessionId);
    this.notify();
    return { lockedElsewhere: false };
  }

  reset() {
    this.events = [];
    this._state = initialState();
    this._drafts = {};
    this._readOnly = false;
    this._saveStatus = 'idle';
    this._lastError = null;
    this.notify();
  }

  private draftKey(sessionId: string) {
    return `edt-remote-drafts:${sessionId}`;
  }
  private loadDraftsFor(sessionId: string) {
    try {
      const raw = this.draftStore.get(this.draftKey(sessionId));
      this._drafts = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      this._drafts = {};
    }
  }
  private saveDrafts() {
    const sid = this._state.sessionId;
    if (!sid) return;
    try {
      if (Object.keys(this._drafts).length) this.draftStore.set(this.draftKey(sid), JSON.stringify(this._drafts));
      else this.draftStore.remove(this.draftKey(sid));
    } catch {
      /* drafts are best-effort */
    }
  }
  setDraft(key: string, value: unknown) {
    this._drafts = { ...this._drafts, [key]: value };
    this.saveDrafts();
  }
  clearDraft(key: string) {
    if (!(key in this._drafts)) return;
    const { [key]: _removed, ...rest } = this._drafts;
    this._drafts = rest;
    this.saveDrafts();
  }
}

export function memoryDraftStore(): DraftStore {
  const m = new Map<string, string>();
  return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v), remove: (k) => void m.delete(k) };
}

export function browserDraftStore(): DraftStore {
  try {
    const ls = globalThis.localStorage;
    const probe = '__edt_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return { get: (k) => ls.getItem(k), set: (k, v) => ls.setItem(k, v), remove: (k) => ls.removeItem(k) };
  } catch {
    return memoryDraftStore();
  }
}
