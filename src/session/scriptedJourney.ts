// Scripted journeys drive the real engine commands. Used for the clearly labelled demonstration
// session, the reference-path JSON fixture, and acceptance tests. Sample text is marked "Sample:"
// and is never shown as learner reasoning in a normal participant session.
import * as C from '../engine/commands.ts';
import type { BranchOptionId } from '../case/types.ts';
import type { StrategyCategory } from '../case/publicCatalogue.ts';
import type { ImagingRoute, RecommendationInput, SessionKind } from '../engine/types.ts';
import { ScriptedTutor } from '../tutor/scriptedTutor.ts';
import { requestSupport, runTutor } from '../tutor/tutorService.ts';
import type { DispatchResult, SessionController } from './controller.ts';

export interface JourneyOptions {
  sessionId: string;
  kind: SessionKind;
  route: ImagingRoute;
  preopStudies: string[];
  category: StrategyCategory;
  firstAction: BranchOptionId;
  secondAction?: BranchOptionId;
  postopStudies: string[];
  followupStudies: string[];
  stopAt?: 'N2' | 'N3' | 'N4.pod3' | 'branch' | 'followup' | 'debrief';
  withTutor?: boolean;
}

export const REFERENCE_JOURNEY: Omit<JourneyOptions, 'sessionId' | 'kind'> = {
  route: 'image_gate_placeholder',
  preopStudies: ['standing_lumbar_xr', 'lumbar_mri', 'dynamic_xr', 'emg_ncs'],
  category: 'decompression',
  firstAction: 'opt_drain',
  postopStudies: ['postop_labs', 'postop_mri'],
  followupStudies: ['followup_xr'],
  withTutor: true,
};

function must(r: DispatchResult, step: string): void {
  if (!r.ok) throw new Error(`Journey step "${step}" rejected: ${r.code} ${r.message}`);
}

const S = (t: string) => `Sample: ${t}`;

export function sampleRecommendation(category: StrategyCategory): RecommendationInput {
  return {
    category,
    other_strategy: category === 'other' ? S('staged approach described for review') : '',
    strategy_summary: S(`${category.replace('_', ' ')} strategy summary entered for demonstration`),
    indication: S('leg-dominant symptoms limiting walking despite nonoperative care'),
    symptom_target: S('right-greater-than-left leg symptoms with walking'),
    level_extent: S('level and extent as reasoned from released imaging'),
    approach: S('approach entered for demonstration'),
    facet_preservation: S('facet preservation considered'),
    fusion_rationale: S('reasoning about including or excluding fusion'),
    expected_benefit: S('improved walking tolerance'),
    risks: S('dural tear, infection, persistent symptoms'),
    alternative: S('a reasonable alternative strategy'),
    patient_preference: S('concern about an extensive operation'),
    uncertainty: S('significance of the dynamic findings'),
    change_threshold: S('a development that would change this recommendation'),
    confidence: 60,
    comparison: [],
  };
}

export function runJourney(ctl: SessionController, o: JourneyOptions): void {
  const tutor = new ScriptedTutor();
  must(ctl.dispatch(C.startSession, { participant_code: o.kind === 'demonstration' ? 'DEMO' : 'TEST-01', imaging_route: o.route, session_kind: o.kind }, o.sessionId), 'start');
  if (o.withTutor) runTutor(ctl, tutor, { kind: 'session_started' });
  must(
    ctl.dispatch(C.commitInitialAssessment, {
      problem_representation: S('64-year-old active woman with 14 months of progressive bilateral leg-dominant neurogenic claudication, right worse than left, with a subtle right L5 deficit.'),
      hypotheses: [S('lumbar spinal stenosis with right L5 involvement'), S('vascular claudication (less likely)'), S('hip pathology contributing')],
      priorities: S('define the level and mechanism of compression; assess mobility; confirm absence of red flags'),
      confidence: 55,
    }),
    'initial assessment',
  );
  if (o.withTutor) requestSupport(ctl, tutor, 'discriminate');
  for (const id of o.preopStudies) studyCycle(ctl, id, tutor, o.withTutor ?? false);
  if (o.stopAt === 'N2') return;
  must(ctl.dispatch(C.concludeWorkup, { integrated_model: S('integrated model summarizing released findings and remaining uncertainty'), confidence: 65, enough_information: true }), 'conclude work-up');
  if (o.withTutor) runTutor(ctl, tutor, { kind: 'stage_entered', stage: 'N3.recommendation' });
  must(ctl.dispatch(C.commitRecommendation, sampleRecommendation(o.category)), 'recommendation');
  if (o.stopAt === 'N3') return;
  must(ctl.dispatch(C.acknowledgeCanonical, undefined), 'acknowledge');
  must(ctl.dispatch(C.continueProcedure, undefined), 'continue procedure');
  must(
    ctl.dispatch(C.commitIntraopProposal, {
      immediate: S('immediate management proposal'),
      checks: S('checks before closure'),
      postop_considerations: S('postoperative considerations'),
      confidence: 70,
    }),
    'intraop proposal',
  );
  must(ctl.dispatch(C.revealTeamAction, undefined), 'team action');
  must(ctl.dispatch(C.advanceToPod1, undefined), 'pod1');
  must(ctl.dispatch(C.advanceToPod3, undefined), 'pod3');
  if (o.stopAt === 'N4.pod3') return;
  must(
    ctl.dispatch(C.commitPostopReassessment, {
      problem_representation: S('new postoperative problem representation'),
      differential: [S('first explanation'), S('second explanation'), S('third explanation')],
      priorities: S('immediate priorities'),
      confidence: 60,
    }),
    'postop reassessment',
  );
  for (const id of o.postopStudies) studyCycle(ctl, id, tutor, o.withTutor ?? false);
  must(
    ctl.dispatch(C.commitPostopPlan, { plan: S('postoperative management plan'), rationale: S('rationale'), monitoring: S('monitoring'), threshold: S('escalation threshold'), confidence: 65 }),
    'postop plan',
  );
  if (o.stopAt === 'branch') return;
  must(ctl.dispatch(C.confirmBranchSelection, { option_id: o.firstAction }), 'branch');
  if (ctl.state.stage === 'REVIEW.pause') {
    must(ctl.dispatch(C.enterDebrief, undefined), 'debrief from review');
    return;
  }
  must(ctl.dispatch(C.advanceBranch, undefined), 'advance branch');
  if (ctl.state.stage === 'N4.B2.persistence' || ctl.state.stage === 'N4.B4.persistence') {
    must(
      ctl.dispatch(C.commitSecondDecision, {
        plan: S('revised plan after persistence'),
        rationale: S('rationale'),
        monitoring: S('monitoring'),
        threshold: S('threshold'),
        confidence: 60,
        option_id: o.secondAction ?? 'opt_drain',
      }),
      'second decision',
    );
    if (ctl.state.stage === 'REVIEW.pause') {
      must(ctl.dispatch(C.enterDebrief, undefined), 'debrief from review');
      return;
    }
    must(ctl.dispatch(C.advanceBranch, undefined), 'advance rescue');
  }
  must(ctl.dispatch(C.advanceToFollowUp, undefined), 'follow-up');
  if (ctl.state.branchId === 'B1') for (const id of o.followupStudies) studyCycle(ctl, id, tutor, o.withTutor ?? false);
  if (o.stopAt === 'followup') return;
  must(ctl.dispatch(C.enterDebrief, undefined), 'debrief');
  if (o.stopAt === 'debrief') return;
  must(
    ctl.dispatch(C.commitReflection, { answers: { r1: S('reflection on the evidence that changed the model'), r6: S('what I would do differently') } }),
    'reflection',
  );
  must(ctl.dispatch(C.completeSession, undefined), 'complete');
}

export function studyCycle(ctl: SessionController, id: string, tutor: ScriptedTutor, withTutor: boolean): void {
  must(ctl.dispatch(C.commitRequest, { investigation_id: id, rationale: S(`why ${id} is requested now`), expectation: S(`what ${id} is expected to show`), confidence: null }), `request ${id}`);
  const r = ctl.state.investigations[id];
  must(ctl.dispatch(C.commitInterpretation, { investigation_id: id, text: S(`interpretation of ${id}`), confidence: 60 }), `interpret ${id}`);
  if (withTutor) runTutor(ctl, tutor, { kind: 'report_released', investigationId: id, variant: r?.variant ?? null });
  must(
    ctl.dispatch(C.commitModelUpdate, {
      investigation_id: id,
      effect: 'supports',
      explanation: S(`how ${id} changed the model`),
      decision: 'maintain',
      confidence: 62,
      management_thinking: 'unchanged',
    }),
    `update ${id}`,
  );
}
