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

// ---------------------------------------------------------------------------
// Participant information and consent (decision 17; ethics package sections 4-5).
// Bracketed placeholders are completed before the pilot opens.
// ---------------------------------------------------------------------------
export const CONSENT_VERSION = 'consent-1.0-draft (2026-10-13)';

export const PARTICIPANT_INFORMATION: { heading: string; text: string }[] = [
  { heading: 'What is the study about?', text: 'We are testing whether a simulated patient encounter is easy to use, clinically realistic, and able to record how a surgeon reasons through a case. We are not testing you.' },
  { heading: 'What will I do?', text: 'You will manage one fictional patient in a single online session of about 30 minutes. Before each result is shown, you will write why you want it and what you expect. At the end, you will see a summary of your own reasoning.' },
  { heading: 'Is the patient real?', text: 'No. The patient, images and outcomes are entirely fictional. Nothing in the simulation is clinical advice.' },
  { heading: 'Will I be graded?', text: 'No. There is no score, grade or pass mark. Nothing you write will be shared with your training program, your employer or any professional organization.' },
  { heading: 'Is it anonymous?', text: 'Yes. You enter through a link with a random code. We do not ask for your name, email or institution. The only background question is your training level. Please do not write your name or other identifying details in your answers.' },
  { heading: 'What is recorded?', text: 'Your written reasoning, your choices, your confidence ratings and the time taken. Results will be reported only in aggregate.' },
  { heading: 'Where are the data kept?', text: 'In this preview, in your own browser only. In the pilot, on a secure server in the European Union, accessible only to the investigator, for [number] years.' },
  { heading: 'Is artificial intelligence used?', text: 'Your answers are not processed by any AI system in this study. The tutor in the simulation asks fixed, pre-written questions.' },
  { heading: 'Do I have to take part?', text: 'No. Participation is entirely voluntary. You can stop at any time without giving a reason, with no consequence of any kind.' },
  { heading: 'Can I withdraw my data?', text: 'Yes. Send the random code shown on screen to the coordinator by [date], and your data will be deleted.' },
  { heading: 'Questions?', text: 'Contact the coordinator, [name], at [email], or the investigator, Dr Juan P. Emmerich, at [email].' },
];

export const CONSENT_STATEMENTS: { id: string; text: string }[] = [
  { id: 'c1', text: 'I have read the participant information and had the opportunity to ask questions.' },
  { id: 'c2', text: 'I understand that participation is voluntary and that I can stop at any time without giving a reason and without any consequence.' },
  { id: 'c3', text: 'I understand that the patient is fictional and that the simulation does not give clinical advice.' },
  { id: 'c4', text: 'I understand that my answers are anonymous and will not be shared with my training program, employer or any professional organization.' },
  { id: 'c5', text: 'I agree not to include my name or other identifying details in my written answers.' },
  { id: 'c6', text: 'I understand that my anonymous answers may be reported in aggregated form at scientific meetings or in publications.' },
  { id: 'c7', text: 'I understand that I can ask for my data to be deleted by sending my random code to the coordinator by [date].' },
  { id: 'c8', text: 'I am a physician aged 18 or older currently in spine-related specialty training.' },
];

export const TRAINING_LEVELS: { id: string; label: string }[] = [
  { id: 'resident_1_3', label: 'Resident, years 1 to 3' },
  { id: 'resident_4_plus', label: 'Resident, year 4 or later' },
  { id: 'fellow', label: 'Fellow' },
];
