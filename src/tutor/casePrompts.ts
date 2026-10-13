// Case-specific Socratic prompts approved by Dr Emmerich on 13 October 2026 (content review pack,
// section 12). Each prompt has a release condition evaluated ONLY on released state carried in the
// TutorContext, so it can never refer to information the learner has not yet seen.
import { getInvestigationDef } from '../case/publicCatalogue.ts';
import type { TutorContext, TutorMode } from './contract.ts';

export interface CasePrompt {
  id: string;
  mode: TutorMode;
  text: string;
  /** Released-state condition. */
  when: (ctx: TutorContext) => boolean;
  /** Investigation releases that may surface this prompt automatically (subject to restraint). */
  autoOnRelease?: string[];
  /** Stage entries that may surface this prompt automatically (subject to restraint). */
  autoOnStage?: string[];
}

const released = (ctx: TutorContext, id: string) => ctx.releasedInvestigationIds.includes(id);
const preopReleased = (ctx: TutorContext) => ctx.releasedInvestigationIds.some((id) => getInvestigationDef(id)?.context === 'preop');

export const CASE_PROMPTS: CasePrompt[] = [
  {
    id: '12.1',
    mode: 'discriminate',
    text: 'Which features of her walking limitation help you distinguish neural from vascular claudication?',
    when: (c) => c.stage === 'N1.assessment',
  },
  {
    id: '12.2',
    mode: 'clarify',
    text: 'How do the right-sided examination findings fit the distribution of her leg symptoms?',
    when: (c) => c.stage === 'N1.assessment',
  },
  {
    id: '12.3',
    mode: 'threshold',
    text: 'Which single result would most change your plan, and why?',
    when: (c) => c.stage === 'N2.workup' && !preopReleased(c),
  },
  {
    id: '12.4',
    mode: 'integrate',
    text: 'These studies were obtained in different positions. How do you reconcile what each shows?',
    when: (c) => c.stage === 'N2.workup' && released(c, 'lumbar_mri') && (released(c, 'standing_lumbar_xr') || released(c, 'full_spine_xr')),
    autoOnRelease: ['lumbar_mri', 'standing_lumbar_xr', 'full_spine_xr'],
  },
  {
    id: '12.5',
    mode: 'discriminate',
    text: 'How much weight do you give the motion between flexion and extension, and what else informs that judgment?',
    when: (c) => c.stage === 'N2.workup' && released(c, 'dynamic_xr'),
    autoOnRelease: ['dynamic_xr'],
  },
  {
    id: '12.6',
    mode: 'integrate',
    text: 'What can this test add to the clinical and imaging picture, and what can it not tell you?',
    when: (c) => c.stage === 'N2.workup' && (released(c, 'emg_ncs') || released(c, 'prior_block_record')),
    autoOnRelease: ['emg_ncs', 'prior_block_record'],
  },
  {
    id: '12.7',
    mode: 'alternative',
    text: 'How does her concern about an extensive operation shape your choice?',
    when: (c) => c.stage === 'N3.recommendation',
    autoOnStage: ['N3.recommendation'],
  },
  {
    id: '12.8',
    mode: 'alternative',
    text: 'What would a colleague who disagrees with your strategy point to in this case?',
    when: (c) => c.stage === 'N3.recommendation',
  },
  {
    id: '12.9',
    mode: 'discriminate',
    text: "Which of today's findings change the urgency of your response, and which reassure you?",
    when: (c) => c.stage === 'N4.pod3_reassessment' || c.stage === 'N4.postop_workup',
  },
  {
    id: '12.10',
    mode: 'integrate',
    text: 'How does the imaging change the options you are considering?',
    when: (c) => c.stage === 'N4.postop_workup' && released(c, 'postop_mri'),
    autoOnRelease: ['postop_mri'],
  },
  {
    id: '12.11',
    mode: 'threshold',
    text: 'What has the persistence told you that you did not know before?',
    when: (c) => c.stage === 'N4.B2.persistence' || c.stage === 'N4.B4.persistence',
  },
  {
    id: '12.12',
    mode: 'reflect',
    text: 'At which point did your confidence move most, and was that movement justified by new information?',
    when: (c) => c.stage === 'N5.debrief' || c.stage === 'REVIEW.pause',
  },
];

/** First unused case prompt for a requested mode whose condition holds now. */
export function casePromptFor(ctx: TutorContext, mode: TutorMode): CasePrompt | null {
  return CASE_PROMPTS.find((p) => p.mode === mode && !ctx.usedPromptIds.includes(p.id) && p.when(ctx)) ?? null;
}

/** Case prompt that may appear automatically after a specific release. */
export function casePromptOnRelease(ctx: TutorContext, investigationId: string): CasePrompt | null {
  return CASE_PROMPTS.find((p) => p.autoOnRelease?.includes(investigationId) && !ctx.usedPromptIds.includes(p.id) && p.when(ctx)) ?? null;
}

export function casePromptOnStage(ctx: TutorContext, stage: string): CasePrompt | null {
  return CASE_PROMPTS.find((p) => p.autoOnStage?.includes(stage) && !ctx.usedPromptIds.includes(p.id) && p.when(ctx)) ?? null;
}
