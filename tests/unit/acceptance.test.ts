// Engine, persistence, export and tutor acceptance tests (AT01-AT30, AT32).
// AT31 (keyboard journey) and DOM-level checks for AT01/AT21/AT22 run in tests/browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as C from '../../src/engine/commands.ts';
import { foldEvents } from '../../src/engine/reducer.ts';
import { catalogue, integratedRadiologyReport, releasedContent, sessionMetrics } from '../../src/engine/selectors.ts';
import { indexTreatmentComparison, narrativeStatements } from '../../src/engine/debrief.ts';
import { buildExport, replayExport } from '../../src/session/export.ts';
import { MemorySessionRepository } from '../../src/session/memoryRepository.ts';
import { SessionController, sequentialIds } from '../../src/session/controller.ts';
import { ScriptedTutor } from '../../src/tutor/scriptedTutor.ts';
import { requestSupport, runTutor } from '../../src/tutor/tutorService.ts';
import { validateTutorOutput } from '../../src/tutor/contract.ts';
import { PRESENTATION, RESULTS, OPERATIVE, CLINICAL_UPDATES, BRANCH_STEPS, FOLLOW_UP, BRANCH_SUMMARIES } from '../../src/case/caseContent.ts';
import { ASSET_MANIFEST } from '../../src/case/assetManifest.ts';
import type { SessionState } from '../../src/engine/types.ts';
import { HIDDEN_FUTURE_TERMS, journey, newController, startedAtWorkup } from './helpers.ts';

const types = (ctl: SessionController) => ctl.log.map((e) => e.event_type);
const json = (x: unknown) => JSON.stringify(x);

test('AT01 landing and N1 reveal no diagnosis, imaging result, operation, complication, or outcome', () => {
  const ctl = newController();
  ctl.dispatch(C.startSession, { participant_code: '', imaging_route: 'image_gate_placeholder', session_kind: 'participant' }, 's1');
  assert.equal(ctl.state.stage, 'N1.assessment');
  const visible = json(releasedContent(ctl.state)) + json(ctl.state.timeline);
  for (const term of HIDDEN_FUTURE_TERMS) assert.ok(!visible.toLowerCase().includes(term.toLowerCase()), `N1 leaked "${term}"`);
});

test('AT02 rationale alone cannot release a study', () => {
  const ctl = startedAtWorkup();
  const before = ctl.log.length;
  const r = ctl.dispatch(C.commitRequest, { investigation_id: 'lumbar_mri', rationale: 'why', expectation: '   ', confidence: null });
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.code, 'MISSING_EXPECTATION');
  assert.equal(ctl.log.length, before);
  assert.equal(ctl.state.investigations.lumbar_mri, undefined);
});

test('AT03 expectation alone cannot release a study', () => {
  const ctl = startedAtWorkup();
  const r = ctl.dispatch(C.commitRequest, { investigation_id: 'emg_ncs', rationale: '', expectation: 'expect', confidence: null });
  assert.equal(!r.ok && r.code, 'MISSING_RATIONALE');
  assert.ok(!types(ctl).includes('report_released'));
});

test('AT04 rationale and expectation persist as distinct ordered events before release', () => {
  const repo = new MemorySessionRepository();
  const ctl = startedAtWorkup('image_gate_placeholder', repo);
  const r = ctl.dispatch(C.commitRequest, { investigation_id: 'lumbar_mri', rationale: 'R text', expectation: 'E text', confidence: 40 });
  assert.ok(r.ok);
  const stored = repo.loadEvents('session-wu');
  const txn = stored[stored.length - 1]!.transaction_id;
  const tail = stored.filter((e) => e.transaction_id === txn && e.event_type !== 'clock_advanced').slice(0, 4);
  assert.deepEqual(tail.map((e) => e.event_type), ['investigation_requested', 'rationale_committed', 'expectation_committed', 'raw_data_released']);
  assert.equal(new Set(tail.map((e) => e.transaction_id)).size, 1);
  assert.ok(tail[0]!.sequence < tail[1]!.sequence && tail[1]!.sequence < tail[2]!.sequence && tail[2]!.sequence < tail[3]!.sequence);
  assert.equal((tail[1]!.payload as { text: string }).text, 'R text');
  assert.equal((tail[2]!.payload as { text: string }).text, 'E text');
});

test('AT05 imaging reports and annotations stay locked until interpretation commitment', () => {
  const ctl = startedAtWorkup();
  ctl.dispatch(C.commitRequest, { investigation_id: 'lumbar_mri', rationale: 'r', expectation: 'e', confidence: null });
  const rec = ctl.state.investigations.lumbar_mri!;
  assert.equal(rec.status, 'RAW_DATA_RELEASED');
  assert.equal(rec.report, null);
  assert.ok(rec.series && rec.series.length === 5 && rec.series.every((s) => s.placeholder));
  assert.equal(C.openAnnotations(ctl.state, { investigation_id: 'lumbar_mri' }).ok, false);
  assert.equal(C.commitModelUpdate(ctl.state, { investigation_id: 'lumbar_mri', effect: 'supports', explanation: '', decision: 'maintain', confidence: null, management_thinking: 'unchanged' }, { newId: (p) => p }).ok, false);
  assert.ok(!json(releasedContent(ctl.state)).includes('58 mm'));
  const empty = ctl.dispatch(C.commitInterpretation, { investigation_id: 'lumbar_mri', text: '  ', confidence: null });
  assert.equal(empty.ok, false);
  ctl.dispatch(C.commitInterpretation, { investigation_id: 'lumbar_mri', text: 'my reading', confidence: null });
  const after = ctl.state.investigations.lumbar_mri!;
  assert.ok(after.report);
  const ti = types(ctl);
  assert.ok(ti.lastIndexOf('interpretation_committed') < ti.lastIndexOf('report_released'));
});

test('AT06 non-imaging results follow their gate without an image step', () => {
  const ctl = startedAtWorkup();
  ctl.dispatch(C.commitRequest, { investigation_id: 'preop_labs', rationale: 'r', expectation: 'e', confidence: null });
  const rec = ctl.state.investigations.preop_labs!;
  assert.equal(rec.variant, 'non_imaging');
  assert.equal(rec.status, 'REPORT_RELEASED');
  assert.ok(rec.report);
  assert.equal(rec.series, null);
  assert.ok(!types(ctl).includes('raw_data_released'));
  assert.ok(ctl.dispatch(C.commitInterpretation, { investigation_id: 'preop_labs', text: 'normal', confidence: null }).ok);
  assert.ok(!json(rec.report).match(/\d+(\.\d+)?\s*(g\/dL|mg\/L|x10)/), 'no invented lab values');
});

test('AT07 integrated report includes only released and interpreted imaging', () => {
  const ctl = startedAtWorkup();
  ctl.dispatch(C.commitRequest, { investigation_id: 'standing_lumbar_xr', rationale: 'r', expectation: 'e', confidence: null });
  ctl.dispatch(C.commitInterpretation, { investigation_id: 'standing_lumbar_xr', text: 'i', confidence: null });
  ctl.dispatch(C.commitRequest, { investigation_id: 'lumbar_mri', rationale: 'r', expectation: 'e', confidence: null });
  const rep = integratedRadiologyReport(ctl.state);
  assert.deepEqual(rep.map((r) => r.investigation_id), ['standing_lumbar_xr']);
  const text = json(rep);
  for (const t of ['58 mm', '118 HU', '6.0 mm', 'Cobb']) assert.ok(!text.includes(t), `integrated report leaked ${t}`);
});

test('AT08 unusual or unavailable requests preserve text and generate no findings', () => {
  const ctl = startedAtWorkup();
  const before = json(releasedContent(ctl.state).investigations);
  const r = ctl.dispatch(C.requestUnsupported, { name: 'Upright MRI', rationale: 'Loaded imaging', expectation: 'More slip' });
  assert.ok(r.ok);
  assert.equal(ctl.state.unsupportedRequests[0]!.name, 'Upright MRI');
  assert.equal(ctl.state.unsupportedRequests[0]!.expectation, 'More slip');
  assert.equal(json(releasedContent(ctl.state).investigations), before);
  assert.ok(types(ctl).includes('boundary_response'));
  ctl.dispatch(C.commitRequest, { investigation_id: 'dxa', rationale: 'r', expectation: 'e', confidence: null });
  const rep = ctl.dispatch(C.requestRepeat, { investigation_id: 'dxa', rationale: 'again', expectation: 'change' });
  assert.ok(rep.ok);
  assert.equal(ctl.log.filter((e) => e.event_type === 'report_released').length, 1);
  assert.equal(ctl.state.investigations.dxa!.repeatRequests.length, 1);
});

test('AT09 previously revealed studies reopen without a duplicate order', () => {
  const ctl = startedAtWorkup();
  ctl.dispatch(C.commitRequest, { investigation_id: 'dynamic_xr', rationale: 'r', expectation: 'e', confidence: null });
  ctl.dispatch(C.openStudy, { investigation_id: 'dynamic_xr' });
  ctl.dispatch(C.openStudy, { investigation_id: 'dynamic_xr' });
  assert.equal(ctl.log.filter((e) => e.event_type === 'investigation_requested').length, 1);
  assert.equal(ctl.state.investigations.dynamic_xr!.reopenCount, 2);
  const again = ctl.dispatch(C.commitRequest, { investigation_id: 'dynamic_xr', rationale: 'r', expectation: 'e', confidence: null });
  assert.equal(!again.ok && again.code, 'ALREADY_REQUESTED');
});

test('AT10 revisions preserve original committed reasoning and version links', () => {
  const ctl = startedAtWorkup();
  const v1 = ctl.state.models[0]!;
  ctl.dispatch(C.reviseWorkingModel, { problem_representation: 'p2', hypotheses: ['h2'], priorities: 'x', reason: 'new idea', confidence: null });
  const v2 = ctl.state.models[1]!;
  assert.equal(ctl.state.models[0]!.problem_representation, v1.problem_representation);
  assert.equal(v2.predecessor_id, v1.version_id);
  assert.equal(v2.version, 2);
  ctl.dispatch(C.commitRequest, { investigation_id: 'emg_ncs', rationale: 'r', expectation: 'e', confidence: null });
  ctl.dispatch(C.commitInterpretation, { investigation_id: 'emg_ncs', text: 'original', confidence: null });
  ctl.dispatch(C.addInterpretationAddendum, { investigation_id: 'emg_ncs', text: 'addendum' });
  const ints = ctl.state.investigations.emg_ncs!.interpretations;
  assert.equal(ints[0]!.text, 'original');
  assert.equal(ints[1]!.predecessor_id, ints[0]!.reasoning_version_id);
  assert.equal(ctl.dispatch(C.commitInterpretation, { investigation_id: 'emg_ncs', text: 'overwrite', confidence: null }).ok, false);
});

test('AT11 fusion and nonoperative recommendations remain distinct from canonical decompression', () => {
  for (const category of ['decompression_fusion', 'nonoperative'] as const) {
    const ctl = journey({ category, stopAt: 'N3' });
    assert.equal(ctl.state.stage, 'N3.canonical_ack');
    ctl.dispatch(C.acknowledgeCanonical, undefined);
    assert.equal(ctl.state.recommendation!.recommendation.category, category);
    const ack = ctl.log.find((e) => e.event_type === 'canonical_continuation_acknowledged')!;
    const rec = ctl.log.find((e) => e.event_type === 'recommendation_committed')!;
    assert.notEqual(ack.event_id, rec.event_id);
    assert.ok(rec.sequence < ack.sequence);
    const cmp = indexTreatmentComparison(ctl.state)!;
    assert.match(cmp.note, /differ/);
    assert.match(cmp.participant, category === 'nonoperative' ? /Nonoperative/ : /fusion/);
  }
});

test('AT12 canonical continuation requires explicit acknowledgement', () => {
  const ctl = journey({ stopAt: 'N3' });
  assert.equal(ctl.state.canonicalExplained?.startsWith('For this first prototype, your recommendation has been saved.'), true);
  assert.equal(ctl.dispatch(C.continueProcedure, undefined).ok, false);
  assert.equal(ctl.state.procedureDescription, null);
  assert.ok(ctl.dispatch(C.acknowledgeCanonical, undefined).ok);
  assert.equal(ctl.state.stage, 'N4.procedure');
});

test('AT13 durotomy proposal is committed before the canonical repair is disclosed', () => {
  const ctl = journey({ stopAt: 'N3' });
  ctl.dispatch(C.acknowledgeCanonical, undefined);
  ctl.dispatch(C.continueProcedure, undefined);
  assert.equal(ctl.dispatch(C.revealTeamAction, undefined).ok, false);
  assert.equal(ctl.state.teamAction, null);
  assert.ok(!json(releasedContent(ctl.state)).includes('Valsalva'));
  ctl.dispatch(C.commitIntraopProposal, { immediate: 'my plan', checks: '', postop_considerations: '', confidence: null });
  ctl.dispatch(C.revealTeamAction, undefined);
  const p = ctl.log.find((e) => e.event_type === 'intraop_proposal_committed')!;
  const t = ctl.log.find((e) => e.event_type === 'team_action_released')!;
  assert.ok(p.sequence < t.sequence);
  assert.equal(ctl.state.intraopProposal!.immediate, 'my plan');
});

const HARDWARE = /(screw|rod\b|rods\b|cage|implant|instrumented|interbody|TLIF|PLIF)/i;
function hardwareMentions(text: string): string[] {
  const hits: string[] = [];
  const sentences = text.split(/(?<=[.;"])\s+/);
  for (const s of sentences) {
    if (HARDWARE.test(s)) hits.push(s);
    if (/fusion|instrumentation|hardware/i.test(s) && !/(no|without|nor|not)\s+(fusion|instrumentation|hardware)|no fusion or instrumentation|fusion or instrumentation are performed|No hardware/i.test(s)) hits.push(s);
  }
  return hits;
}

test('AT14 postoperative images and notes remain free of instrumentation', () => {
  const post = json([RESULTS.postop_mri, RESULTS.postop_ct, RESULTS.postop_labs, RESULTS.followup_xr, OPERATIVE, CLINICAL_UPDATES, BRANCH_STEPS, FOLLOW_UP]);
  const hits = hardwareMentions(post);
  assert.deepEqual(hits, []);
  const postAssets = ASSET_MANIFEST.filter((a) => a.node === 'N4' || a.node === 'N5');
  for (const a of postAssets) assert.equal(a.frame_paths, null, `${a.asset_id} has no unreviewed file`);
});

test('AT15 B1 resolves after 72-hour drainage with no forced recurrence or reoperation', () => {
  const ctl = journey({ firstAction: 'opt_drain' });
  assert.deepEqual(ctl.state.branchSteps.map((s) => s.id), ['B1_start', 'B1_resolved']);
  const text = json(ctl.state.branchSteps);
  assert.match(text, /72 hours/);
  assert.ok(!/clamp|recurr|48 hours|reoperat/i.test(text));
  assert.match(text, /No re-exploration was performed/);
  assert.equal(ctl.state.followUp!.branch_id, 'B1');
  assert.equal(ctl.state.completion!.completion_status, 'clinical_pathway_completed');
});

test('AT16 B2 exposes persistence and the drain rescue only after a second commitment', () => {
  const ctl = journey({ firstAction: 'opt_observe', stopAt: 'branch' });
  ctl.dispatch(C.confirmBranchSelection, { option_id: 'opt_observe' });
  ctl.dispatch(C.advanceBranch, undefined);
  assert.equal(ctl.state.stage, 'N4.B2.persistence');
  assert.equal(ctl.dispatch(C.advanceBranch, undefined).ok, false);
  assert.ok(!ctl.state.branchSteps.some((s) => s.id === 'B2_rescue_start'));
  const plansBefore = ctl.state.plans.length;
  ctl.dispatch(C.commitSecondDecision, { plan: 'drain now', rationale: '', monitoring: '', threshold: '', confidence: 50, option_id: 'opt_drain' });
  assert.equal(ctl.state.plans.length, plansBefore + 1);
  assert.equal(ctl.state.plans[1]!.predecessor_id, ctl.state.plans[0]!.plan_version_id);
  ctl.dispatch(C.advanceBranch, undefined);
  assert.equal(ctl.state.stage, 'N4.B2.resolved');
  ctl.dispatch(C.advanceToFollowUp, undefined);
  assert.equal(ctl.state.followUp!.followup.measures.length, 0);
});

test('AT16b B2 repeated observation pauses for review instead of inventing an outcome', () => {
  const ctl = journey({ firstAction: 'opt_observe', secondAction: 'opt_observe' });
  assert.equal(ctl.state.status, 'paused_for_review');
  assert.ok(!ctl.state.branchSteps.some((s) => /resolv|meningitis|deficit/i.test(s.lines.join(' ')) && s.id !== 'B2_persistence'));
});

test('AT17 B3 resolves with added operative burden and no unauthored operative findings', () => {
  const ctl = journey({ firstAction: 'opt_reexplore' });
  assert.deepEqual(ctl.state.branchSteps.map((s) => s.id), ['B3_start', 'B3_resolved']);
  assert.match(json(ctl.state.branchSteps), /additional operation/);
  assert.ok(!/found|identified|defect measured|graft|patch/i.test(json(ctl.state.branchSteps)));
});

test('AT18 B4 exposes persistence and enters review for an unauthored rescue outcome', () => {
  const ctl = journey({ firstAction: 'opt_defer', secondAction: 'opt_drain' });
  assert.ok(ctl.state.branchSteps.some((s) => s.id === 'B4_persistence'));
  assert.equal(ctl.state.reviewPause !== null, true);
  assert.equal(ctl.state.followUp, null);
  assert.equal(ctl.state.plans.length, 2);
  assert.equal(ctl.state.stage, 'N5.debrief');
});

test('AT19 an unsupported clinical action pauses without new harm, success, or probabilities', () => {
  const ctl = journey({ firstAction: 'opt_none', stopAt: undefined });
  assert.equal(ctl.state.status, 'paused_for_review');
  assert.equal(ctl.state.branchSteps.length, 0);
  assert.equal(ctl.state.followUp, null);
  const pause = ctl.state.reviewPause!;
  assert.match(pause.copy, /does not contain an expert-authored consequence/);
  assert.equal(pause.preserved.plan, 'Sample: postoperative management plan');
  assert.ok(!/%|probab|likely to|meningitis/i.test(json(pause)));
});

function clinicalOnly(s: SessionState) {
  const { tutor: _t, lastSequence: _l, ...rest } = s;
  return json(rest);
}

test('AT20 tutor actions cannot mutate clinical state, order a study, or select a branch', () => {
  const ctl = startedAtWorkup();
  const tutor = new ScriptedTutor();
  const before = clinicalOnly(ctl.state);
  runTutor(ctl, tutor, { kind: 'session_started' });
  requestSupport(ctl, tutor, 'clarify');
  requestSupport(ctl, tutor, 'support');
  requestSupport(ctl, tutor, 'discriminate');
  requestSupport(ctl, tutor, 'alternative');
  assert.equal(clinicalOnly(ctl.state), before);
  const forged = ctl.appendTutorEvents([{ event_type: 'investigation_requested', source: 'tutor', payload: { investigation_id: 'lumbar_mri', title: 'x', repeat: false } }]);
  assert.equal(!forged.ok && forged.code, 'TUTOR_FORBIDDEN');
  const forgedBranch = ctl.appendTutorEvents([{ event_type: 'stage_transition', source: 'tutor', payload: { from: 'N2.workup', to: 'N5.debrief' } }]);
  assert.equal(forgedBranch.ok, false);
  assert.equal(validateTutorOutput({ mode: 'support', message: 'x', grounding_ids: [], requires_human_review: false, next_stage: 'N5' }), false);
  const tutorSrc = readdirSync('src/tutor').map((f) => readFileSync(join('src/tutor', f), 'utf8')).join('\n');
  assert.ok(!/engine\/commands|caseContent/.test(tutorSrc), 'tutor must not import commands or hidden content');
  // budget: never more than 3 probes per node
  const probes = ctl.state.tutor.messages.filter((m) => m.role === 'tutor' && !['orientation', 'boundary'].includes(m.mode));
  assert.ok(probes.length <= 3);
});

test('AT21 selectors, reducer, tutor and UI never import hidden content; N2 catalogue shows no results', () => {
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, f.name);
      if (f.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(f.name) && readFileSync(p, 'utf8').includes('caseContent')) offenders.push(p);
    }
  };
  walk('src');
  assert.deepEqual(offenders.sort(), ['src/engine/commands.ts']);
  const ctl = startedAtWorkup();
  const cat = json(catalogue(ctl.state, 'preop').map((c) => ({ t: c.def.title, d: c.def.description, s: c.nextStep })));
  for (const term of HIDDEN_FUTURE_TERMS) assert.ok(!cat.toLowerCase().includes(term.toLowerCase()), `catalogue leaked ${term}`);
});

test('AT22 text-only demonstration route and asset notices are explicit in export', () => {
  const ctl = startedAtWorkup('text_only');
  ctl.dispatch(C.commitRequest, { investigation_id: 'lumbar_mri', rationale: 'r', expectation: 'e', confidence: null });
  const rec = ctl.state.investigations.lumbar_mri!;
  assert.equal(rec.variant, 'text_only');
  assert.match(rec.imageUnavailableReason ?? '', /Text-only/);
  ctl.dispatch(C.recordAssetNotice, { asset_id: 'MRI-N2-004', kind: 'load_error', detail: 'missing file' });
  const exp = buildExport(ctl.log);
  assert.ok(exp.notice.some((n) => /Text-only/.test(n)));
  assert.equal(exp.released_content.investigations[0]!.route_encountered, 'text_only');
  assert.equal(exp.released_content.asset_notices[0]!.kind, 'load_error');
});

test('AT23 refresh restores release gates, committed versions, state and event order', () => {
  const repo = new MemorySessionRepository();
  const ctl = startedAtWorkup('image_gate_placeholder', repo);
  ctl.dispatch(C.commitRequest, { investigation_id: 'lumbar_mri', rationale: 'r', expectation: 'e', confidence: null });
  ctl.dispatch(C.commitInterpretation, { investigation_id: 'lumbar_mri', text: 'read', confidence: null });
  ctl.dispatch(C.commitRequest, { investigation_id: 'lumbar_ct', rationale: 'r', expectation: 'e', confidence: null });
  ctl.setDraft('interp:lumbar_ct', 'half-written');
  const fresh = new SessionController(repo, sequentialIds('2026-10-12T13:00:00.000Z'));
  fresh.load('session-wu');
  assert.equal(fresh.state.stage, 'N2.workup');
  assert.ok(fresh.state.investigations.lumbar_mri!.report);
  assert.equal(fresh.state.investigations.lumbar_ct!.report, null);
  assert.equal(fresh.state.investigations.lumbar_ct!.status, 'RAW_DATA_RELEASED');
  assert.equal(fresh.drafts['interp:lumbar_ct'], 'half-written');
  const seqs = fresh.log.map((e) => e.sequence);
  assert.deepEqual(seqs, seqs.map((_, i) => i + 1));
  assert.equal(fresh.log[fresh.log.length - 1]!.event_type, 'session_resumed');
});

test('AT24 persistence failure prevents an unrecorded reveal and allows retry', () => {
  const repo = new MemorySessionRepository();
  const ctl = startedAtWorkup('image_gate_placeholder', repo);
  repo.failNextWrites = 1;
  const r = ctl.dispatch(C.commitRequest, { investigation_id: 'lumbar_mri', rationale: 'r', expectation: 'e', confidence: null });
  assert.equal(!r.ok && r.code, 'PERSISTENCE_FAILED');
  assert.equal(ctl.state.investigations.lumbar_mri, undefined);
  assert.equal(ctl.saveStatus, 'failed');
  assert.ok(!repo.loadEvents('session-wu').some((e) => e.event_type === 'raw_data_released'));
  const retry = ctl.dispatch(C.commitRequest, { investigation_id: 'lumbar_mri', rationale: 'r', expectation: 'e', confidence: null });
  assert.ok(retry.ok);
});

test('AT25 export contains the experienced trace and excludes hidden future payloads', () => {
  const ctl = startedAtWorkup();
  ctl.dispatch(C.commitRequest, { investigation_id: 'standing_lumbar_xr', rationale: 'r', expectation: 'e', confidence: null });
  const exp = json(buildExport(ctl.log));
  for (const hidden of ['pseudomeningocele', 'Valsalva', '900 m', '48 x 18 x 55', '118 HU', '58 mm', 'L4-L5 translation 4.5 mm', 'durotomy', 'six-week']) {
    assert.ok(!exp.toLowerCase().includes(hidden.toLowerCase()), `export leaked ${hidden}`);
  }
  assert.ok(exp.includes('rationale_committed'));
  const full = buildExport(journey().log);
  assert.equal(full.session.completion_status, 'clinical_pathway_completed');
  assert.ok(json(full).includes('900 m'));
});

test('AT26 replay reproduces the committed sequence and released consequences', () => {
  for (const firstAction of ['opt_drain', 'opt_observe', 'opt_reexplore', 'opt_defer', 'opt_none'] as const) {
    const ctl = journey({ firstAction });
    const exp = JSON.parse(json(buildExport(ctl.log)));
    const rep = replayExport(exp);
    assert.deepEqual(rep.problems, []);
    assert.equal(json(releasedContent(rep.state!)), json(releasedContent(ctl.state)));
    assert.equal(rep.state!.stage, ctl.state.stage);
  }
  const tampered = JSON.parse(json(buildExport(journey().log)));
  tampered.events[3].payload.text = 'edited later';
  assert.equal(replayExport(tampered).ok, false);
});

test('AT27 restart produces a distinct session and preserves the prior record', () => {
  const repo = new MemorySessionRepository();
  const a = journey({ sessionId: 'session-A' }, repo);
  a.reset();
  const b = journey({ sessionId: 'session-B', stopAt: 'N2' }, repo);
  assert.notEqual(a.state.sessionId, b.state.sessionId);
  assert.ok(repo.loadEvents('session-A').length > 50);
  assert.equal(repo.listSessions().length, 2);
});

test('AT28 simulated clinical time is distinct from real elapsed time', () => {
  const ctl = journey();
  const drainStart = ctl.log.find((e) => e.event_type === 'branch_consequence_released' && e.payload.step.id === 'B1_start')!;
  const drainEnd = ctl.log.find((e) => e.event_type === 'branch_consequence_released' && e.payload.step.id === 'B1_resolved')!;
  assert.equal(drainStart.simulated_time, 'POD4');
  assert.equal(drainEnd.simulated_time, 'POD7');
  const realSeconds = (Date.parse(drainEnd.timestamp_utc) - Date.parse(drainStart.timestamp_utc)) / 1000;
  assert.ok(realSeconds < 3600, 'a 72-hour clinical interval takes no real waiting time');
  const m = sessionMetrics(ctl.state, ctl.log[0]!.timestamp_utc, ctl.log[ctl.log.length - 1]!.timestamp_utc);
  assert.ok(m.find((x) => x.label === 'Real elapsed time'));
  assert.ok(m.find((x) => x.label === 'Simulated clinical time reached'));
});

test('AT29 B1 six-week measures match frozen values; other branches inherit no numbers', () => {
  const b1 = journey().state.followUp!.followup;
  const get = (l: string) => b1.measures.find((m) => m.label === l)!.followUp;
  assert.equal(get('Walking tolerance'), '900 m');
  assert.equal(get('Back pain'), '3/10');
  assert.equal(get('Right leg pain'), '2/10');
  assert.equal(get('ODI'), '24%');
  assert.equal(get('Right EHL strength'), '5/5');
  assert.equal(get('Left leg pain'), 'Not recorded in this case');
  for (const a of ['opt_reexplore'] as const) {
    const fu = journey({ firstAction: a }).state.followUp!.followup;
    assert.equal(fu.measures.length, 0);
    assert.ok(!/\d+\/10|\d+%|\d+ m\b/.test(json(fu)));
  }
});

test('AT30 debrief has no grading, competence labels, or fabricated evidence claims', () => {
  for (const firstAction of ['opt_drain', 'opt_none'] as const) {
    const ctl = journey({ firstAction });
    const text = json([narrativeStatements(ctl.state), sessionMetrics(ctl.state, null, null), indexTreatmentComparison(ctl.state)]);
    assert.ok(!/\b(correct|incorrect|score|scored|pass|passed|fail|failed|competen\w*|entrust\w*|percentile|excellent|well done)\b/i.test(text), text);
    assert.ok(!/(et al\.|doi:|\bstudy shows\b|\bevidence shows\b)/i.test(text));
  }
});

test('AT32 case content contains only the latest patient and imaging facts', () => {
  const all = json([PRESENTATION, RESULTS, OPERATIVE, CLINICAL_UPDATES, BRANCH_STEPS, FOLLOW_UP, BRANCH_SUMMARIES]);
  const superseded: [RegExp, string][] = [
    [/\b66\b/, '66-year-old'],
    [/retired teacher/i, 'retired teacher'],
    [/EHL[^.]{0,20}\b4\/5\b(?!\+)/, 'EHL 4/5'],
    [/\b7 mm\b/, 'standing translation 7 mm'],
    [/\b9 mm\b/, 'dynamic translation 9 mm'],
    [/\b5 degrees\b/, 'angular change 5 degrees'],
    [/TLIF/i, 'TLIF'],
    [/48 hours/i, '48 hours additional drainage'],
    [/clamp/i, 'clamp trial'],
    [/beta-2 transferrin/i, 'beta-2 transferrin result'],
    [/patch|graft/i, 'patch or graft'],
  ];
  for (const [re, label] of superseded) assert.ok(!re.test(all), `superseded detail present: ${label}`);
  assert.equal(PRESENTATION.patient.ageYears, 64);
  assert.match(PRESENTATION.patient.occupation, /Architect/);
  assert.equal(ASSET_MANIFEST.length, 43);
  assert.equal(new Set(ASSET_MANIFEST.map((a) => a.asset_id)).size, 43);
  assert.ok(ASSET_MANIFEST.every((a) => a.frame_paths === null && a.approval_state === 'Planned'));
  assert.match(json(RESULTS.dynamic_xr), /6\.0 mm[\s\S]*3\.0 mm[\s\S]*8 degrees/);
  assert.match(json(RESULTS.lumbar_mri), /2\.5 mm/);
  assert.match(json(RESULTS.standing_lumbar_xr), /4\.5 mm/);
});

test('Export round trip: replay of a stored reference export reconstructs state', () => {
  const ctl = journey();
  const exp = buildExport(ctl.log);
  const st = foldEvents(exp.events);
  assert.equal(st.stage, 'N5.debrief');
  assert.equal(st.status, 'completed');
});
