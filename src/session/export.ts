// Session export and replay. The export contains only the experienced trace: every released
// payload is already inside its release event, so no hidden case content is ever included.
import { EXPORT_SCHEMA_VERSION } from '../case/versions.ts';
import { foldEvents } from '../engine/reducer.ts';
import type { AnyEvent, SessionState } from '../engine/types.ts';
import { releasedContent } from '../engine/selectors.ts';

export interface SessionExport {
  export_schema_version: string;
  exported_at_utc: string;
  notice: string[];
  versions: SessionState['versions'];
  session: {
    session_id: string | null;
    participant_code: string;
    session_kind: SessionState['sessionKind'];
    imaging_route: SessionState['imagingRoute'];
    status: SessionState['status'];
    completion_status: string;
    current_stage: string;
    simulated_time_now: string;
    started_at_utc: string | null;
    last_event_at_utc: string | null;
    real_elapsed_seconds: number | null;
  };
  released_content: ReturnType<typeof releasedContent>;
  tutor_interactions: SessionState['tutor']['messages'];
  events: AnyEvent[];
  integrity: { event_count: number; first_sequence: number | null; last_sequence: number | null; checksum_fnv1a: string };
}

export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function completionStatus(state: SessionState): string {
  if (state.completion) return state.completion.completion_status;
  if (state.status === 'paused_for_review') return 'paused_for_expert_review';
  if (state.status === 'in_progress') return 'in_progress';
  return state.status;
}

export function buildExport(events: readonly AnyEvent[], exportedAt: string = new Date().toISOString()): SessionExport {
  const state = foldEvents(events);
  const first = events[0];
  const last = events[events.length - 1];
  const notice = [
    'Fictional, fully synthetic educational case. Not real patient data. Not clinical decision support.',
    'Formative prototype: no grading, scoring, or competence classification.',
  ];
  if (state.imagingRoute === 'text_only') notice.push('Text-only demonstration route: image interpretation was not assessed.');
  else notice.push('Image studies used clearly labelled technical placeholders; no validated diagnostic images were shown.');
  if (state.sessionKind === 'demonstration') notice.push('DEMONSTRATION SESSION with prefilled sample reasoning. Not a participant record.');
  return {
    export_schema_version: EXPORT_SCHEMA_VERSION,
    exported_at_utc: exportedAt,
    notice,
    versions: state.versions,
    session: {
      session_id: state.sessionId,
      participant_code: state.participantCode,
      session_kind: state.sessionKind,
      imaging_route: state.imagingRoute,
      status: state.status,
      completion_status: completionStatus(state),
      current_stage: state.stage,
      simulated_time_now: state.simTime.label,
      started_at_utc: first?.timestamp_utc ?? null,
      last_event_at_utc: last?.timestamp_utc ?? null,
      real_elapsed_seconds: first && last ? Math.round((Date.parse(last.timestamp_utc) - Date.parse(first.timestamp_utc)) / 1000) : null,
    },
    released_content: releasedContent(state),
    tutor_interactions: state.tutor.messages,
    events: [...events],
    integrity: {
      event_count: events.length,
      first_sequence: first?.sequence ?? null,
      last_sequence: last?.sequence ?? null,
      checksum_fnv1a: fnv1a(JSON.stringify(events)),
    },
  };
}

export interface ReplayReport {
  ok: boolean;
  problems: string[];
  state: SessionState | null;
}

/** Rebuild the experienced course from an export alone, without any hidden case content. */
export function replayExport(data: unknown): ReplayReport {
  const problems: string[] = [];
  const exp = data as Partial<SessionExport>;
  if (!exp || exp.export_schema_version !== EXPORT_SCHEMA_VERSION) problems.push('Unknown export schema version.');
  const events = Array.isArray(exp?.events) ? (exp.events as AnyEvent[]) : [];
  if (events.length === 0) problems.push('Export contains no events.');
  events.forEach((e, i) => {
    if (e.sequence !== i + 1) problems.push(`Event ${i + 1} has sequence ${e.sequence}.`);
  });
  if (exp?.integrity && exp.integrity.checksum_fnv1a !== fnv1a(JSON.stringify(events))) problems.push('Checksum mismatch.');
  let state: SessionState | null = null;
  try {
    state = foldEvents(events);
  } catch (err) {
    problems.push(`Replay failed: ${(err as Error).message}`);
  }
  if (state && exp?.released_content) {
    const again = JSON.stringify(releasedContent(state));
    if (again !== JSON.stringify(exp.released_content)) problems.push('Replayed released content differs from the exported released content.');
  }
  return { ok: problems.length === 0, problems, state };
}
