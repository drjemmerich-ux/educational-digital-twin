// Engine types: stages, events, and the derived session state.
// The append-only event log is the single source of truth; state is a pure fold of events.
import type {
  BranchId,
  BranchOptionId,
  BranchStep,
  ClinicalUpdate,
  FollowUpContent,
  PresentationSnapshot,
  ReportSection,
  SeriesSpec,
  SimTime,
} from '../case/types.ts';
import type { StrategyCategory } from '../case/publicCatalogue.ts';
import type { VersionBundle } from '../case/versions.ts';

export type Stage =
  | 'START'
  | 'N1.assessment'
  | 'N2.workup'
  | 'N3.recommendation'
  | 'N3.canonical_ack'
  | 'N4.procedure'
  | 'N4.durotomy_proposal'
  | 'N4.durotomy_proposal_committed'
  | 'N4.repair_revealed'
  | 'N4.pod1'
  | 'N4.pod3_reassessment'
  | 'N4.postop_workup'
  | 'N4.branch_selection'
  | 'N4.B1.drainage'
  | 'N4.B1.resolved'
  | 'N4.B2.observation'
  | 'N4.B2.persistence'
  | 'N4.B2.rescue_drainage'
  | 'N4.B2.resolved'
  | 'N4.B3.reexploration'
  | 'N4.B3.resolved'
  | 'N4.B4.deferred'
  | 'N4.B4.persistence'
  | 'N5.followup'
  | 'N5.debrief'
  | 'REVIEW.pause';

export type ImagingRoute = 'image_gate_placeholder' | 'text_only';
export type SessionKind = 'participant' | 'demonstration';
export type EventSource = 'learner' | 'engine' | 'tutor' | 'system';

export type InvestigationStatus =
  | 'AVAILABLE'
  | 'REQUEST_COMMITTED'
  | 'RAW_DATA_RELEASED'
  | 'INTERPRETATION_COMMITTED'
  | 'REPORT_RELEASED'
  | 'MODEL_UPDATED';

/** Which release route the learner actually encountered. */
export type InvestigationVariant = 'image_gate' | 'non_imaging' | 'text_only';

export interface ReleasedSeries extends SeriesSpec {
  framePaths: string[] | null;
  approvalState: string;
  placeholder: boolean;
}

export interface ReleasedReport {
  title: string;
  sections: ReportSection[];
  accessibleSummary: string;
  acquiredAt: SimTime;
  annotation: { available: false; reason: string };
}

export type ModelChain = 'preop' | 'postop';

export interface ModelVersion {
  version_id: string;
  chain: ModelChain;
  version: number;
  predecessor_id: string | null;
  trigger: string;
  problem_representation: string;
  hypotheses: string[];
  priorities: string;
  confidence: number | null;
  sequence: number;
}

export type EffectOnModel = 'supports' | 'weakens' | 'unchanged' | 'mixed';
export type ManagementThinking = 'changed' | 'unchanged' | 'unsure';

export interface RecommendationInput {
  category: StrategyCategory;
  other_strategy: string;
  strategy_summary: string;
  indication: string;
  symptom_target: string;
  level_extent: string;
  approach: string;
  facet_preservation: string;
  fusion_rationale: string;
  expected_benefit: string;
  risks: string;
  alternative: string;
  patient_preference: string;
  uncertainty: string;
  change_threshold: string;
  confidence: number;
  comparison: { option: string; benefits: string; risks: string; uncertainty: string; preference_fit: string }[];
}

export interface PlanInput {
  plan: string;
  rationale: string;
  monitoring: string;
  threshold: string;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Event payloads
// ---------------------------------------------------------------------------
export interface EventPayloads {
  session_started: { participant_code: string; imaging_route: ImagingRoute; session_kind: SessionKind; versions: VersionBundle };
  session_resumed: { tab_id: string };
  presentation_released: { presentation: PresentationSnapshot; sim_time: SimTime };
  stage_transition: { from: Stage; to: Stage; sim_time?: SimTime };
  clock_advanced: { sim_time: SimTime; reason: string };
  initial_assessment_committed: { model: Omit<ModelVersion, 'sequence'> };
  working_model_revised: { model: Omit<ModelVersion, 'sequence'>; reason: string };
  investigation_requested: { investigation_id: string; title: string; repeat: false };
  rationale_committed: { investigation_id: string; text: string; reasoning_version_id: string };
  expectation_committed: { investigation_id: string; text: string; reasoning_version_id: string; confidence: number | null };
  raw_data_released: { investigation_id: string; series: ReleasedSeries[]; acquired_at: SimTime; variant: 'image_gate' };
  image_interpretation_unavailable: { investigation_id: string; reason: string };
  report_released: { investigation_id: string; report: ReleasedReport; variant: InvestigationVariant };
  interpretation_committed: { investigation_id: string; text: string; reasoning_version_id: string; confidence: number | null };
  interpretation_revised: { investigation_id: string; text: string; reasoning_version_id: string; predecessor_id: string };
  model_update_committed: {
    investigation_id: string;
    effect: EffectOnModel;
    explanation: string;
    decision: 'maintain' | 'revise';
    confidence: number | null;
    management_thinking: ManagementThinking;
    resulting_model_id: string;
  };
  study_reopened: { investigation_id: string };
  annotations_opened: { investigation_id: string; available: false };
  repeat_request_logged: { investigation_id: string; rationale: string; expectation: string };
  unsupported_request_logged: { name: string; rationale: string; expectation: string; context: string };
  boundary_response: { message: string; related_to: string };
  asset_notice: { asset_id: string; kind: 'placeholder_displayed' | 'load_error'; detail: string };
  workup_concluded: { integrated_model: string; confidence: number; enough_information: true; open_cycles: string[]; model_id: string };
  recommendation_committed: { recommendation: RecommendationInput; reasoning_version_id: string };
  recommendation_flagged_for_review: { reason: string };
  canonical_continuation_explained: { copy: string };
  canonical_continuation_acknowledged: { participant_category: StrategyCategory; canonical: string };
  procedure_started: { description: string[]; sim_time: SimTime };
  intraop_checkpoint_released: { checkpoint: ClinicalUpdate };
  intraop_proposal_committed: { immediate: string; checks: string; postop_considerations: string; confidence: number | null };
  team_action_released: { team_action: string[]; operative_report: { title: string; sections: ReportSection[] } };
  clinical_update_released: { update: ClinicalUpdate };
  postop_reassessment_committed: { model: Omit<ModelVersion, 'sequence'>; differential: string[] };
  postop_plan_committed: { plan: PlanInput; plan_version_id: string; predecessor_id: string | null; decision_point: string };
  postop_branch_confirmed: { option_id: BranchOptionId; branch_id: BranchId; postop_mri_released_before_choice: boolean; decision_point: string };
  postop_action_unsupported: { option_id: BranchOptionId | 'other'; plan_version_id: string; decision_point: string };
  branch_consequence_released: { branch_id: BranchId; step: BranchStep };
  review_pause_entered: { reason: string; copy: string; preserved: Record<string, string> };
  followup_released: { branch_id: 'B1' | 'B2' | 'B3'; followup: FollowUpContent };
  comparisons_released: {
    experienced_branch: BranchId | null;
    reference: { label: 'Reference course comparison'; summary: { action: string; consequence: string }; followup: FollowUpContent } | null;
    others: { label: 'Other authored scenario'; branch_id: BranchId; action: string; consequence: string }[];
  };
  reflection_committed: { answers: Record<string, string>; reflection_version_id: string };
  session_completed: { completion_status: 'clinical_pathway_completed' | 'debriefed_after_review_pause' };
  tutor_message: { mode: string; message: string; grounding_ids: string[]; requires_human_review: boolean; trigger: string; budget_override_reason: string | null };
  tutor_silent: { trigger: string; reason: string };
  tutor_support_requested: { mode: string; trigger: string };
  tutor_response: { text: string; in_reply_to: string | null };
  tutor_preference_changed: { mode: 'auto' | 'on_request' };
}

export type EventType = keyof EventPayloads;

export interface EdtEvent<K extends EventType = EventType> {
  event_id: string;
  session_id: string;
  sequence: number;
  transaction_id: string;
  event_type: K;
  source: EventSource;
  timestamp_utc: string;
  simulated_time: string;
  case_id: string;
  content_version: string;
  state_before: Stage;
  state_after: Stage;
  payload: EventPayloads[K];
}

export type AnyEvent = { [K in EventType]: EdtEvent<K> }[EventType];

/** What a command returns before the session layer stamps ids, sequence and time. */
export type EventDraft = { [K in EventType]: { event_type: K; source: EventSource; payload: EventPayloads[K] } }[EventType];

export const TUTOR_EVENT_TYPES = [
  'tutor_message',
  'tutor_silent',
  'tutor_support_requested',
  'tutor_response',
  'tutor_preference_changed',
] as const satisfies readonly EventType[];
export type TutorEventType = (typeof TUTOR_EVENT_TYPES)[number];

// ---------------------------------------------------------------------------
// Derived state
// ---------------------------------------------------------------------------
export interface InvestigationRecord {
  id: string;
  status: InvestigationStatus;
  variant: InvestigationVariant | null;
  rationale: { text: string; reasoning_version_id: string; sequence: number } | null;
  expectation: { text: string; reasoning_version_id: string; confidence: number | null; sequence: number } | null;
  series: ReleasedSeries[] | null;
  acquiredAt: SimTime | null;
  report: ReleasedReport | null;
  interpretations: { text: string; reasoning_version_id: string; predecessor_id: string | null; confidence: number | null; sequence: number }[];
  imageUnavailableReason: string | null;
  modelUpdate: EventPayloads['model_update_committed'] & { sequence: number } | null;
  reopenCount: number;
  annotationsOpened: number;
  repeatRequests: { rationale: string; expectation: string; sequence: number }[];
  requestedAtSequence: number | null;
  releasedAtSequence: number | null;
}

export interface TimelineEntry {
  sequence: number;
  sim_time: string;
  sim_label: string;
  text: string;
  kind: 'clinical' | 'learner' | 'boundary';
}

export interface TutorMessageRecord {
  sequence: number;
  role: 'tutor' | 'learner' | 'system';
  mode: string;
  text: string;
  trigger: string;
}

export interface SessionState {
  sessionId: string | null;
  participantCode: string;
  sessionKind: SessionKind;
  imagingRoute: ImagingRoute;
  versions: VersionBundle | null;
  stage: Stage;
  simTime: SimTime;
  status: 'not_started' | 'in_progress' | 'paused_for_review' | 'completed';
  lastSequence: number;
  presentation: PresentationSnapshot | null;
  models: ModelVersion[];
  currentModelId: Record<ModelChain, string | null>;
  postopDifferential: string[];
  investigations: Record<string, InvestigationRecord>;
  unsupportedRequests: (EventPayloads['unsupported_request_logged'] & { sequence: number })[];
  boundaryMessages: (EventPayloads['boundary_response'] & { sequence: number })[];
  assetNotices: (EventPayloads['asset_notice'] & { sequence: number })[];
  workupConclusion: (EventPayloads['workup_concluded'] & { sequence: number }) | null;
  recommendation: (EventPayloads['recommendation_committed'] & { sequence: number }) | null;
  recommendationFlag: string | null;
  canonicalExplained: string | null;
  canonicalAcknowledged: boolean;
  procedureDescription: string[] | null;
  intraopCheckpoint: ClinicalUpdate | null;
  intraopProposal: (EventPayloads['intraop_proposal_committed'] & { sequence: number }) | null;
  teamAction: EventPayloads['team_action_released'] | null;
  clinicalUpdates: ClinicalUpdate[];
  plans: (EventPayloads['postop_plan_committed'] & { sequence: number })[];
  branchDecisions: ((EventPayloads['postop_branch_confirmed'] | EventPayloads['postop_action_unsupported']) & { sequence: number; kind: 'confirmed' | 'unsupported' })[];
  branchId: BranchId | null;
  branchSteps: BranchStep[];
  reviewPause: (EventPayloads['review_pause_entered'] & { sequence: number }) | null;
  followUp: EventPayloads['followup_released'] | null;
  comparisons: EventPayloads['comparisons_released'] | null;
  reflections: (EventPayloads['reflection_committed'] & { sequence: number })[];
  completion: EventPayloads['session_completed'] | null;
  timeline: TimelineEntry[];
  tutor: {
    preference: 'auto' | 'on_request';
    messages: TutorMessageRecord[];
    probesByNode: Record<string, number>;
    probesByCycle: Record<string, number>;
  };
}
