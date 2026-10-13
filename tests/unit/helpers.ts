import { MemorySessionRepository } from '../../src/session/memoryRepository.ts';
import { SessionController, sequentialIds } from '../../src/session/controller.ts';
import { REFERENCE_JOURNEY, runJourney, type JourneyOptions } from '../../src/session/scriptedJourney.ts';
import * as C from '../../src/engine/commands.ts';
import { CONSENT_STATEMENTS } from '../../src/case/publicCatalogue.ts';
export { CONSENT_STATEMENTS };

export function newController(repo = new MemorySessionRepository()) {
  return new SessionController(repo, sequentialIds());
}

export function journey(over: Partial<JourneyOptions> = {}, repo = new MemorySessionRepository()) {
  const ctl = newController(repo);
  runJourney(ctl, { sessionId: over.sessionId ?? 'session-test', kind: 'participant', ...REFERENCE_JOURNEY, ...over });
  return ctl;
}

export function startedAtWorkup(route: 'image_gate_placeholder' | 'text_only' = 'image_gate_placeholder', repo = new MemorySessionRepository()) {
  const ctl = newController(repo);
  ctl.dispatch(C.startSession, { participant_code: 'T', imaging_route: route, session_kind: 'participant', consent_statement_ids: CONSENT_STATEMENTS.map((c) => c.id), training_level: 'fellow' }, 'session-wu');
  const r = ctl.dispatch(C.commitInitialAssessment, { problem_representation: 'p', hypotheses: ['h'], priorities: 'x', confidence: 50 });
  if (!r.ok) throw new Error(r.message);
  return ctl;
}

export const HIDDEN_FUTURE_TERMS = [
  'pseudomeningocele',
  'durotomy',
  'dural defect',
  'Valsalva',
  '48 x 18 x 55',
  '900 m',
  'ODI 24',
  'lumbar drain',
  're-exploration',
  'decompression',
  'spondylolisthesis',
  'stenosis',
  '58 mm',
  '4.5 mm',
  '118 HU',
  'T-score',
];
