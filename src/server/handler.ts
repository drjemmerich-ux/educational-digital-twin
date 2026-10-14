// Server engine: authenticates a personal link or facilitator key, rebuilds the session from its
// append-only log, runs one guarded command, stamps the events and appends them atomically.
// Platform-agnostic: the Supabase Edge Function and the local development server both call it.
// Hidden case content stays on the server; responses carry released event payloads only.
import { COMMANDS, isCommandName } from '../engine/registry.ts';
import type { CommandContext, CommandResult } from '../engine/commands.ts';
import { foldEvents, initialState } from '../engine/reducer.ts';
import { TUTOR_EVENT_TYPES, type AnyEvent, type EventDraft, type SessionState } from '../engine/types.ts';
import { stampDrafts, type IdSource } from '../session/controller.ts';
import type { SessionMeta } from '../session/repository.ts';
import {
  sha256Hex,
  type ApiRequest,
  type ApiResponse,
  type CommandOutcome,
  type CreatedLink,
  type FacilitatorOverview,
  type LoadedSession,
  type WhoAmI,
} from './api.ts';
import type { ParticipantRow, SessionRow, Store } from './store.ts';

export interface ServerDeps {
  store: Store;
  ids: IdSource;
  randomBytes: (n: number) => Uint8Array;
  log?: (message: string, detail?: unknown) => void;
}

type AnyCommand = (s: SessionState, input: unknown, ctx: CommandContext) => CommandResult;

const fail = (code: string, message: string): ApiResponse<never> => ({ ok: false, code, message });
const okData = <T>(data: T): ApiResponse<T> => ({ ok: true, data });

const LINK_INVALID = fail('LINK_INVALID', 'This personal link is not valid or has been disabled. Please contact the course facilitator.');
const KEY_INVALID = fail('KEY_INVALID', 'The facilitator key is not valid.');
const CONFLICT = fail('CONFLICT', 'This encounter was changed in another tab or window. Reload the page to continue with the latest record.');
const NOT_FOUND = fail('NOT_FOUND', 'This encounter was not found for your link.');
const ROUTES = ['image_gate_placeholder', 'text_only'];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown, max = 200): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;

export function metaOf(row: SessionRow): SessionMeta {
  return {
    session_id: row.session_id,
    participant_code: row.participant_code,
    session_kind: row.session_kind,
    started_at_utc: row.started_at,
    updated_at_utc: row.updated_at,
    stage: row.stage,
    status: row.status,
    event_count: row.event_count,
  };
}

function base64url(bytes: Uint8Array): string {
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function handleApi(raw: unknown, deps: ServerDeps): Promise<ApiResponse> {
  try {
    if (!isObj(raw) || typeof raw.action !== 'string') return fail('BAD_REQUEST', 'Malformed request.');
    const req = raw as ApiRequest;
    if (req.action.startsWith('fac_')) return await facilitator(req, deps);
    return await participant(req, deps);
  } catch (err) {
    deps.log?.('handler error', err);
    return fail('SERVER_ERROR', 'The study server could not complete this request, so nothing was saved or released. Please try again.');
  }
}

// ---------------------------------------------------------------------------
// Participant actions
// ---------------------------------------------------------------------------
async function authParticipant(token: unknown, store: Store): Promise<ParticipantRow | null> {
  if (!isStr(token, 200)) return null;
  const p = await store.participantByTokenHash(await sha256Hex(token));
  return p && !p.disabled ? p : null;
}

async function ownedSession(store: Store, p: ParticipantRow, sessionId: unknown): Promise<SessionRow | null> {
  if (!isStr(sessionId, 120)) return null;
  const s = await store.getSession(sessionId);
  return s && s.participant_id === p.participant_id ? s : null;
}

async function participant(req: ApiRequest, deps: ServerDeps): Promise<ApiResponse> {
  const { store } = deps;
  if (!('token' in req)) return fail('BAD_REQUEST', 'Malformed request.');
  const p = await authParticipant(req.token, store);
  if (!p) return LINK_INVALID;

  switch (req.action) {
    case 'whoami':
      return okData<WhoAmI>({ participant_code: p.participant_code });

    case 'list_sessions': {
      const rows = await store.listSessions(p.participant_id);
      return okData<SessionMeta[]>(rows.map(metaOf).sort((a, b) => b.updated_at_utc.localeCompare(a.updated_at_utc)));
    }

    case 'load_session': {
      const s = await ownedSession(store, p, req.session_id);
      if (!s) return NOT_FOUND;
      const events = await store.loadEvents(s.session_id);
      foldEvents(events); // throws if the stored log cannot be replayed
      return okData<LoadedSession>({ meta: metaOf(s), events });
    }

    case 'command':
      return runCommand(req, p, deps);

    case 'tutor_events':
      return appendTutor(req, p, deps);

    default:
      return fail('BAD_REQUEST', 'Unknown action.');
  }
}

async function loadState(store: Store, row: SessionRow): Promise<SessionState> {
  return foldEvents(await store.loadEvents(row.session_id));
}

function rowAfter(prev: SessionRow, next: SessionState, events: AnyEvent[], now: string): SessionRow {
  return {
    ...prev,
    stage: next.stage,
    status: next.status === 'not_started' ? 'in_progress' : next.status,
    event_count: prev.event_count + events.length,
    last_sequence: next.lastSequence,
    training_level: next.trainingLevel ?? prev.training_level,
    updated_at: events[events.length - 1]?.timestamp_utc ?? now,
  };
}

async function persist(deps: ServerDeps, prev: SessionRow, state: SessionState, drafts: EventDraft[], expected: number): Promise<ApiResponse> {
  const { events, next } = stampDrafts(state, drafts, prev.session_id, deps.ids);
  events.forEach((e, i) => {
    if (e.sequence !== expected + i + 1) throw new Error('non-contiguous sequence');
  });
  const row = rowAfter(prev, next, events, deps.ids.now());
  const outcome = await deps.store.appendEvents(row, events, expected);
  if (outcome === 'conflict') return CONFLICT;
  return okData<CommandOutcome>({ session_id: prev.session_id, events });
}

async function runCommand(req: Extract<ApiRequest, { action: 'command' }>, p: ParticipantRow, deps: ServerDeps): Promise<ApiResponse> {
  const { store } = deps;
  if (!isCommandName(req.name)) return fail('UNKNOWN_COMMAND', 'This action is not available.');
  if (typeof req.expected_last_sequence !== 'number') return fail('BAD_REQUEST', 'Malformed request.');

  let row: SessionRow;
  let state: SessionState;
  let input: unknown = req.input;

  if (req.name === 'startSession') {
    if (req.session_id !== null) return fail('BAD_REQUEST', 'A new encounter cannot reuse a session.');
    const existing = await store.listSessions(p.participant_id);
    if (existing.some((s) => s.status !== 'completed')) {
      return fail('SESSION_EXISTS', 'You already have an encounter in progress. Continue it from the start screen.');
    }
    if (!isObj(input) || !ROUTES.includes(input.imaging_route as string)) return fail('INVALID_INPUT', 'Choose an imaging route.');
    // The personal link fixes the participant code and the session kind.
    input = { ...input, participant_code: p.participant_code, session_kind: 'participant' };
    const now = deps.ids.now();
    row = {
      session_id: deps.ids.newId('session'),
      participant_id: p.participant_id,
      participant_code: p.participant_code,
      session_kind: 'participant',
      stage: 'START',
      status: 'in_progress',
      event_count: 0,
      last_sequence: 0,
      training_level: null,
      started_at: now,
      updated_at: now,
    };
    state = initialState();
  } else {
    const owned = await ownedSession(store, p, req.session_id);
    if (!owned) return NOT_FOUND;
    row = owned;
    state = await loadState(store, row);
  }

  if (req.expected_last_sequence !== state.lastSequence) return CONFLICT;

  let result: CommandResult;
  try {
    result = (COMMANDS[req.name] as unknown as AnyCommand)(state, input, { newId: (prefix) => deps.ids.newId(prefix) });
  } catch {
    return fail('INVALID_INPUT', 'This entry could not be processed. Please check the fields and try again.');
  }
  if (!result.ok) return fail(result.code, result.message);
  return persist(deps, row, state, result.drafts, state.lastSequence);
}

async function appendTutor(req: Extract<ApiRequest, { action: 'tutor_events' }>, p: ParticipantRow, deps: ServerDeps): Promise<ApiResponse> {
  const row = await ownedSession(deps.store, p, req.session_id);
  if (!row) return NOT_FOUND;
  if (!Array.isArray(req.drafts) || req.drafts.length === 0 || req.drafts.length > 4) return fail('BAD_REQUEST', 'Malformed request.');
  for (const d of req.drafts) {
    if (!isObj(d) || !(TUTOR_EVENT_TYPES as readonly string[]).includes(d.event_type as string) || !isObj(d.payload)) {
      return fail('TUTOR_FORBIDDEN', 'The tutor may only record tutor events.');
    }
    if (d.source !== 'tutor' && d.source !== 'learner') return fail('TUTOR_FORBIDDEN', 'The tutor may only record tutor events.');
  }
  const state = await loadState(deps.store, row);
  if (req.expected_last_sequence !== state.lastSequence) return CONFLICT;
  const drafts = req.drafts.map((d) => ({ event_type: d.event_type, source: d.source, payload: d.payload }) as EventDraft);
  return persist(deps, row, state, drafts, state.lastSequence);
}

// ---------------------------------------------------------------------------
// Facilitator actions
// ---------------------------------------------------------------------------
async function newParticipantCode(store: Store, randomBytes: (n: number) => Uint8Array): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = 'P-' + Array.from(randomBytes(6), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
    if (!(await store.participantCodeExists(code))) return code;
  }
  throw new Error('could not allocate a participant code');
}

async function facilitator(req: ApiRequest, deps: ServerDeps): Promise<ApiResponse> {
  const { store } = deps;
  if (!('key' in req) || !isStr(req.key, 200) || !(await store.facilitatorKeyValid(await sha256Hex(req.key)))) return KEY_INVALID;

  switch (req.action) {
    case 'fac_overview': {
      const [participants, sessions] = await Promise.all([store.listParticipants(), store.listSessions()]);
      return okData<FacilitatorOverview>({
        participants,
        sessions: sessions
          .map((s) => ({ ...metaOf(s), participant_id: s.participant_id, training_level: s.training_level }))
          .sort((a, b) => b.updated_at_utc.localeCompare(a.updated_at_utc)),
      });
    }
    case 'fac_create_link': {
      const label = typeof req.label === 'string' ? req.label.trim().slice(0, 80) : '';
      const token = base64url(deps.randomBytes(32));
      const row: ParticipantRow = {
        participant_id: deps.ids.newId('participant'),
        participant_code: await newParticipantCode(store, deps.randomBytes),
        label,
        disabled: false,
        created_at: deps.ids.now(),
      };
      await store.createParticipant(row, await sha256Hex(token));
      return okData<CreatedLink>({ participant: row, token });
    }
    case 'fac_set_disabled': {
      if (!isStr(req.participant_id, 120) || typeof req.disabled !== 'boolean') return fail('BAD_REQUEST', 'Malformed request.');
      const done = await store.setParticipantDisabled(req.participant_id, req.disabled);
      return done ? okData({ participant_id: req.participant_id, disabled: req.disabled }) : fail('NOT_FOUND', 'Participant not found.');
    }
    case 'fac_session_events': {
      if (!isStr(req.session_id, 120)) return fail('BAD_REQUEST', 'Malformed request.');
      const s = await store.getSession(req.session_id);
      if (!s) return fail('NOT_FOUND', 'Session not found.');
      return okData<LoadedSession>({ meta: metaOf(s), events: await store.loadEvents(s.session_id) });
    }
    default:
      return fail('BAD_REQUEST', 'Unknown action.');
  }
}
