// Selectors derive everything the learner sees from released state only.
// This module must not import hidden case content (enforced by a test).
import { INVESTIGATIONS, POSTOP_ACTION_OPTIONS, STRATEGY_CATEGORIES, getInvestigationDef } from '../case/publicCatalogue.ts';
import type { InvestigationContext, InvestigationDef } from '../case/types.ts';
import { contextStageOf } from './stageRules.ts';
import type { InvestigationRecord, ModelChain, ModelVersion, SessionState } from './types.ts';
import { emptyInvestigation } from './reducer.ts';

export type CardState = 'available' | 'in_progress' | 'released' | 'complete' | 'closed';

export interface CatalogueItem {
  def: InvestigationDef;
  record: InvestigationRecord;
  cardState: CardState;
  requestable: boolean;
  nextStep: string;
}

export function record(state: SessionState, id: string): InvestigationRecord {
  return state.investigations[id] ?? emptyInvestigation(id);
}

export function nextStepFor(r: InvestigationRecord): string {
  switch (r.status) {
    case 'AVAILABLE':
      return 'Not requested';
    case 'REQUEST_COMMITTED':
      return 'Request committed';
    case 'RAW_DATA_RELEASED':
      return 'Interpretation pending';
    case 'REPORT_RELEASED':
      return r.interpretations.length ? 'Model update pending' : 'Interpretation pending';
    case 'INTERPRETATION_COMMITTED':
      return r.report ? 'Model update pending' : 'Report pending';
    case 'MODEL_UPDATED':
      return 'Integrated';
  }
}

export function catalogue(state: SessionState, context: InvestigationContext): CatalogueItem[] {
  const activeStage = contextStageOf(context);
  return INVESTIGATIONS.filter((d) => d.context === context).map((def) => {
    const r = record(state, def.id);
    const inContext = state.stage === activeStage && (context !== 'followup' || state.branchId === 'B1');
    const cardState: CardState =
      r.status === 'AVAILABLE' ? (inContext ? 'available' : 'closed') : r.status === 'MODEL_UPDATED' ? 'complete' : r.report || r.series ? 'released' : 'in_progress';
    return { def, record: r, cardState, requestable: inContext && r.status === 'AVAILABLE', nextStep: nextStepFor(r) };
  });
}

export function currentModel(state: SessionState, chain: ModelChain): ModelVersion | null {
  const id = state.currentModelId[chain];
  return state.models.find((m) => m.version_id === id) ?? null;
}

export function modelChain(state: SessionState, chain: ModelChain): ModelVersion[] {
  return state.models.filter((m) => m.chain === chain);
}

/** Integrated radiology report: only imaging studies released AND interpreted in this session. */
export function integratedRadiologyReport(state: SessionState, context: InvestigationContext = 'preop') {
  return INVESTIGATIONS.filter((d) => d.kind === 'imaging' && d.context === context)
    .map((d) => ({ def: d, r: record(state, d.id) }))
    .filter(({ r }) => r.report !== null && r.interpretations.length > 0)
    .map(({ def, r }) => ({ investigation_id: def.id, title: def.title, variant: r.variant, report: r.report! }));
}

export function releasedResults(state: SessionState) {
  return INVESTIGATIONS.map((d) => ({ def: d, r: record(state, d.id) })).filter(({ r }) => r.status !== 'AVAILABLE');
}

export function openCycle(state: SessionState): string | null {
  const open = Object.values(state.investigations).find((r) => r.status !== 'AVAILABLE' && r.status !== 'MODEL_UPDATED');
  return open?.id ?? null;
}

export function strategyLabel(id: string): string {
  return STRATEGY_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export function actionLabel(id: string): string {
  return POSTOP_ACTION_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

/** Released payloads only; used by export and replay verification. */
export function releasedContent(state: SessionState) {
  return {
    presentation: state.presentation,
    investigations: releasedResults(state).map(({ def, r }) => ({
      investigation_id: def.id,
      title: def.title,
      kind: def.kind,
      route_encountered: r.variant,
      status: r.status,
      acquired_at: r.acquiredAt,
      series: (r.series ?? []).map((s) => ({
        asset_id: s.assetId,
        title: s.title,
        planned_frames: s.plannedFrameCount,
        frame_paths: s.framePaths,
        placeholder: s.placeholder,
        approval_state: s.approvalState,
      })),
      rationale: r.rationale?.text ?? null,
      expectation: r.expectation?.text ?? null,
      interpretations: r.interpretations,
      image_interpretation_unavailable_reason: r.imageUnavailableReason,
      report: r.report,
      model_update: r.modelUpdate,
      reopened_views: r.reopenCount,
      repeat_requests: r.repeatRequests,
    })),
    working_models: state.models,
    workup_conclusion: state.workupConclusion,
    recommendation: state.recommendation,
    recommendation_flag: state.recommendationFlag,
    canonical_continuation: { explained: state.canonicalExplained, acknowledged: state.canonicalAcknowledged },
    operative: {
      procedure: state.procedureDescription,
      checkpoint: state.intraopCheckpoint,
      participant_proposal: state.intraopProposal,
      team_action: state.teamAction,
    },
    clinical_updates: state.clinicalUpdates,
    postop_differential: state.postopDifferential,
    postop_plans: state.plans,
    branch_decisions: state.branchDecisions,
    branch_steps: state.branchSteps,
    review_pause: state.reviewPause,
    follow_up: state.followUp,
    comparisons: state.comparisons,
    reflections: state.reflections,
    unsupported_requests: state.unsupportedRequests,
    boundary_messages: state.boundaryMessages,
    asset_notices: state.assetNotices,
  };
}

// ---------------------------------------------------------------------------
// Descriptive metrics (no scores)
// ---------------------------------------------------------------------------
export interface Metric {
  label: string;
  value: string;
  definition: string;
}

export function confidenceTrajectory(state: SessionState): { label: string; value: number }[] {
  const pts: { seq: number; label: string; value: number }[] = [];
  for (const m of state.models) if (m.confidence !== null) pts.push({ seq: m.sequence, label: `Working model v${m.version} (${m.chain === 'preop' ? 'pre-op' : 'post-op'}, ${m.trigger.replace(/_/g, ' ')})`, value: m.confidence });
  for (const r of Object.values(state.investigations)) {
    const t = getInvestigationDef(r.id)?.title ?? r.id;
    if (r.expectation?.confidence != null) pts.push({ seq: r.expectation.sequence, label: `Expectation: ${t}`, value: r.expectation.confidence });
    for (const i of r.interpretations) if (i.confidence != null) pts.push({ seq: i.sequence, label: `Interpretation: ${t}`, value: i.confidence });
  }
  if (state.recommendation) pts.push({ seq: state.recommendation.sequence, label: 'Management recommendation', value: state.recommendation.recommendation.confidence });
  if (state.intraopProposal?.confidence != null) pts.push({ seq: state.intraopProposal.sequence, label: 'Intraoperative proposal', value: state.intraopProposal.confidence });
  state.plans.forEach((p, i) => pts.push({ seq: p.sequence, label: `Postoperative plan v${i + 1}`, value: p.plan.confidence }));
  return pts.sort((a, b) => a.seq - b.seq).map(({ label, value }) => ({ label, value }));
}

export function sessionMetrics(state: SessionState, firstTs: string | null, lastTs: string | null): Metric[] {
  const recs = Object.values(state.investigations);
  const requested = recs.filter((r) => r.requestedAtSequence !== null);
  const imaging = requested.filter((r) => getInvestigationDef(r.id)?.kind === 'imaging');
  const interpretedBeforeReport = requested.filter((r) => r.variant === 'image_gate' && r.interpretations.length > 0);
  const revisions = state.models.filter((m) => m.predecessor_id !== null && m.trigger !== 'workup_conclusion');
  const probes = state.tutor.messages.filter((m) => m.role === 'tutor' && !['boundary', 'orientation'].includes(m.mode));
  const support = state.tutor.messages.filter((m) => m.role === 'system');
  const minutes = firstTs && lastTs ? Math.max(0, Math.round((Date.parse(lastTs) - Date.parse(firstTs)) / 60000)) : null;
  return [
    { label: 'Investigations requested', value: String(requested.length), definition: `Unique catalogue studies requested through the two-commitment gate (denominator: ${INVESTIGATIONS.length} catalogue entries across all stages). A higher or lower count does not indicate better reasoning.` },
    { label: 'Imaging studies interpreted before the report', value: `${interpretedBeforeReport.length} of ${imaging.length}`, definition: 'Image studies released through the image gate with an interpretation committed before the report. Text-only routes are excluded from the numerator.' },
    { label: 'Repeat requests', value: String(recs.reduce((n, r) => n + r.repeatRequests.length, 0)), definition: 'Requests to repeat an already released study. No repeat results are authored.' },
    { label: 'Requests outside the catalogue', value: String(state.unsupportedRequests.length), definition: 'Investigations named by you that the case does not contain. Preserved verbatim; no results generated.' },
    { label: 'Reopened views', value: String(recs.reduce((n, r) => n + r.reopenCount, 0)), definition: 'Times a released study was reopened. Reopening is not a new order.' },
    { label: 'Committed working-model revisions', value: String(revisions.length), definition: 'New working-model versions linked to a predecessor, excluding the end-of-work-up integration.' },
    { label: 'Postoperative plan versions', value: String(state.plans.length), definition: 'Committed postoperative plans. Later versions link to the original.' },
    { label: 'Tutor prompts delivered', value: String(probes.length), definition: 'Scripted Socratic prompts shown (orientation and boundary messages excluded). Fewer prompts do not indicate better performance.' },
    { label: 'Tutor prompts requested', value: String(support.length), definition: 'Times you asked the tutor for a prompt.' },
    { label: 'Real elapsed time', value: minutes === null ? 'Not available' : `${minutes} min`, definition: 'Wall-clock time between the first and last recorded event. Distinct from simulated clinical time; not a measure of quality.' },
    { label: 'Simulated clinical time reached', value: state.simTime.label, definition: 'The latest clinical time experienced in the case.' },
  ];
}

export { contextStageOf };
