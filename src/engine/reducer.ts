// Pure reducer: folds stamped events into session state.
// It must never import hidden case content. Everything it knows comes from event payloads,
// which is what makes export and replay reproduce the experienced course exactly.
import { getInvestigationDef, nodeOf } from '../case/publicCatalogue.ts';
import type { AnyEvent, InvestigationRecord, ModelVersion, SessionState, TimelineEntry } from './types.ts';

export function initialState(): SessionState {
  return {
    sessionId: null,
    participantCode: '',
    consent: null,
    trainingLevel: null,
    sessionKind: 'participant',
    imagingRoute: 'image_gate_placeholder',
    versions: null,
    stage: 'START',
    simTime: { code: 'none', label: 'Not started' },
    status: 'not_started',
    lastSequence: 0,
    presentation: null,
    models: [],
    currentModelId: { preop: null, postop: null },
    postopDifferential: [],
    investigations: {},
    unsupportedRequests: [],
    boundaryMessages: [],
    assetNotices: [],
    workupConclusion: null,
    recommendation: null,
    recommendationFlag: null,
    canonicalExplained: null,
    canonicalAcknowledged: false,
    procedureDescription: null,
    intraopCheckpoint: null,
    intraopProposal: null,
    teamAction: null,
    clinicalUpdates: [],
    plans: [],
    branchDecisions: [],
    branchId: null,
    branchSteps: [],
    reviewPause: null,
    followUp: null,
    comparisons: null,
    reflections: [],
    completion: null,
    timeline: [],
    tutor: { preference: 'auto', messages: [], probesByNode: {}, probesByCycle: {} },
  };
}

export function emptyInvestigation(id: string): InvestigationRecord {
  return {
    id,
    status: 'AVAILABLE',
    variant: null,
    rationale: null,
    expectation: null,
    series: null,
    acquiredAt: null,
    report: null,
    interpretations: [],
    imageUnavailableReason: null,
    modelUpdate: null,
    reopenCount: 0,
    annotationsOpened: 0,
    repeatRequests: [],
    requestedAtSequence: null,
    releasedAtSequence: null,
  };
}

function title(id: string): string {
  return getInvestigationDef(id)?.title ?? id;
}

function inv(s: SessionState, id: string): InvestigationRecord {
  return s.investigations[id] ?? emptyInvestigation(id);
}

function withInv(s: SessionState, id: string, patch: Partial<InvestigationRecord>): SessionState {
  return { ...s, investigations: { ...s.investigations, [id]: { ...inv(s, id), ...patch } } };
}

function addModel(s: SessionState, model: Omit<ModelVersion, 'sequence'>, seq: number): SessionState {
  const full: ModelVersion = { ...model, sequence: seq };
  return { ...s, models: [...s.models, full], currentModelId: { ...s.currentModelId, [model.chain]: model.version_id } };
}

function tl(s: SessionState, e: AnyEvent, text: string, kind: TimelineEntry['kind']): SessionState {
  return {
    ...s,
    timeline: [...s.timeline, { sequence: e.sequence, sim_time: s.simTime.code, sim_label: s.simTime.label, text, kind }],
  };
}

export function applyEvent(state: SessionState, e: AnyEvent): SessionState {
  let s: SessionState = { ...state, lastSequence: e.sequence };
  switch (e.event_type) {
    case 'session_started':
      s = {
        ...s,
        sessionId: e.session_id,
        participantCode: e.payload.participant_code,
        consent: e.payload.consent ?? null,
        trainingLevel: e.payload.training_level ?? null,
        imagingRoute: e.payload.imaging_route,
        sessionKind: e.payload.session_kind,
        versions: e.payload.versions,
        status: 'in_progress',
      };
      return s;
    case 'session_resumed':
      return s;
    case 'presentation_released':
      s = { ...s, presentation: e.payload.presentation, simTime: e.payload.sim_time };
      return tl(s, e, 'Patient presentation reviewed', 'clinical');
    case 'stage_transition':
      s = { ...s, stage: e.payload.to };
      if (e.payload.sim_time) s = { ...s, simTime: e.payload.sim_time };
      if (e.payload.to === 'REVIEW.pause') s = { ...s, status: 'paused_for_review' };
      return s;
    case 'clock_advanced':
      return { ...s, simTime: e.payload.sim_time };
    case 'initial_assessment_committed':
      s = addModel(s, e.payload.model, e.sequence);
      return tl(s, e, 'Initial assessment committed', 'learner');
    case 'working_model_revised':
      s = addModel(s, e.payload.model, e.sequence);
      return tl(s, e, `Working model revised (version ${e.payload.model.version})`, 'learner');
    case 'investigation_requested':
      s = withInv(s, e.payload.investigation_id, { requestedAtSequence: e.sequence });
      return tl(s, e, `${title(e.payload.investigation_id)} requested`, 'learner');
    case 'rationale_committed':
      return withInv(s, e.payload.investigation_id, {
        rationale: { text: e.payload.text, reasoning_version_id: e.payload.reasoning_version_id, sequence: e.sequence },
      });
    case 'expectation_committed':
      return withInv(s, e.payload.investigation_id, {
        status: 'REQUEST_COMMITTED',
        expectation: {
          text: e.payload.text,
          reasoning_version_id: e.payload.reasoning_version_id,
          confidence: e.payload.confidence,
          sequence: e.sequence,
        },
      });
    case 'raw_data_released':
      s = withInv(s, e.payload.investigation_id, {
        status: 'RAW_DATA_RELEASED',
        variant: 'image_gate',
        series: e.payload.series,
        acquiredAt: e.payload.acquired_at,
        releasedAtSequence: e.sequence,
      });
      return tl(s, e, `${title(e.payload.investigation_id)}: images released for review (${e.payload.acquired_at.label})`, 'clinical');
    case 'image_interpretation_unavailable':
      return withInv(s, e.payload.investigation_id, { imageUnavailableReason: e.payload.reason, variant: 'text_only' });
    case 'report_released': {
      const cur = inv(s, e.payload.investigation_id);
      s = withInv(s, e.payload.investigation_id, {
        status: 'REPORT_RELEASED',
        variant: e.payload.variant,
        report: e.payload.report,
        acquiredAt: e.payload.report.acquiredAt,
        releasedAtSequence: cur.releasedAtSequence ?? e.sequence,
      });
      return tl(s, e, `${title(e.payload.investigation_id)}: report released`, 'clinical');
    }
    case 'interpretation_committed': {
      const cur = inv(s, e.payload.investigation_id);
      s = withInv(s, e.payload.investigation_id, {
        status: 'INTERPRETATION_COMMITTED',
        interpretations: [
          ...cur.interpretations,
          { text: e.payload.text, reasoning_version_id: e.payload.reasoning_version_id, predecessor_id: null, confidence: e.payload.confidence, sequence: e.sequence },
        ],
      });
      return tl(s, e, `${title(e.payload.investigation_id)}: interpretation committed`, 'learner');
    }
    case 'interpretation_revised': {
      const cur = inv(s, e.payload.investigation_id);
      s = withInv(s, e.payload.investigation_id, {
        interpretations: [
          ...cur.interpretations,
          { text: e.payload.text, reasoning_version_id: e.payload.reasoning_version_id, predecessor_id: e.payload.predecessor_id, confidence: null, sequence: e.sequence },
        ],
      });
      return tl(s, e, `${title(e.payload.investigation_id)}: interpretation addendum`, 'learner');
    }
    case 'model_update_committed':
      s = withInv(s, e.payload.investigation_id, { status: 'MODEL_UPDATED', modelUpdate: { ...e.payload, sequence: e.sequence } });
      return tl(s, e, `${title(e.payload.investigation_id)}: working model ${e.payload.decision === 'revise' ? 'revised' : 'maintained'}`, 'learner');
    case 'study_reopened': {
      const cur = inv(s, e.payload.investigation_id);
      return withInv(s, e.payload.investigation_id, { reopenCount: cur.reopenCount + 1 });
    }
    case 'annotations_opened': {
      const cur = inv(s, e.payload.investigation_id);
      return withInv(s, e.payload.investigation_id, { annotationsOpened: cur.annotationsOpened + 1 });
    }
    case 'repeat_request_logged': {
      const cur = inv(s, e.payload.investigation_id);
      s = withInv(s, e.payload.investigation_id, {
        repeatRequests: [...cur.repeatRequests, { rationale: e.payload.rationale, expectation: e.payload.expectation, sequence: e.sequence }],
      });
      return tl(s, e, `Repeat ${title(e.payload.investigation_id)} requested (no repeat result authored)`, 'boundary');
    }
    case 'unsupported_request_logged':
      s = { ...s, unsupportedRequests: [...s.unsupportedRequests, { ...e.payload, sequence: e.sequence }] };
      return tl(s, e, `Request recorded: ${e.payload.name} (not available in this case)`, 'boundary');
    case 'boundary_response':
      return { ...s, boundaryMessages: [...s.boundaryMessages, { ...e.payload, sequence: e.sequence }] };
    case 'asset_notice':
      return { ...s, assetNotices: [...s.assetNotices, { ...e.payload, sequence: e.sequence }] };
    case 'workup_concluded':
      s = { ...s, workupConclusion: { ...e.payload, sequence: e.sequence } };
      return tl(s, e, 'Integrated working model committed; ready to plan management', 'learner');
    case 'recommendation_committed':
      s = { ...s, recommendation: { ...e.payload, sequence: e.sequence } };
      return tl(s, e, 'Management recommendation committed', 'learner');
    case 'recommendation_flagged_for_review':
      return { ...s, recommendationFlag: e.payload.reason };
    case 'canonical_continuation_explained':
      return { ...s, canonicalExplained: e.payload.copy };
    case 'canonical_continuation_acknowledged':
      s = { ...s, canonicalAcknowledged: true };
      return tl(s, e, 'Predefined demonstration course acknowledged', 'learner');
    case 'procedure_started':
      s = { ...s, procedureDescription: e.payload.description, simTime: e.payload.sim_time };
      return tl(s, e, 'Procedure begins', 'clinical');
    case 'intraop_checkpoint_released':
      s = { ...s, intraopCheckpoint: e.payload.checkpoint };
      return tl(s, e, 'Intraoperative checkpoint', 'clinical');
    case 'intraop_proposal_committed':
      s = { ...s, intraopProposal: { ...e.payload, sequence: e.sequence } };
      return tl(s, e, 'Intraoperative management proposal committed', 'learner');
    case 'team_action_released':
      s = { ...s, teamAction: e.payload };
      return tl(s, e, "Team's action and operative report released", 'clinical');
    case 'clinical_update_released':
      s = { ...s, clinicalUpdates: [...s.clinicalUpdates, e.payload.update], simTime: e.payload.update.time };
      return tl(s, e, e.payload.update.title, 'clinical');
    case 'postop_reassessment_committed':
      s = addModel(s, e.payload.model, e.sequence);
      s = { ...s, postopDifferential: e.payload.differential };
      return tl(s, e, 'Postoperative reassessment committed', 'learner');
    case 'postop_plan_committed':
      s = { ...s, plans: [...s.plans, { ...e.payload, sequence: e.sequence }] };
      return tl(s, e, e.payload.predecessor_id ? 'Revised management plan committed (new version)' : 'Postoperative management plan committed', 'learner');
    case 'postop_branch_confirmed':
      s = {
        ...s,
        branchId: e.payload.branch_id,
        branchDecisions: [...s.branchDecisions, { ...e.payload, sequence: e.sequence, kind: 'confirmed' as const }],
      };
      return tl(s, e, 'Management action confirmed', 'learner');
    case 'postop_action_unsupported':
      s = { ...s, branchDecisions: [...s.branchDecisions, { ...e.payload, sequence: e.sequence, kind: 'unsupported' as const }] };
      return tl(s, e, 'Management action recorded (no authored consequence)', 'boundary');
    case 'branch_consequence_released':
      s = { ...s, branchSteps: [...s.branchSteps, e.payload.step], simTime: e.payload.step.time };
      return tl(s, e, e.payload.step.title, 'clinical');
    case 'review_pause_entered':
      s = { ...s, reviewPause: { ...e.payload, sequence: e.sequence }, status: 'paused_for_review' };
      return tl(s, e, 'Paused for expert review', 'boundary');
    case 'followup_released':
      s = { ...s, followUp: e.payload, simTime: e.payload.followup.time };
      return tl(s, e, e.payload.followup.title, 'clinical');
    case 'comparisons_released':
      return { ...s, comparisons: e.payload };
    case 'reflection_committed':
      s = { ...s, reflections: [...s.reflections, { ...e.payload, sequence: e.sequence }] };
      return tl(s, e, 'Reflection committed', 'learner');
    case 'session_completed':
      return { ...s, completion: e.payload, status: s.status === 'paused_for_review' ? 'paused_for_review' : 'completed' };
    case 'tutor_message': {
      const node = nodeOf(e.state_before);
      const isProbe = !['boundary', 'orientation'].includes(e.payload.mode);
      const cycleKey = e.payload.grounding_ids.find((g) => g.startsWith('cycle:'));
      return {
        ...s,
        tutor: {
          ...s.tutor,
          messages: [...s.tutor.messages, { sequence: e.sequence, role: 'tutor', mode: e.payload.mode, text: e.payload.message, trigger: e.payload.trigger, promptId: e.payload.grounding_ids.find((g) => g.startsWith('prompt:'))?.slice(7) ?? null }],
          probesByNode: isProbe ? { ...s.tutor.probesByNode, [node]: (s.tutor.probesByNode[node] ?? 0) + 1 } : s.tutor.probesByNode,
          probesByCycle:
            isProbe && cycleKey ? { ...s.tutor.probesByCycle, [cycleKey]: (s.tutor.probesByCycle[cycleKey] ?? 0) + 1 } : s.tutor.probesByCycle,
        },
      };
    }
    case 'tutor_silent':
      return s;
    case 'tutor_support_requested':
      return {
        ...s,
        tutor: { ...s.tutor, messages: [...s.tutor.messages, { sequence: e.sequence, role: 'system', mode: e.payload.mode, text: 'Prompt requested', trigger: e.payload.trigger, promptId: null }] },
      };
    case 'tutor_response':
      return {
        ...s,
        tutor: { ...s.tutor, messages: [...s.tutor.messages, { sequence: e.sequence, role: 'learner', mode: 'response', text: e.payload.text, trigger: 'learner', promptId: null }] },
      };
    case 'tutor_preference_changed':
      return { ...s, tutor: { ...s.tutor, preference: e.payload.mode } };
    default: {
      const never: never = e;
      throw new Error(`Unknown event type ${(never as { event_type: string }).event_type}`);
    }
  }
}

export function foldEvents(events: readonly AnyEvent[]): SessionState {
  return events.reduce<SessionState>((s, e) => applyEvent(s, e), initialState());
}
