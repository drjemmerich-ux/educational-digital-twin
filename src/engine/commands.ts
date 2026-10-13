// Guarded command handlers: the deterministic case engine.
// Every command validates against current state and returns event drafts, or a rejection.
// Disabled buttons in the UI are a convenience only; these guards are the real boundary.
// This is the ONLY module allowed to read hidden case content.
import { ASSET_MANIFEST } from '../case/assetManifest.ts';
import {
  BRANCH_MAP,
  BRANCH_STEPS,
  BRANCH_SUMMARIES,
  CLINICAL_UPDATES,
  FACULTY_PERSPECTIVE,
  FOLLOW_UP,
  READING_LIST,
  OPERATIVE,
  PRESENTATION,
  RESULTS,
  SIM,
} from '../case/caseContent.ts';
import {
  CANONICAL_CONTINUATION_COPY,
  CONSENT_STATEMENTS,
  CONSENT_VERSION,
  TRAINING_LEVELS,
  EXPERT_REVIEW_COPY,
  POSTOP_ACTION_OPTIONS,
  STRATEGY_CATEGORIES,
  getInvestigationDef,
} from '../case/publicCatalogue.ts';
import type { BranchId, BranchOptionId, InvestigationDef, SimTime } from '../case/types.ts';
import type { CourseId } from '../case/caseContent.ts';
import { CURRENT_VERSIONS } from '../case/versions.ts';
import { emptyInvestigation } from './reducer.ts';
import { contextStageOf } from './stageRules.ts';
import type {
  ConsentRecord,
  EffectOnModel,
  EventDraft,
  EventPayloads,
  ImagingRoute,
  InvestigationRecord,
  ManagementThinking,
  ModelChain,
  ModelVersion,
  PlanInput,
  RecommendationInput,
  ReleasedReport,
  ReleasedSeries,
  SessionKind,
  SessionState,
  Stage,
} from './types.ts';

export type CommandResult = { ok: true; drafts: EventDraft[] } | { ok: false; code: string; message: string };
export interface CommandContext {
  newId: (prefix: string) => string;
}

const ok = (drafts: EventDraft[]): CommandResult => ({ ok: true, drafts });
const reject = (code: string, message: string): CommandResult => ({ ok: false, code, message });
const filled = (s: string | undefined | null): s is string => typeof s === 'string' && s.trim().length > 0;
const validConfidence = (c: unknown): c is number => typeof c === 'number' && Number.isFinite(c) && c >= 0 && c <= 100;

function engine<K extends keyof EventPayloads>(event_type: K, payload: EventPayloads[K]): EventDraft {
  return { event_type, source: 'engine', payload } as EventDraft;
}
function learner<K extends keyof EventPayloads>(event_type: K, payload: EventPayloads[K]): EventDraft {
  return { event_type, source: 'learner', payload } as EventDraft;
}
function transition(from: Stage, to: Stage, sim_time?: SimTime): EventDraft {
  return engine('stage_transition', sim_time ? { from, to, sim_time } : { from, to });
}

// Simulated clinical clock ordering (codes only; independent of real elapsed time).
const SIM_ORDER = ['T-6m', 'T0', 'T+7d', 'T+10d', 'T+12d', 'T+14d', 'POD0', 'POD1', 'POD3', 'POD4', 'POD4+obs', 'POD4+reop', 'POD4+defer', 'B2-resolved', 'POD7', 'W6'];
const simRank = (code: string) => SIM_ORDER.indexOf(code);

function clockIfLater(state: SessionState, t: SimTime, reason: string): EventDraft[] {
  return simRank(t.code) > simRank(state.simTime.code) ? [engine('clock_advanced', { sim_time: t, reason })] : [];
}

function invRecord(state: SessionState, id: string): InvestigationRecord {
  return state.investigations[id] ?? emptyInvestigation(id);
}

/** Stage in which an investigation context is actionable. */
export function contextStage(def: InvestigationDef): Stage {
  return contextStageOf(def.context);
}

export function isRequestableNow(state: SessionState, def: InvestigationDef): boolean {
  if (state.stage !== contextStage(def)) return false;
  if (def.context === 'followup' && state.branchId !== 'B1') return false;
  return true;
}

function chainForStage(stage: Stage): ModelChain {
  return stage === 'N2.workup' || stage.startsWith('N1') ? 'preop' : 'postop';
}

function currentModel(state: SessionState, chain: ModelChain): ModelVersion | undefined {
  const id = state.currentModelId[chain];
  return state.models.find((m) => m.version_id === id);
}

function nextModel(
  state: SessionState,
  ctx: CommandContext,
  chain: ModelChain,
  trigger: string,
  fields: { problem_representation: string; hypotheses: string[]; priorities: string; confidence: number | null },
): Omit<ModelVersion, 'sequence'> {
  const prev = currentModel(state, chain);
  return {
    version_id: ctx.newId('model'),
    chain,
    version: (prev?.version ?? 0) + 1,
    predecessor_id: prev?.version_id ?? null,
    trigger,
    problem_representation: fields.problem_representation.trim(),
    hypotheses: fields.hypotheses.map((h) => h.trim()).filter((h) => h.length > 0),
    priorities: fields.priorities.trim(),
    confidence: fields.confidence,
  };
}

function releasedSeries(invId: string): ReleasedSeries[] {
  const res = RESULTS[invId];
  if (!res) return [];
  return res.series.map((sp) => {
    const m = ASSET_MANIFEST.find((a) => a.asset_id === sp.assetId);
    const framePaths = m?.frame_paths ?? null;
    return { ...sp, framePaths, approvalState: m?.approval_state ?? 'Planned', placeholder: framePaths === null };
  });
}

function releasedReport(invId: string): ReleasedReport {
  const res = RESULTS[invId];
  if (!res) throw new Error(`No authored result for ${invId}`);
  return {
    title: res.reportTitle,
    sections: res.sections,
    accessibleSummary: res.accessibleSummary,
    acquiredAt: res.acquiredAt,
    annotation: {
      available: false,
      reason: res.annotationAssetIds.length
        ? `Annotated teaching copy (${res.annotationAssetIds.join(', ')}) is planned but awaiting expert validation.`
        : 'No validated annotation copy is planned for this study.',
    },
  };
}

// ---------------------------------------------------------------------------
// N1
// ---------------------------------------------------------------------------
export function startSession(
  state: SessionState,
  input: {
    participant_code: string;
    imaging_route: ImagingRoute;
    session_kind: SessionKind;
    consent_statement_ids?: string[];
    training_level?: string | null;
  },
): CommandResult {
  if (state.stage !== 'START') return reject('WRONG_STAGE', 'This session has already started.');
  let consent: ConsentRecord | null = null;
  let training: string | null = null;
  if (input.session_kind === 'participant') {
    const given = new Set(input.consent_statement_ids ?? []);
    const missing = CONSENT_STATEMENTS.filter((c) => !given.has(c.id));
    if (missing.length) return reject('CONSENT_REQUIRED', 'Please confirm every consent statement to start the session.');
    if (!TRAINING_LEVELS.some((t) => t.id === input.training_level)) return reject('MISSING_FIELD', 'Select your training level.');
    consent = { consent_version: CONSENT_VERSION, statement_ids: CONSENT_STATEMENTS.map((c) => c.id), accepted: true };
    training = input.training_level ?? null;
  }
  return ok([
    {
      event_type: 'session_started',
      source: 'system',
      payload: {
        participant_code: input.participant_code.trim(),
        imaging_route: input.imaging_route,
        session_kind: input.session_kind,
        versions: CURRENT_VERSIONS,
        consent,
        training_level: training,
      },
    },
    engine('presentation_released', { presentation: PRESENTATION, sim_time: SIM.T0 }),
    transition('START', 'N1.assessment', SIM.T0),
  ]);
}

export function commitInitialAssessment(
  state: SessionState,
  input: { problem_representation: string; hypotheses: string[]; priorities: string; confidence: number },
  ctx: CommandContext,
): CommandResult {
  if (state.stage !== 'N1.assessment') return reject('WRONG_STAGE', 'The initial assessment can only be committed at the initial presentation.');
  if (!filled(input.problem_representation)) return reject('MISSING_FIELD', 'Enter a problem representation.');
  if (!input.hypotheses.some(filled)) return reject('MISSING_FIELD', 'Enter at least one working hypothesis.');
  if (!filled(input.priorities)) return reject('MISSING_FIELD', 'Enter your information priorities.');
  if (!validConfidence(input.confidence)) return reject('MISSING_CONFIDENCE', 'Record your confidence (0 to 100).');
  const model = nextModel(state, ctx, 'preop', 'initial_assessment', { ...input });
  return ok([learner('initial_assessment_committed', { model }), transition('N1.assessment', 'N2.workup', SIM.T0)]);
}

export function reviseWorkingModel(
  state: SessionState,
  input: { problem_representation: string; hypotheses: string[]; priorities: string; reason: string; confidence: number | null },
  ctx: CommandContext,
): CommandResult {
  const allowed: Stage[] = ['N2.workup', 'N4.postop_workup', 'N4.branch_selection'];
  if (!allowed.includes(state.stage)) return reject('WRONG_STAGE', 'The working model cannot be revised at this point.');
  if (!filled(input.problem_representation) || !input.hypotheses.some(filled)) {
    return reject('MISSING_FIELD', 'A revised model needs a problem representation and at least one hypothesis.');
  }
  if (input.confidence !== null && !validConfidence(input.confidence)) return reject('MISSING_CONFIDENCE', 'Confidence must be 0 to 100.');
  const chain = chainForStage(state.stage);
  const model = nextModel(state, ctx, chain, 'manual_revision', input);
  return ok([learner('working_model_revised', { model, reason: input.reason.trim() })]);
}

// ---------------------------------------------------------------------------
// Investigation loop
// ---------------------------------------------------------------------------
export function commitRequest(
  state: SessionState,
  input: { investigation_id: string; rationale: string; expectation: string; confidence: number | null },
  ctx: CommandContext,
): CommandResult {
  const def = getInvestigationDef(input.investigation_id);
  if (!def) return reject('UNKNOWN_INVESTIGATION', 'This investigation is not in the catalogue.');
  if (!isRequestableNow(state, def)) return reject('NOT_AVAILABLE', 'This investigation is not available in the current clinical state.');
  const rec = invRecord(state, def.id);
  if (rec.status !== 'AVAILABLE') return reject('ALREADY_REQUESTED', 'This study has already been released. Reopen it, or record a repeat request.');
  if (!filled(input.rationale)) return reject('MISSING_RATIONALE', 'Explain why you are requesting this study now.');
  if (!filled(input.expectation)) return reject('MISSING_EXPECTATION', 'State what you expect this study to clarify or demonstrate.');
  if (input.confidence !== null && !validConfidence(input.confidence)) return reject('MISSING_CONFIDENCE', 'Confidence must be 0 to 100.');
  const result = RESULTS[def.id];
  if (!result) return reject('NO_AUTHORED_RESULT', 'No authored result exists for this study.');

  const drafts: EventDraft[] = [
    learner('investigation_requested', { investigation_id: def.id, title: def.title, repeat: false }),
    learner('rationale_committed', { investigation_id: def.id, text: input.rationale.trim(), reasoning_version_id: ctx.newId('rv') }),
    learner('expectation_committed', { investigation_id: def.id, text: input.expectation.trim(), reasoning_version_id: ctx.newId('rv'), confidence: input.confidence }),
  ];
  // Advance the simulated clock first so the release is stamped at its acquisition time.
  drafts.push(...clockIfLater(state, result.acquiredAt, `${def.title} result available`));
  const imaging = def.kind === 'imaging';
  if (imaging && state.imagingRoute === 'image_gate_placeholder') {
    drafts.push(engine('raw_data_released', { investigation_id: def.id, series: releasedSeries(def.id), acquired_at: result.acquiredAt, variant: 'image_gate' }));
  } else if (imaging) {
    drafts.push(
      engine('image_interpretation_unavailable', {
        investigation_id: def.id,
        reason: 'Text-only demonstration route selected for this session: validated images are not available. Authored findings released without an image-reading step.',
      }),
      engine('report_released', { investigation_id: def.id, report: releasedReport(def.id), variant: 'text_only' }),
    );
  } else {
    drafts.push(engine('report_released', { investigation_id: def.id, report: releasedReport(def.id), variant: 'non_imaging' }));
  }
  return ok(drafts);
}

export function switchStudyToTextOnly(state: SessionState, input: { investigation_id: string; reason: string }): CommandResult {
  const rec = invRecord(state, input.investigation_id);
  if (rec.variant !== 'image_gate' || rec.status !== 'RAW_DATA_RELEASED') {
    return reject('NOT_APPLICABLE', 'Only a released image study awaiting interpretation can switch to the text-only route.');
  }
  if (!filled(input.reason)) return reject('MISSING_FIELD', 'Record why image interpretation is not possible.');
  return ok([
    learner('image_interpretation_unavailable', { investigation_id: rec.id, reason: input.reason.trim() }),
    engine('report_released', { investigation_id: rec.id, report: releasedReport(rec.id), variant: 'text_only' }),
  ]);
}

export function commitInterpretation(
  state: SessionState,
  input: { investigation_id: string; text: string; confidence: number | null },
  ctx: CommandContext,
): CommandResult {
  const def = getInvestigationDef(input.investigation_id);
  if (!def) return reject('UNKNOWN_INVESTIGATION', 'Unknown investigation.');
  if (state.stage !== contextStage(def)) return reject('WRONG_STAGE', 'Interpretation for this study is closed at this point in the case.');
  const rec = invRecord(state, def.id);
  if (!filled(input.text)) return reject('MISSING_INTERPRETATION', 'Record what you see and which findings are most relevant.');
  if (rec.interpretations.length > 0) return reject('ALREADY_INTERPRETED', 'Your interpretation is committed. Add an addendum to extend it.');
  if (input.confidence !== null && !validConfidence(input.confidence)) return reject('MISSING_CONFIDENCE', 'Confidence must be 0 to 100.');
  const commit = learner('interpretation_committed', { investigation_id: def.id, text: input.text.trim(), reasoning_version_id: ctx.newId('rv'), confidence: input.confidence });
  if (rec.variant === 'image_gate' && rec.status === 'RAW_DATA_RELEASED') {
    return ok([commit, engine('report_released', { investigation_id: def.id, report: releasedReport(def.id), variant: 'image_gate' })]);
  }
  if ((rec.variant === 'non_imaging' || rec.variant === 'text_only') && rec.status === 'REPORT_RELEASED') return ok([commit]);
  return reject('NOT_RELEASED', 'There is no released result to interpret yet.');
}

export function addInterpretationAddendum(state: SessionState, input: { investigation_id: string; text: string }, ctx: CommandContext): CommandResult {
  const rec = invRecord(state, input.investigation_id);
  const last = rec.interpretations[rec.interpretations.length - 1];
  if (!last) return reject('NOT_INTERPRETED', 'Commit an interpretation first.');
  if (!filled(input.text)) return reject('MISSING_FIELD', 'The addendum is empty.');
  return ok([
    learner('interpretation_revised', { investigation_id: rec.id, text: input.text.trim(), reasoning_version_id: ctx.newId('rv'), predecessor_id: last.reasoning_version_id }),
  ]);
}

export function commitModelUpdate(
  state: SessionState,
  input: {
    investigation_id: string;
    effect: EffectOnModel | null;
    explanation: string;
    decision: 'maintain' | 'revise' | null;
    revised?: { problem_representation: string; hypotheses: string[]; priorities: string };
    confidence: number | null;
    management_thinking: ManagementThinking | null;
  },
  ctx: CommandContext,
): CommandResult {
  const def = getInvestigationDef(input.investigation_id);
  if (!def) return reject('UNKNOWN_INVESTIGATION', 'Unknown investigation.');
  if (state.stage !== contextStage(def)) return reject('WRONG_STAGE', 'This study can no longer be integrated at this point in the case.');
  const rec = invRecord(state, def.id);
  if (!rec.report || rec.interpretations.length === 0) return reject('INTERPRETATION_REQUIRED', 'Interpretation and report must both be available first.');
  if (rec.modelUpdate) return reject('ALREADY_UPDATED', 'The model update for this study is already committed.');
  if (!input.effect) return reject('MISSING_FIELD', 'Indicate how the result affects your hypotheses.');
  if (!input.decision) return reject('MISSING_FIELD', 'Choose to maintain or revise your working model.');
  if (!input.management_thinking) return reject('MISSING_FIELD', 'Indicate whether your management thinking changed.');
  if (input.confidence !== null && !validConfidence(input.confidence)) return reject('MISSING_CONFIDENCE', 'Confidence must be 0 to 100.');
  const chain: ModelChain = def.context === 'preop' ? 'preop' : 'postop';
  const drafts: EventDraft[] = [];
  let resultingId = state.currentModelId[chain] ?? '';
  if (input.decision === 'revise') {
    const r = input.revised;
    if (!r || !filled(r.problem_representation) || !r.hypotheses.some(filled)) {
      return reject('MISSING_FIELD', 'A revised model needs a problem representation and at least one hypothesis.');
    }
    const model = nextModel(state, ctx, chain, `study_update:${def.id}`, { ...r, confidence: input.confidence });
    resultingId = model.version_id;
    drafts.push(learner('working_model_revised', { model, reason: `After ${def.title}` }));
  }
  drafts.push(
    learner('model_update_committed', {
      investigation_id: def.id,
      effect: input.effect,
      explanation: input.explanation.trim(),
      decision: input.decision,
      confidence: input.confidence,
      management_thinking: input.management_thinking,
      resulting_model_id: resultingId,
    }),
  );
  return ok(drafts);
}

export function openStudy(state: SessionState, input: { investigation_id: string }): CommandResult {
  const rec = invRecord(state, input.investigation_id);
  if (rec.status === 'AVAILABLE') return reject('NOT_RELEASED', 'This study has not been released.');
  return ok([learner('study_reopened', { investigation_id: rec.id })]);
}

export function openAnnotations(state: SessionState, input: { investigation_id: string }): CommandResult {
  const rec = invRecord(state, input.investigation_id);
  if (!rec.report || rec.interpretations.length === 0) return reject('INTERPRETATION_REQUIRED', 'Annotations are locked until your interpretation is committed.');
  return ok([learner('annotations_opened', { investigation_id: rec.id, available: false })]);
}

export function requestRepeat(state: SessionState, input: { investigation_id: string; rationale: string; expectation: string }): CommandResult {
  const def = getInvestigationDef(input.investigation_id);
  if (!def) return reject('UNKNOWN_INVESTIGATION', 'Unknown investigation.');
  if (!isRequestableNow(state, def)) return reject('NOT_AVAILABLE', 'Repeat requests for this study are not possible at this point.');
  const rec = invRecord(state, def.id);
  if (rec.status === 'AVAILABLE') return reject('NOT_REQUESTED', 'Request the study first.');
  if (!filled(input.rationale)) return reject('MISSING_RATIONALE', 'Explain why you want a repeat study now.');
  if (!filled(input.expectation)) return reject('MISSING_EXPECTATION', 'State what you expect a repeat study to show.');
  return ok([
    learner('repeat_request_logged', { investigation_id: def.id, rationale: input.rationale.trim(), expectation: input.expectation.trim() }),
    engine('boundary_response', {
      message: `No repeat ${def.title} result is authored in this case. Your request and reasoning are recorded. The previously released study remains available to reopen.`,
      related_to: def.id,
    }),
  ]);
}

export function requestUnsupported(state: SessionState, input: { name: string; rationale: string; expectation: string }): CommandResult {
  const allowed: Stage[] = ['N2.workup', 'N4.postop_workup', 'N5.followup'];
  if (!allowed.includes(state.stage)) return reject('WRONG_STAGE', 'Investigations cannot be requested at this point.');
  if (!filled(input.name)) return reject('MISSING_FIELD', 'Name the investigation you want.');
  if (!filled(input.rationale)) return reject('MISSING_RATIONALE', 'Explain why you are requesting it now.');
  if (!filled(input.expectation)) return reject('MISSING_EXPECTATION', 'State what you expect it to clarify or demonstrate.');
  return ok([
    learner('unsupported_request_logged', { name: input.name.trim(), rationale: input.rationale.trim(), expectation: input.expectation.trim(), context: state.stage }),
    engine('boundary_response', {
      message: `"${input.name.trim()}" is not available in this case catalogue, so no result will be generated. Your request, rationale, and expectation are preserved in the session record.`,
      related_to: 'unsupported_request',
    }),
  ]);
}

export function recordAssetNotice(state: SessionState, input: EventPayloads['asset_notice']): CommandResult {
  if (state.stage === 'START') return reject('WRONG_STAGE', 'No session.');
  return { ok: true, drafts: [{ event_type: 'asset_notice', source: 'system', payload: input }] };
}

export function concludeWorkup(
  state: SessionState,
  input: { integrated_model: string; confidence: number; enough_information: boolean },
  ctx: CommandContext,
): CommandResult {
  if (state.stage !== 'N2.workup') return reject('WRONG_STAGE', 'Not in the diagnostic work-up.');
  if (!filled(input.integrated_model)) return reject('MISSING_FIELD', 'Record your integrated working model.');
  if (!validConfidence(input.confidence)) return reject('MISSING_CONFIDENCE', 'Record your confidence (0 to 100).');
  if (input.enough_information !== true) return reject('MISSING_COMMITMENT', 'Confirm that you have enough information to propose a plan.');
  const prev = currentModel(state, 'preop');
  const model = nextModel(state, ctx, 'preop', 'workup_conclusion', {
    problem_representation: input.integrated_model,
    hypotheses: prev?.hypotheses ?? [],
    priorities: prev?.priorities ?? '',
    confidence: input.confidence,
  });
  const openCycles = Object.values(state.investigations)
    .filter((r) => r.status !== 'AVAILABLE' && r.status !== 'MODEL_UPDATED' && getInvestigationDef(r.id)?.context === 'preop')
    .map((r) => r.id);
  return ok([
    learner('working_model_revised', { model, reason: 'Integrated working model at the end of the work-up' }),
    learner('workup_concluded', { integrated_model: input.integrated_model.trim(), confidence: input.confidence, enough_information: true, open_cycles: openCycles, model_id: model.version_id }),
    transition('N2.workup', 'N3.recommendation', SIM.T14),
  ]);
}

// ---------------------------------------------------------------------------
// N3
// ---------------------------------------------------------------------------
export function commitRecommendation(state: SessionState, input: RecommendationInput, ctx: CommandContext): CommandResult {
  if (state.stage !== 'N3.recommendation') return reject('WRONG_STAGE', 'Not at the management decision.');
  if (!STRATEGY_CATEGORIES.some((c) => c.id === input.category)) return reject('MISSING_FIELD', 'Select a strategy category.');
  if (input.category === 'other' && !filled(input.other_strategy)) return reject('MISSING_FIELD', 'Describe your other strategy.');
  if (!filled(input.strategy_summary)) return reject('MISSING_FIELD', 'Summarize your strategy in one sentence.');
  if (!validConfidence(input.confidence)) return reject('MISSING_CONFIDENCE', 'Record your confidence (0 to 100).');
  const drafts: EventDraft[] = [learner('recommendation_committed', { recommendation: input, reasoning_version_id: ctx.newId('rv') })];
  if (input.category === 'other') {
    drafts.push(
      engine('recommendation_flagged_for_review', {
        reason: 'An "Other strategy" recommendation is preserved verbatim for expert review. This build does not generate a personalized pathway for it.',
      }),
    );
  }
  drafts.push(transition('N3.recommendation', 'N3.canonical_ack'), engine('canonical_continuation_explained', { copy: CANONICAL_CONTINUATION_COPY }));
  return ok(drafts);
}

export function acknowledgeCanonical(state: SessionState): CommandResult {
  if (state.stage !== 'N3.canonical_ack' || !state.recommendation) return reject('WRONG_STAGE', 'There is no continuation to acknowledge.');
  return ok([
    learner('canonical_continuation_acknowledged', {
      participant_category: state.recommendation.recommendation.category,
      canonical: 'Complete L4-L5 decompression with bilateral lateral-recess decompression and limited cranial extension into L3-L4, without fusion or instrumentation.',
    }),
    transition('N3.canonical_ack', 'N4.procedure', SIM.POD0),
    engine('procedure_started', { description: OPERATIVE.procedureDescription, sim_time: SIM.POD0 }),
  ]);
}

// ---------------------------------------------------------------------------
// N4 operative day
// ---------------------------------------------------------------------------
export function continueProcedure(state: SessionState): CommandResult {
  if (state.stage !== 'N4.procedure') return reject('WRONG_STAGE', 'Not in the procedure.');
  return ok([engine('intraop_checkpoint_released', { checkpoint: OPERATIVE.checkpoint }), transition('N4.procedure', 'N4.durotomy_proposal')]);
}

export function commitIntraopProposal(
  state: SessionState,
  input: { immediate: string; checks: string; postop_considerations: string; confidence: number | null },
): CommandResult {
  if (state.stage !== 'N4.durotomy_proposal') return reject('WRONG_STAGE', 'No intraoperative proposal is pending.');
  if (!filled(input.immediate)) return reject('MISSING_FIELD', 'Propose your immediate management.');
  if (input.confidence !== null && !validConfidence(input.confidence)) return reject('MISSING_CONFIDENCE', 'Confidence must be 0 to 100.');
  return ok([
    learner('intraop_proposal_committed', {
      immediate: input.immediate.trim(),
      checks: input.checks.trim(),
      postop_considerations: input.postop_considerations.trim(),
      confidence: input.confidence,
    }),
    transition('N4.durotomy_proposal', 'N4.durotomy_proposal_committed'),
  ]);
}

export function revealTeamAction(state: SessionState): CommandResult {
  if (state.stage !== 'N4.durotomy_proposal_committed' || !state.intraopProposal) {
    return reject('PROPOSAL_REQUIRED', "Commit your proposal before the team's action is shown.");
  }
  return ok([
    engine('team_action_released', { team_action: OPERATIVE.teamAction, operative_report: OPERATIVE.operativeReport }),
    transition('N4.durotomy_proposal_committed', 'N4.repair_revealed'),
  ]);
}

export function advanceToPod1(state: SessionState): CommandResult {
  if (state.stage !== 'N4.repair_revealed') return reject('WRONG_STAGE', 'Cannot advance from here.');
  return ok([transition('N4.repair_revealed', 'N4.pod1', SIM.POD1), engine('clinical_update_released', { update: CLINICAL_UPDATES.pod1 })]);
}

export function advanceToPod3(state: SessionState): CommandResult {
  if (state.stage !== 'N4.pod1') return reject('WRONG_STAGE', 'Cannot advance from here.');
  return ok([transition('N4.pod1', 'N4.pod3_reassessment', SIM.POD3), engine('clinical_update_released', { update: CLINICAL_UPDATES.pod3 })]);
}

export function commitPostopReassessment(
  state: SessionState,
  input: { problem_representation: string; differential: string[]; priorities: string; confidence: number },
  ctx: CommandContext,
): CommandResult {
  if (state.stage !== 'N4.pod3_reassessment') return reject('WRONG_STAGE', 'No reassessment is pending.');
  if (!filled(input.problem_representation)) return reject('MISSING_FIELD', 'Enter a new problem representation.');
  if (!input.differential.some(filled)) return reject('MISSING_FIELD', 'Enter at least one differential diagnosis.');
  if (!filled(input.priorities)) return reject('MISSING_FIELD', 'Enter your immediate priorities.');
  if (!validConfidence(input.confidence)) return reject('MISSING_CONFIDENCE', 'Record your confidence (0 to 100).');
  const model = nextModel(state, ctx, 'postop', 'postop_reassessment', {
    problem_representation: input.problem_representation,
    hypotheses: input.differential,
    priorities: input.priorities,
    confidence: input.confidence,
  });
  return ok([
    learner('postop_reassessment_committed', { model, differential: input.differential.map((d) => d.trim()).filter((d) => d.length > 0) }),
    transition('N4.pod3_reassessment', 'N4.postop_workup'),
  ]);
}

function validatePlan(p: PlanInput): CommandResult | null {
  if (!filled(p.plan)) return reject('MISSING_FIELD', 'Describe your management plan.');
  if (!validConfidence(p.confidence)) return reject('MISSING_CONFIDENCE', 'Record your confidence (0 to 100).');
  return null;
}

export function commitPostopPlan(state: SessionState, input: PlanInput, ctx: CommandContext): CommandResult {
  if (state.stage !== 'N4.postop_workup') return reject('WRONG_STAGE', 'Not at the postoperative management decision.');
  const invalid = validatePlan(input);
  if (invalid) return invalid;
  return ok([
    learner('postop_plan_committed', { plan: trimPlan(input), plan_version_id: ctx.newId('plan'), predecessor_id: null, decision_point: 'initial_postoperative_plan' }),
    transition('N4.postop_workup', 'N4.branch_selection'),
  ]);
}

function trimPlan(p: PlanInput): PlanInput {
  return { plan: p.plan.trim(), rationale: p.rationale.trim(), monitoring: p.monitoring.trim(), threshold: p.threshold.trim(), confidence: p.confidence };
}

const BRANCH_START_STAGE: Record<BranchId, Stage> = {
  B1: 'N4.B1.drainage',
  B2: 'N4.B2.observation',
  B3: 'N4.B3.reexploration',
  B4: 'N4.B4.deferred',
};

function enterReview(state: SessionState, reason: string, preserved: Record<string, string>): EventDraft[] {
  return [engine('review_pause_entered', { reason, copy: EXPERT_REVIEW_COPY, preserved }), transition(state.stage, 'REVIEW.pause')];
}

function planPreserved(p: PlanInput): Record<string, string> {
  return { plan: p.plan, rationale: p.rationale, monitoring: p.monitoring, threshold: p.threshold, confidence: String(p.confidence) };
}

export function confirmBranchSelection(state: SessionState, input: { option_id: BranchOptionId }): CommandResult {
  if (state.stage !== 'N4.branch_selection') return reject('WRONG_STAGE', 'No management action is pending.');
  const plan = state.plans[state.plans.length - 1];
  if (!plan) return reject('PLAN_REQUIRED', 'Commit your plan first.');
  if (!POSTOP_ACTION_OPTIONS.some((o) => o.id === input.option_id)) return reject('UNKNOWN_OPTION', 'Select an action category.');
  if (input.option_id === 'opt_none') {
    return ok([
      learner('postop_action_unsupported', { option_id: 'opt_none', plan_version_id: plan.plan_version_id, decision_point: 'initial_postoperative_plan' }),
      ...enterReview(state, 'The committed postoperative plan does not correspond to an authored action category.', planPreserved(plan.plan)),
    ]);
  }
  const branch = BRANCH_MAP[input.option_id];
  const step = BRANCH_STEPS[`${branch}_start`];
  if (!step) return reject('NO_AUTHORED_CONSEQUENCE', 'Missing authored consequence.');
  return ok([
    learner('postop_branch_confirmed', {
      option_id: input.option_id,
      branch_id: branch,
      postop_mri_released_before_choice: invRecord(state, 'postop_mri').status !== 'AVAILABLE',
      decision_point: 'initial_postoperative_plan',
    }),
    transition('N4.branch_selection', BRANCH_START_STAGE[branch], SIM.POD4),
    engine('branch_consequence_released', { branch_id: branch, step }),
  ]);
}

const ADVANCE: Partial<Record<Stage, { to: Stage; step: string; branch: BranchId }>> = {
  'N4.B1.drainage': { to: 'N4.B1.resolved', step: 'B1_resolved', branch: 'B1' },
  'N4.B2.observation': { to: 'N4.B2.persistence', step: 'B2_persistence', branch: 'B2' },
  'N4.B2.rescue_drainage': { to: 'N4.B2.resolved', step: 'B2_resolved', branch: 'B2' },
  'N4.B3.reexploration': { to: 'N4.B3.resolved', step: 'B3_resolved', branch: 'B3' },
  'N4.B4.deferred': { to: 'N4.B4.persistence', step: 'B4_persistence', branch: 'B4' },
  'N4.B2.rescue_reexploration': { to: 'N4.B2.resolved_reexplore', step: 'B2_reexplore_resolved', branch: 'B2' },
  'N4.B4.rescue_drainage': { to: 'N4.B4.resolved_drain', step: 'B4_drain_resolved', branch: 'B4' },
  'N4.B4.rescue_reexploration': { to: 'N4.B4.resolved_reexplore', step: 'B4_reexplore_resolved', branch: 'B4' },
};

/** Authored second decisions after persistence (spec B2 rescue + amendment D5). Anything else pauses. */
const RESCUES: Partial<Record<Stage, Partial<Record<BranchOptionId, { to: Stage; step: string }>>>> = {
  'N4.B2.persistence': {
    opt_drain: { to: 'N4.B2.rescue_drainage', step: 'B2_rescue_start' },
    opt_reexplore: { to: 'N4.B2.rescue_reexploration', step: 'B2_reexplore_start' },
  },
  'N4.B4.persistence': {
    opt_drain: { to: 'N4.B4.rescue_drainage', step: 'B4_drain_start' },
    opt_reexplore: { to: 'N4.B4.rescue_reexploration', step: 'B4_reexplore_start' },
  },
};

export function advanceBranch(state: SessionState): CommandResult {
  const a = ADVANCE[state.stage];
  if (!a) return reject('WRONG_STAGE', 'There is no authored step to advance to from here.');
  const step = BRANCH_STEPS[a.step];
  if (!step) return reject('NO_AUTHORED_CONSEQUENCE', 'Missing authored consequence.');
  return ok([transition(state.stage, a.to), engine('branch_consequence_released', { branch_id: a.branch, step })]);
}

export function commitSecondDecision(state: SessionState, input: PlanInput & { option_id: BranchOptionId }, ctx: CommandContext): CommandResult {
  if (state.stage !== 'N4.B2.persistence' && state.stage !== 'N4.B4.persistence') return reject('WRONG_STAGE', 'No reassessment decision is pending.');
  const invalid = validatePlan(input);
  if (invalid) return invalid;
  if (!POSTOP_ACTION_OPTIONS.some((o) => o.id === input.option_id)) return reject('UNKNOWN_OPTION', 'Select an action category.');
  const prev = state.plans[state.plans.length - 1];
  const planId = ctx.newId('plan');
  const drafts: EventDraft[] = [
    learner('postop_plan_committed', {
      plan: trimPlan(input),
      plan_version_id: planId,
      predecessor_id: prev?.plan_version_id ?? null,
      decision_point: 'reassessment_after_persistence',
    }),
  ];
  const branch: BranchId = state.stage === 'N4.B2.persistence' ? 'B2' : 'B4';
  const rescue = RESCUES[state.stage]?.[input.option_id];
  if (rescue) {
    const step = BRANCH_STEPS[rescue.step];
    if (!step) return reject('NO_AUTHORED_CONSEQUENCE', 'Missing authored consequence.');
    drafts.push(
      learner('postop_branch_confirmed', {
        option_id: input.option_id,
        branch_id: branch,
        postop_mri_released_before_choice: invRecord(state, 'postop_mri').status !== 'AVAILABLE',
        decision_point: 'reassessment_after_persistence',
      }),
      transition(state.stage, rescue.to),
      engine('branch_consequence_released', { branch_id: branch, step }),
    );
    return ok(drafts);
  }
  const reason =
    input.option_id === 'opt_observe' || input.option_id === 'opt_defer'
      ? 'Further observation or deferral after persistent symptoms has no authored subsequent consequence in this case.'
      : 'The selected action after persistent symptoms has no authored consequence for this course.';
  drafts.push(
    learner('postop_action_unsupported', { option_id: input.option_id, plan_version_id: planId, decision_point: 'reassessment_after_persistence' }),
    ...enterReview(state, reason, { ...planPreserved(input), selected_action: input.option_id }),
  );
  return ok(drafts);
}

// ---------------------------------------------------------------------------
// N5
// ---------------------------------------------------------------------------
export function advanceToFollowUp(state: SessionState): CommandResult {
  const map: Partial<Record<Stage, { branch: BranchId; course: CourseId }>> = {
    'N4.B1.resolved': { branch: 'B1', course: 'B1' },
    'N4.B2.resolved': { branch: 'B2', course: 'B2' },
    'N4.B3.resolved': { branch: 'B3', course: 'B3' },
    'N4.B2.resolved_reexplore': { branch: 'B2', course: 'B2_reexplore' },
    'N4.B4.resolved_drain': { branch: 'B4', course: 'B4_drain' },
    'N4.B4.resolved_reexplore': { branch: 'B4', course: 'B4_reexplore' },
  };
  const m = map[state.stage];
  if (!m) return reject('WRONG_STAGE', 'Follow-up is not available from here.');
  return ok([
    transition(state.stage, 'N5.followup', SIM.W6),
    engine('followup_released', { branch_id: m.branch, course: m.course, followup: FOLLOW_UP[m.course] }),
  ]);
}

export function enterDebrief(state: SessionState): CommandResult {
  if (state.stage !== 'N5.followup' && state.stage !== 'REVIEW.pause') return reject('WRONG_STAGE', 'The debrief opens after the clinical episode ends or a review pause begins.');
  const experienced = state.branchId;
  const all: BranchId[] = ['B1', 'B2', 'B3', 'B4'];
  const reference =
    experienced === 'B1'
      ? null
      : { label: 'Reference course comparison' as const, summary: BRANCH_SUMMARIES.B1, followup: FOLLOW_UP.B1 };
  const others = all
    .filter((b) => b !== experienced && b !== 'B1')
    .map((b) => ({ label: 'Other authored scenario' as const, branch_id: b, ...BRANCH_SUMMARIES[b] }));
  return ok([
    engine('comparisons_released', { experienced_branch: experienced, reference, others, faculty_perspective: FACULTY_PERSPECTIVE, reading_list: READING_LIST }),
    transition(state.stage, 'N5.debrief'),
  ]);
}

export function commitReflection(state: SessionState, input: { answers: Record<string, string> }, ctx: CommandContext): CommandResult {
  if (state.stage !== 'N5.debrief') return reject('WRONG_STAGE', 'Reflection is part of the debrief.');
  const answers = Object.fromEntries(Object.entries(input.answers).map(([k, v]) => [k, v.trim()]));
  if (!Object.values(answers).some((v) => v.length > 0)) return reject('MISSING_FIELD', 'Answer at least one reflection question.');
  return ok([learner('reflection_committed', { answers, reflection_version_id: ctx.newId('refl') })]);
}

export function completeSession(state: SessionState): CommandResult {
  if (state.stage !== 'N5.debrief') return reject('WRONG_STAGE', 'The session can be completed from the debrief.');
  if (state.completion) return reject('ALREADY_COMPLETED', 'Session already completed.');
  return ok([
    { event_type: 'session_completed', source: 'system', payload: { completion_status: state.followUp ? 'clinical_pathway_completed' : 'debriefed_after_review_pause' } },
  ]);
}
