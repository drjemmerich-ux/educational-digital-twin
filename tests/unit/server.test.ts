// Server engine, personal links, facilitator access and the remote participant gateway.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COMMANDS } from '../../src/engine/registry.ts';
import type { CommandContext, CommandResult } from '../../src/engine/commands.ts';
import type { EventDraft, SessionState } from '../../src/engine/types.ts';
import { foldEvents } from '../../src/engine/reducer.ts';
import { SessionController, sequentialIds, type DispatchResult } from '../../src/session/controller.ts';
import { MemorySessionRepository } from '../../src/session/memoryRepository.ts';
import { REFERENCE_JOURNEY, runJourney, type JourneyOptions } from '../../src/session/scriptedJourney.ts';
import { RemoteGateway, memoryDraftStore, type Transport } from '../../src/session/remoteGateway.ts';
import { buildExport, replayExport } from '../../src/session/export.ts';
import { handleApi, type ServerDeps } from '../../src/server/handler.ts';
import { MemoryStore } from '../../src/server/memoryStore.ts';
import { sha256Hex, type ApiResponse, type CreatedLink, type FacilitatorOverview, type LoadedSession } from '../../src/server/api.ts';
import { CONSENT_STATEMENTS } from './helpers.ts';

const FAC_KEY = 'fk_test_key_for_unit_tests';

async function server() {
  const store = new MemoryStore();
  store.facilitatorHashes.add(await sha256Hex(FAC_KEY));
  let r = 1;
  const deps: ServerDeps = {
    store,
    ids: sequentialIds('2026-10-14T12:00:00.000Z', 1000),
    randomBytes: (n) => Uint8Array.from({ length: n }, () => (r = (r * 1103515245 + 12345) % 2147483648) & 255),
  };
  // JSON round trip, exactly as over the wire.
  const transport: Transport = async (req) => JSON.parse(JSON.stringify(await handleApi(JSON.parse(JSON.stringify(req)), deps))) as ApiResponse;
  return { store, deps, transport };
}

async function newLink(transport: Transport, label = 'Fellow 01') {
  const r = await transport({ action: 'fac_create_link', key: FAC_KEY, label });
  assert.ok(r.ok, JSON.stringify(r));
  return r.data as CreatedLink;
}

/** Records the named commands and tutor drafts a scripted journey issues, so they can be replayed remotely. */
type Op = { kind: 'cmd'; name: keyof typeof COMMANDS; input: unknown } | { kind: 'tutor'; drafts: EventDraft[] };
class RecordingController extends SessionController {
  ops: Op[] = [];
  override dispatch<I>(command: (s: SessionState, input: I, ctx: CommandContext) => CommandResult, input: I, sid?: string): DispatchResult {
    const name = (Object.keys(COMMANDS) as (keyof typeof COMMANDS)[]).find((k) => (COMMANDS[k] as unknown) === command);
    if (!name) throw new Error('unregistered command');
    this.ops.push({ kind: 'cmd', name, input: structuredClone(input) });
    return super.dispatch(command, input, sid);
  }
  override appendTutorEvents(drafts: EventDraft[]): DispatchResult {
    this.ops.push({ kind: 'tutor', drafts: structuredClone(drafts) });
    return super.appendTutorEvents(drafts);
  }
}

function recordJourney(over: Partial<JourneyOptions> = {}) {
  const ctl = new RecordingController(new MemorySessionRepository(), sequentialIds());
  runJourney(ctl, { sessionId: 'session-local', kind: 'participant', ...REFERENCE_JOURNEY, ...over });
  return ctl;
}

async function replayRemote(gw: RemoteGateway, ops: Op[]) {
  for (const op of ops) {
    if (op.kind === 'cmd') {
      const r = await gw.run(op.name, op.input as never);
      assert.ok(r.ok, `${op.name}: ${!r.ok ? r.message : ''}`);
    } else {
      const r = await gw.appendTutorWith(() => op.drafts);
      assert.ok(r && r.ok, `tutor: ${r && !r.ok ? r.message : 'null'}`);
    }
  }
}

test('SRV01 facilitator key is required; a personal link is created once and only its hash is stored', async () => {
  const { store, transport } = await server();
  const denied = await transport({ action: 'fac_overview', key: 'wrong' });
  assert.equal(!denied.ok && denied.code, 'KEY_INVALID');
  const link = await newLink(transport);
  assert.match(link.participant.participant_code, /^P-[A-Z2-9]{6}$/);
  assert.ok(link.token.length >= 40);
  const stored = [...store.participants.values()][0]!;
  assert.equal(stored.token_hash, await sha256Hex(link.token));
  assert.ok(!JSON.stringify([...store.participants.values()]).includes(link.token), 'raw token must not be stored');
  const who = await transport({ action: 'whoami', token: link.token });
  assert.deepEqual(who, { ok: true, data: { participant_code: link.participant.participant_code } });
  const overview = await transport({ action: 'fac_overview', key: FAC_KEY });
  assert.ok(overview.ok);
  assert.ok(!JSON.stringify(overview).includes(link.token), 'overview never returns tokens');
});

test('SRV02 invalid and disabled links are refused', async () => {
  const { transport } = await server();
  const link = await newLink(transport);
  const bad = await transport({ action: 'whoami', token: 'not-a-token' });
  assert.equal(!bad.ok && bad.code, 'LINK_INVALID');
  await transport({ action: 'fac_set_disabled', key: FAC_KEY, participant_id: link.participant.participant_id, disabled: true });
  const off = await transport({ action: 'list_sessions', token: link.token });
  assert.equal(!off.ok && off.code, 'LINK_INVALID');
});

test('SRV03 reference journey through the server reproduces the local engine exactly (event types, stage, released content)', async () => {
  const local = recordJourney();
  const { transport } = await server();
  const link = await newLink(transport);
  const gw = new RemoteGateway(transport, link.token, memoryDraftStore());
  assert.equal(await gw.init(), null);
  await replayRemote(gw, local.ops);
  assert.deepEqual(
    gw.log.map((e) => e.event_type),
    local.log.map((e) => e.event_type),
  );
  assert.equal(gw.state.stage, local.state.stage);
  assert.equal(gw.state.status, local.state.status);
  assert.equal(gw.state.branchId, local.state.branchId);
  assert.equal(gw.state.participantCode, link.participant.participant_code, 'participant code comes from the link');
  // Released payloads are identical apart from generated ids and timestamps.
  const strip = (v: unknown) => JSON.stringify(v).replace(/"[a-z]+-(\d{4}|[0-9a-f-]{8,})"/g, '"id"').replace(/\d{4}-\d\d-\d\dT[\d:.]+Z/g, 'T');
  const remoteExport = buildExport([...gw.log]);
  const localExport = buildExport([...local.log]);
  assert.equal(strip(remoteExport.released_content), strip(localExport.released_content));
  assert.ok(replayExport(remoteExport).ok, 'server-recorded export replays');
});

test('SRV04 the stored log equals what the participant saw; reload rebuilds the same state', async () => {
  const local = recordJourney({ stopAt: 'N3' });
  const { transport } = await server();
  const link = await newLink(transport);
  const gw = new RemoteGateway(transport, link.token, memoryDraftStore());
  await gw.init();
  await replayRemote(gw, local.ops);
  const sid = gw.state.sessionId!;
  const fac = await transport({ action: 'fac_session_events', key: FAC_KEY, session_id: sid });
  assert.ok(fac.ok);
  assert.deepEqual((fac.data as LoadedSession).events, gw.log);
  const again = new RemoteGateway(transport, link.token, memoryDraftStore());
  await again.init();
  const list = await again.listSessions();
  assert.equal(list.length, 1);
  await again.open(list[0]!.session_id);
  assert.deepEqual(again.state, gw.state);
});

test('SRV05 guards run on the server: wrong stage, missing consent, unknown command, malformed input', async () => {
  const { transport } = await server();
  const link = await newLink(transport);
  const noConsent = await transport({ action: 'command', token: link.token, session_id: null, expected_last_sequence: 0, name: 'startSession', input: { imaging_route: 'text_only' } });
  assert.equal(!noConsent.ok && noConsent.code, 'CONSENT_REQUIRED');
  const badRoute = await transport({ action: 'command', token: link.token, session_id: null, expected_last_sequence: 0, name: 'startSession', input: { imaging_route: 'x' } });
  assert.equal(!badRoute.ok && badRoute.code, 'INVALID_INPUT');
  const unknown = await transport({ action: 'command', token: link.token, session_id: null, expected_last_sequence: 0, name: 'contextStage', input: null });
  assert.equal(!unknown.ok && unknown.code, 'UNKNOWN_COMMAND');
  const gw = new RemoteGateway(transport, link.token, memoryDraftStore());
  await gw.init();
  const started = await gw.run('startSession', { participant_code: 'IGNORED', imaging_route: 'text_only', session_kind: 'demonstration', consent_statement_ids: CONSENT_STATEMENTS.map((c) => c.id), training_level: 'fellow' });
  assert.ok(started.ok);
  assert.equal(gw.state.sessionKind, 'participant', 'a personal link cannot start a demonstration session');
  const early = await gw.run('commitRequest', { investigation_id: 'lumbar_mri', rationale: 'r', expectation: 'e', confidence: null });
  assert.equal(early.ok, false);
  assert.ok(!early.ok && !['CONFLICT', 'SERVER_ERROR', 'OFFLINE'].includes(early.code), 'refused by an engine guard');
  const malformed = await transport({ action: 'command', token: link.token, session_id: gw.state.sessionId, expected_last_sequence: gw.state.lastSequence, name: 'commitInitialAssessment', input: null });
  assert.equal(malformed.ok, false);
  assert.equal(gw.saveStatus, 'saved');
});

test('SRV06 a second encounter cannot start while one is open; another link cannot read it', async () => {
  const { transport } = await server();
  const a = await newLink(transport, 'A');
  const b = await newLink(transport, 'B');
  const gw = new RemoteGateway(transport, a.token, memoryDraftStore());
  await gw.init();
  const start = { participant_code: '', imaging_route: 'text_only' as const, session_kind: 'participant' as const, consent_statement_ids: CONSENT_STATEMENTS.map((c) => c.id), training_level: 'fellow' };
  assert.ok((await gw.run('startSession', start)).ok);
  gw.reset();
  const second = await gw.run('startSession', start);
  assert.equal(!second.ok && second.code, 'SESSION_EXISTS');
  const other = await transport({ action: 'load_session', token: b.token, session_id: (await gw.listSessions())[0]!.session_id });
  assert.equal(!other.ok && other.code, 'NOT_FOUND');
});

test('SRV07 stale tabs are refused with CONFLICT and become read-only; nothing is appended', async () => {
  const { store, transport } = await server();
  const link = await newLink(transport);
  const tab1 = new RemoteGateway(transport, link.token, memoryDraftStore());
  await tab1.init();
  assert.ok((await tab1.run('startSession', { participant_code: '', imaging_route: 'text_only', session_kind: 'participant', consent_statement_ids: CONSENT_STATEMENTS.map((c) => c.id), training_level: 'fellow' })).ok);
  const sid = tab1.state.sessionId!;
  const tab2 = new RemoteGateway(transport, link.token, memoryDraftStore());
  await tab2.init();
  await tab2.open(sid);
  assert.ok((await tab2.run('commitInitialAssessment', { problem_representation: 'p', hypotheses: ['h'], priorities: 'x', confidence: 50 })).ok);
  const before = store.events.get(sid)!.length;
  const stale = await tab1.run('commitInitialAssessment', { problem_representation: 'q', hypotheses: ['h'], priorities: 'x', confidence: 40 });
  assert.equal(!stale.ok && stale.code, 'CONFLICT');
  assert.equal(tab1.readOnly, true);
  assert.equal(tab1.saveStatus, 'conflict');
  assert.equal(store.events.get(sid)!.length, before);
});

test('SRV08 database and network failures release nothing', async () => {
  const { store, transport } = await server();
  const link = await newLink(transport);
  const gw = new RemoteGateway(transport, link.token, memoryDraftStore());
  await gw.init();
  store.failNextAppends = 1;
  const r = await gw.run('startSession', { participant_code: '', imaging_route: 'text_only', session_kind: 'participant', consent_statement_ids: CONSENT_STATEMENTS.map((c) => c.id), training_level: 'fellow' });
  assert.equal(!r.ok && r.code, 'SERVER_ERROR');
  assert.equal(gw.state.stage, 'START');
  assert.equal(store.sessions.size, 0);
  const offline = new RemoteGateway(async () => {
    throw new TypeError('Failed to fetch');
  }, link.token, memoryDraftStore());
  const r2 = await offline.run('startSession', { participant_code: '', imaging_route: 'text_only', session_kind: 'participant', consent_statement_ids: CONSENT_STATEMENTS.map((c) => c.id), training_level: 'fellow' });
  assert.equal(!r2.ok && r2.code, 'OFFLINE');
  assert.equal(offline.saveStatus, 'offline');
  assert.equal(offline.state.stage, 'START');
});

test('SRV09 the tutor path can only append tutor events', async () => {
  const { transport } = await server();
  const link = await newLink(transport);
  const gw = new RemoteGateway(transport, link.token, memoryDraftStore());
  await gw.init();
  await gw.run('startSession', { participant_code: '', imaging_route: 'text_only', session_kind: 'participant', consent_statement_ids: CONSENT_STATEMENTS.map((c) => c.id), training_level: 'fellow' });
  const forged = await transport({
    action: 'tutor_events',
    token: link.token,
    session_id: gw.state.sessionId!,
    expected_last_sequence: gw.state.lastSequence,
    drafts: [{ event_type: 'stage_transition', source: 'tutor', payload: { from: 'N1.assessment', to: 'N5.debrief' } } as unknown as EventDraft],
  });
  assert.equal(!forged.ok && forged.code, 'TUTOR_FORBIDDEN');
  const ev = await transport({ action: 'fac_session_events', key: FAC_KEY, session_id: gw.state.sessionId! });
  assert.ok(ev.ok);
  assert.equal(foldEvents((ev as { data: LoadedSession }).data.events).stage, 'N1.assessment');
});

test('SRV10 double submission sends one request', async () => {
  const { transport } = await server();
  const link = await newLink(transport);
  let calls = 0;
  const counting: Transport = (req) => {
    if (req.action === 'command') calls++;
    return transport(req);
  };
  const gw = new RemoteGateway(counting, link.token, memoryDraftStore());
  await gw.init();
  const input = { participant_code: '', imaging_route: 'text_only' as const, session_kind: 'participant' as const, consent_statement_ids: CONSENT_STATEMENTS.map((c) => c.id), training_level: 'fellow' };
  const [a, b] = await Promise.all([gw.run('startSession', input), gw.run('startSession', input)]);
  assert.ok(a.ok && b.ok);
  assert.equal(calls, 1);
});

test('SRV11 facilitator overview lists sessions with training level; withdrawal of access is reversible', async () => {
  const { transport } = await server();
  const link = await newLink(transport);
  const gw = new RemoteGateway(transport, link.token, memoryDraftStore());
  await gw.init();
  await gw.run('startSession', { participant_code: '', imaging_route: 'text_only', session_kind: 'participant', consent_statement_ids: CONSENT_STATEMENTS.map((c) => c.id), training_level: 'resident_4_plus' });
  const o = (await transport({ action: 'fac_overview', key: FAC_KEY })) as { ok: true; data: FacilitatorOverview };
  assert.equal(o.data.sessions.length, 1);
  assert.equal(o.data.sessions[0]!.training_level, 'resident_4_plus');
  assert.equal(o.data.sessions[0]!.participant_code, link.participant.participant_code);
  await transport({ action: 'fac_set_disabled', key: FAC_KEY, participant_id: link.participant.participant_id, disabled: true });
  await transport({ action: 'fac_set_disabled', key: FAC_KEY, participant_id: link.participant.participant_id, disabled: false });
  assert.ok((await transport({ action: 'whoami', token: link.token })).ok);
});

test('SRV12 participant and facilitator sources never import engine commands or hidden content', () => {
  for (const f of ['src/session/remoteGateway.ts', 'src/server/api.ts', 'src/mainRemote.tsx', 'src/facilitator/main.tsx', 'src/facilitator/FacilitatorApp.tsx']) {
    const src = readFileSync(f, 'utf8');
    assert.ok(!/from '[^']*engine\/(commands|registry)\.ts'|caseContent|assetManifest|scriptedJourney|localGateway/.test(src), `${f} must not import engine commands or hidden content`);
  }
});
