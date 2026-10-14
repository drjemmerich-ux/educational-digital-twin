// In-memory Store for tests and the local development server. Same semantics as the database.
import type { AnyEvent } from '../engine/types.ts';
import type { ParticipantRow, SessionRow, Store } from './store.ts';

export class MemoryStore implements Store {
  participants = new Map<string, ParticipantRow & { token_hash: string }>();
  facilitatorHashes = new Set<string>();
  sessions = new Map<string, SessionRow>();
  events = new Map<string, AnyEvent[]>();
  /** Test hook: the next N appends fail with an exception. */
  failNextAppends = 0;

  async participantByTokenHash(hash: string) {
    for (const p of this.participants.values()) if (p.token_hash === hash) return strip(p);
    return null;
  }
  async facilitatorKeyValid(hash: string) {
    return this.facilitatorHashes.has(hash);
  }
  async listParticipants() {
    return [...this.participants.values()].map(strip).sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  async participantCodeExists(code: string) {
    return [...this.participants.values()].some((p) => p.participant_code === code);
  }
  async createParticipant(row: ParticipantRow, tokenHash: string) {
    this.participants.set(row.participant_id, { ...row, token_hash: tokenHash });
  }
  async setParticipantDisabled(participantId: string, disabled: boolean) {
    const p = this.participants.get(participantId);
    if (!p) return false;
    p.disabled = disabled;
    return true;
  }
  async listSessions(participantId?: string) {
    return [...this.sessions.values()].filter((s) => !participantId || s.participant_id === participantId).map((s) => ({ ...s }));
  }
  async getSession(sessionId: string) {
    const s = this.sessions.get(sessionId);
    return s ? { ...s } : null;
  }
  async loadEvents(sessionId: string) {
    return structuredClone(this.events.get(sessionId) ?? []);
  }
  async appendEvents(session: SessionRow, events: AnyEvent[], expected: number) {
    if (this.failNextAppends > 0) {
      this.failNextAppends--;
      throw new Error('simulated database failure');
    }
    const existing = this.sessions.get(session.session_id);
    if (expected === 0 && existing) return 'conflict';
    if (expected !== 0 && (!existing || existing.last_sequence !== expected)) return 'conflict';
    this.sessions.set(session.session_id, { ...session });
    this.events.set(session.session_id, [...(this.events.get(session.session_id) ?? []), ...structuredClone(events)]);
    return 'ok';
  }
}

function strip(p: ParticipantRow & { token_hash: string }): ParticipantRow {
  const { token_hash: _t, ...rest } = p;
  return { ...rest };
}
