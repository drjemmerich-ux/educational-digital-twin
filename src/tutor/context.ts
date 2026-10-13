// Builds the restricted tutor context from released state only.
import { nodeOf } from '../case/publicCatalogue.ts';
import type { SessionState } from '../engine/types.ts';
import type { TutorContext, TutorTrigger } from './contract.ts';

export function buildTutorContext(state: SessionState, trigger: TutorTrigger): TutorContext {
  const node = nodeOf(state.stage);
  const recs = Object.values(state.investigations);
  const open = recs.find((r) => r.status !== 'AVAILABLE' && r.status !== 'MODEL_UPDATED') ?? null;
  const cycleId = trigger.kind === 'report_released' ? trigger.investigationId : open?.id ?? null;
  const lastPlan = state.plans[state.plans.length - 1];
  const preop = state.models.filter((m) => m.chain === 'preop');
  return {
    stage: state.stage,
    node,
    trigger,
    preference: state.tutor.preference,
    releasedInvestigationIds: recs.filter((r) => r.report || r.series).map((r) => r.id),
    interpretedInvestigationIds: recs.filter((r) => r.interpretations.length > 0).map((r) => r.id),
    openCycleInvestigationId: open?.id ?? null,
    probesInNode: state.tutor.probesByNode[node] ?? 0,
    usedPromptIds: state.tutor.messages.map((m) => m.promptId).filter((x): x is string => x !== null),
    probesInCycle: cycleId ? state.tutor.probesByCycle[`cycle:${cycleId}`] ?? 0 : 0,
    committed: {
      hasInitialAssessment: preop.length > 0,
      hypothesisCount: preop[preop.length - 1]?.hypotheses.length ?? 0,
      hasRecommendation: state.recommendation !== null,
      recommendationThresholdRecorded: (state.recommendation?.recommendation.change_threshold ?? '').trim().length > 0,
      hasPostopPlan: lastPlan !== undefined,
      postopThresholdRecorded: (lastPlan?.plan.threshold ?? '').trim().length > 0,
    },
  };
}
