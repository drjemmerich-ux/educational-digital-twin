// PUBLIC content: requestable names, neutral option labels, and fixed interface copy.
// Nothing in this file may contain a result, diagnosis, complication, or outcome.
import type { BranchOptionId, InvestigationDef } from './types.ts';

export const APP_NAME = 'Educational Digital Twin';
export const CASE_TITLE = 'Lumbar Spine Patient Encounter';
export const SYNTHETIC_LABEL = 'Synthetic educational case';

export const INVESTIGATIONS: InvestigationDef[] = [
  { id: 'lumbar_mri', title: 'Lumbar MRI', kind: 'imaging', context: 'preop', description: 'Magnetic resonance imaging of the lumbar spine.' },
  { id: 'standing_lumbar_xr', title: 'Standing lumbar AP and lateral radiographs', kind: 'imaging', context: 'preop', description: 'Weight-bearing radiographs of the lumbar spine.' },
  { id: 'dynamic_xr', title: 'Flexion and extension lateral radiographs', kind: 'imaging', context: 'preop', description: 'Lateral lumbar radiographs in flexion and extension.' },
  { id: 'full_spine_xr', title: 'Standing full-spine AP and lateral radiographs', kind: 'imaging', context: 'preop', description: 'Full-length standing radiographs.' },
  { id: 'lumbar_ct', title: 'Lumbar CT', kind: 'imaging', context: 'preop', description: 'Computed tomography of the lumbar spine.' },
  { id: 'emg_ncs', title: 'EMG and nerve conduction studies', kind: 'non_imaging', context: 'preop', description: 'Electrodiagnostic testing of the lower limbs.' },
  { id: 'preop_labs', title: 'Selected laboratory studies', kind: 'non_imaging', context: 'preop', description: 'Routine laboratory panel.' },
  { id: 'dxa', title: 'Bone densitometry (DXA)', kind: 'non_imaging', context: 'preop', description: 'Dual-energy X-ray absorptiometry.' },
  { id: 'prior_block_record', title: 'Prior right L5 selective nerve-root block record', kind: 'non_imaging', context: 'preop', description: 'Record of a previous procedure.' },
  { id: 'postop_mri', title: 'Lumbar MRI (postoperative)', kind: 'imaging', context: 'postop', description: 'Magnetic resonance imaging of the lumbar spine.' },
  { id: 'postop_labs', title: 'Postoperative laboratory studies', kind: 'non_imaging', context: 'postop', description: 'Laboratory trend since surgery.' },
  { id: 'postop_ct', title: 'Lumbar CT (postoperative)', kind: 'imaging', context: 'postop', description: 'Computed tomography of the lumbar spine.' },
  { id: 'followup_xr', title: 'Standing lumbar AP and lateral radiographs (follow-up)', kind: 'imaging', context: 'followup', description: 'Weight-bearing radiographs of the lumbar spine.' },
];

export function getInvestigationDef(id: string): InvestigationDef | undefined {
  return INVESTIGATIONS.find((d) => d.id === id);
}

export const REQUEST_HELPERS = {
  rationale: {
    label: 'Why are you requesting this study now?',
    helper: 'Describe the clinical question or decision this request serves at this point.',
  },
  expectation: {
    label: 'What do you expect this study to clarify or demonstrate?',
    helper: 'State the finding you anticipate, or what you expect to confirm or exclude.',
  },
};

export const INTERPRETATION_PROMPT = 'What do you see, and which findings are most relevant?';

export const CANONICAL_CONTINUATION_COPY =
  'For this first prototype, your recommendation has been saved. The simulated clinical course now follows a predefined decompression procedure so that we can examine the same intraoperative and postoperative reasoning tasks. This continuation does not classify your recommendation as correct or incorrect.';

export const EXPERT_REVIEW_COPY =
  'This sandbox does not contain an expert-authored consequence for the proposed action. Your plan and reasoning have been preserved for expert review.';

export const STRATEGY_CATEGORIES = [
  { id: 'nonoperative', label: 'Nonoperative care' },
  { id: 'decompression', label: 'Decompression alone' },
  { id: 'decompression_fusion', label: 'Decompression with fusion' },
  { id: 'other', label: 'Other strategy' },
] as const;
export type StrategyCategory = (typeof STRATEGY_CATEGORIES)[number]['id'];

/** Neutral learner-facing action categories. Branch IDs live only in hidden content. */
export const POSTOP_ACTION_OPTIONS: { id: BranchOptionId; label: string }[] = [
  { id: 'opt_drain', label: 'Lumbar CSF drainage' },
  { id: 'opt_observe', label: 'Short monitored period of recumbency and wound observation' },
  { id: 'opt_reexplore', label: 'Early operative re-exploration and reinforced repair' },
  { id: 'opt_defer', label: 'Defer targeted treatment for now' },
  { id: 'opt_none', label: 'None of these describes my plan' },
];

export const REFLECTION_QUESTIONS = [
  { id: 'r1', text: 'Which evidence most changed your working model?' },
  { id: 'r2', text: 'What information did you expect but not receive?' },
  { id: 'r3', text: 'Which recommendation was most sensitive to uncertainty?' },
  { id: 'r4', text: 'What would make you choose another initial strategy?' },
  { id: 'r5', text: 'What would make you escalate postoperative treatment?' },
  { id: 'r6', text: 'What would you do differently with a similar patient?' },
];

/** Generic, non-revealing stage labels shown in the top bar. */
export function stageLabel(stage: string): string {
  if (stage.startsWith('N1')) return 'Initial presentation';
  if (stage.startsWith('N2')) return 'Diagnostic work-up';
  if (stage.startsWith('N3')) return 'Management strategy';
  if (stage === 'N4.procedure' || stage.startsWith('N4.durotomy') || stage === 'N4.repair_revealed') return 'Operative day';
  if (stage === 'N4.pod1') return 'Postoperative course';
  if (stage === 'N4.pod3_reassessment' || stage === 'N4.postop_workup') return 'New postoperative findings';
  if (stage.startsWith('N4')) return 'Postoperative management';
  if (stage === 'N5.followup') return 'Follow-up encounter';
  if (stage === 'N5.debrief') return 'Debrief';
  if (stage.startsWith('REVIEW')) return 'Expert review required';
  return 'Start';
}

export function nodeOf(stage: string): 'N1' | 'N2' | 'N3' | 'N4' | 'N5' | 'REVIEW' | 'START' {
  const n = stage.split('.')[0];
  if (n === 'N1' || n === 'N2' || n === 'N3' || n === 'N4' || n === 'N5' || n === 'REVIEW') return n;
  return 'START';
}
