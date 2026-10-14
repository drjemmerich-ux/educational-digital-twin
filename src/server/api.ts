// Wire contract between the participant/facilitator pages and the server engine.
// Shared by client and server; contains types and tiny helpers only (no engine, no hidden content).
import type { AnyEvent, EventDraft } from '../engine/types.ts';
import type { SessionMeta } from '../session/repository.ts';

export type ApiRequest =
  | { action: 'whoami'; token: string }
  | { action: 'list_sessions'; token: string }
  | { action: 'load_session'; token: string; session_id: string }
  | { action: 'command'; token: string; session_id: string | null; expected_last_sequence: number; name: string; input: unknown }
  | { action: 'tutor_events'; token: string; session_id: string; expected_last_sequence: number; drafts: EventDraft[] }
  | { action: 'fac_overview'; key: string }
  | { action: 'fac_create_link'; key: string; label: string }
  | { action: 'fac_set_disabled'; key: string; participant_id: string; disabled: boolean }
  | { action: 'fac_session_events'; key: string; session_id: string };

export type ApiAction = ApiRequest['action'];

export type ApiResponse<T = unknown> = { ok: true; data: T } | { ok: false; code: string; message: string };

export interface WhoAmI {
  participant_code: string;
}
export interface CommandOutcome {
  session_id: string;
  events: AnyEvent[];
}
export interface LoadedSession {
  meta: SessionMeta;
  events: AnyEvent[];
}
export interface FacilitatorParticipant {
  participant_id: string;
  participant_code: string;
  label: string;
  disabled: boolean;
  created_at: string;
}
export interface FacilitatorSession extends SessionMeta {
  participant_id: string;
  training_level: string | null;
}
export interface FacilitatorOverview {
  participants: FacilitatorParticipant[];
  sessions: FacilitatorSession[];
}
export interface CreatedLink {
  participant: FacilitatorParticipant;
  /** Returned once. Only its hash is stored. */
  token: string;
}

export const MAX_REQUEST_BYTES = 256 * 1024;

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
