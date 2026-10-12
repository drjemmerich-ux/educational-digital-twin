// Generates the reference-path (B1) session export with deterministic ids and timestamps,
// then verifies it by replay. Output: docs/reference-path-session.json
// Sample reasoning text is marked "Sample:"; this is a demonstration fixture, not learner data.
import { writeFileSync, mkdirSync } from 'node:fs';
import { MemorySessionRepository } from '../src/session/memoryRepository.ts';
import { SessionController, sequentialIds } from '../src/session/controller.ts';
import { REFERENCE_JOURNEY, runJourney } from '../src/session/scriptedJourney.ts';
import { buildExport, replayExport } from '../src/session/export.ts';

const ctl = new SessionController(new MemorySessionRepository(), sequentialIds('2026-10-12T12:00:00.000Z', 20000));
runJourney(ctl, { ...REFERENCE_JOURNEY, sessionId: 'session-reference-b1', kind: 'demonstration' });
const exp = buildExport(ctl.log, '2026-10-12T13:30:00.000Z');
const replay = replayExport(JSON.parse(JSON.stringify(exp)));
if (!replay.ok) {
  console.error(replay.problems);
  process.exit(1);
}
mkdirSync('docs', { recursive: true });
writeFileSync('docs/reference-path-session.json', JSON.stringify(exp, null, 2));
console.log(`reference session: ${exp.integrity.event_count} events, status ${exp.session.completion_status}, replay ok, checksum ${exp.integrity.checksum_fnv1a}`);
