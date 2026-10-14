// Persistence boundary of the server engine. Implemented by Supabase (production) and memory (tests).
import type { AnyEvent } from '../engine/types.ts';

export interface ParticipantRow {
  participant_id: string;
  participant_code: string;
  label: string;
  disabled: boolean;
  created_at: string;
}

export interface SessionRow {
  session_id: string;
  participant_id: string;
  participant_code: string;
  session_kind: 'participant' | 'demonstration';
  stage: string;
  status: 'in_progress' | 'paused_for_review' | 'completed';
  event_count: number;
  last_sequence: number;
  training_level: string | null;
  started_at: string;
  updated_at: string;
}

export interface Store {
  participantByTokenHash(hash: string): Promise<ParticipantRow | null>;
  facilitatorKeyValid(hash: string): Promise<boolean>;
  listParticipants(): Promise<ParticipantRow[]>;
  participantCodeExists(code: string): Promise<boolean>;
  createParticipant(row: ParticipantRow, tokenHash: string): Promise<void>;
  setParticipantDisabled(participantId: string, disabled: boolean): Promise<boolean>;
  listSessions(participantId?: string): Promise<SessionRow[]>;
  getSession(sessionId: string): Promise<SessionRow | null>;
  loadEvents(sessionId: string): Promise<AnyEvent[]>;
  /**
   * Atomic append. Creates the session row when expectedLastSequence is 0.
   * Returns 'conflict' when the stored log is not at expectedLastSequence.
   */
  appendEvents(session: SessionRow, events: AnyEvent[], expectedLastSequence: number): Promise<'ok' | 'conflict'>;
}
