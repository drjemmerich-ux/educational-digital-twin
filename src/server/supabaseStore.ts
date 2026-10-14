// Store backed by the Supabase database (tables and RPC created by supabase/migrations).
// Receives a service-role supabase-js client from the Edge Function; never used in the browser.
import type { AnyEvent } from '../engine/types.ts';
import type { ParticipantRow, SessionRow, Store } from './store.ts';

interface PgError {
  message: string;
}
interface PgResult<T> {
  data: T | null;
  error: PgError | null;
}
/** Structural subset of the supabase-js query builder used here. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Query = any;
export interface SupabaseLike {
  from(table: string): Query;
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<PgResult<unknown>>;
}

const P_COLS = 'participant_id,participant_code,label,disabled,created_at';
const S_COLS = 'session_id,participant_id,participant_code,session_kind,stage,status,event_count,last_sequence,training_level,started_at,updated_at';

function must<T>(r: PgResult<T>, what: string): T | null {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
}

export class SupabaseStore implements Store {
  constructor(private readonly sb: SupabaseLike) {}

  async participantByTokenHash(hash: string) {
    return must<ParticipantRow>(await this.sb.from('edt_participants').select(P_COLS).eq('token_hash', hash).maybeSingle(), 'participant lookup');
  }
  async facilitatorKeyValid(hash: string) {
    const row = must<{ key_id: string }>(await this.sb.from('edt_facilitator_keys').select('key_id').eq('key_hash', hash).eq('revoked', false).maybeSingle(), 'key lookup');
    return row !== null;
  }
  async listParticipants() {
    return must<ParticipantRow[]>(await this.sb.from('edt_participants').select(P_COLS).order('created_at', { ascending: true }), 'participants') ?? [];
  }
  async participantCodeExists(code: string) {
    return must(await this.sb.from('edt_participants').select('participant_id').eq('participant_code', code).maybeSingle(), 'code lookup') !== null;
  }
  async createParticipant(row: ParticipantRow, tokenHash: string) {
    must(await this.sb.from('edt_participants').insert({ ...row, token_hash: tokenHash }), 'create participant');
  }
  async setParticipantDisabled(participantId: string, disabled: boolean) {
    const rows = must<unknown[]>(await this.sb.from('edt_participants').update({ disabled }).eq('participant_id', participantId).select('participant_id'), 'update participant');
    return (rows ?? []).length > 0;
  }
  async listSessions(participantId?: string) {
    let q = this.sb.from('edt_sessions').select(S_COLS);
    if (participantId) q = q.eq('participant_id', participantId);
    return must<SessionRow[]>(await q.order('updated_at', { ascending: false }), 'sessions') ?? [];
  }
  async getSession(sessionId: string) {
    return must<SessionRow>(await this.sb.from('edt_sessions').select(S_COLS).eq('session_id', sessionId).maybeSingle(), 'session');
  }
  async loadEvents(sessionId: string) {
    const rows = must<{ event: AnyEvent }[]>(
      await this.sb.from('edt_events').select('event').eq('session_id', sessionId).order('sequence', { ascending: true }).range(0, 9999),
      'events',
    );
    return (rows ?? []).map((r) => r.event);
  }
  async appendEvents(session: SessionRow, events: AnyEvent[], expected: number) {
    const outcome = must<string>(await this.sb.rpc('edt_append_events', { p_session: session, p_events: events, p_expected: expected }) as PgResult<string>, 'append');
    if (outcome !== 'ok' && outcome !== 'conflict') throw new Error(`append returned ${String(outcome)}`);
    return outcome;
  }
}
