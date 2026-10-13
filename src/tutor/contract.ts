// Provider-agnostic tutor contract (spec sections 16-17).
// A tutor receives only released state and returns an educational message or silence.
// The output type has no field that can change clinical state, order a study, or select a branch.

export type TutorMode =
  | 'orientation'
  | 'clarify'
  | 'support'
  | 'discriminate'
  | 'integrate'
  | 'alternative'
  | 'threshold'
  | 'boundary'
  | 'reflect';

export type TutorTrigger =
  | { kind: 'session_started' }
  | { kind: 'stage_entered'; stage: string }
  | { kind: 'report_released'; investigationId: string; variant: string | null }
  | { kind: 'support_requested'; mode: TutorMode }
  | { kind: 'boundary'; relatedTo: string };

/** Everything a tutor may see. No hidden findings, future states, branch consequences or answer key. */
export interface TutorContext {
  stage: string;
  node: string;
  trigger: TutorTrigger;
  preference: 'auto' | 'on_request';
  releasedInvestigationIds: string[];
  interpretedInvestigationIds: string[];
  openCycleInvestigationId: string | null;
  probesInNode: number;
  /** Case-specific prompt ids already shown in this session. */
  usedPromptIds: string[];
  probesInCycle: number;
  committed: {
    hasInitialAssessment: boolean;
    hypothesisCount: number;
    hasRecommendation: boolean;
    recommendationThresholdRecorded: boolean;
    hasPostopPlan: boolean;
    postopThresholdRecorded: boolean;
  };
}

export interface TutorOutput {
  mode: TutorMode;
  message: string;
  grounding_ids: string[];
  requires_human_review: boolean;
}

export interface TutorAdapter {
  readonly id: string;
  readonly label: string;
  /** Return null for silence. */
  respond(ctx: TutorContext): TutorOutput | null;
  supportOptions(ctx: TutorContext): { mode: TutorMode; label: string }[];
}

/**
 * Placeholder for a future grounded live tutor (GPT, Claude, or another provider).
 * Disabled in Prototype 1.5: keys would belong on a server, and outputs would need grounding,
 * forbidden-content and unsupported-fact checks before display, with an authored fallback.
 */
export class LiveTutorAdapterDisabled implements TutorAdapter {
  readonly id = 'live-disabled';
  readonly label = 'Live tutor (disabled in this build)';
  respond(): TutorOutput | null {
    return null;
  }
  supportOptions(): { mode: TutorMode; label: string }[] {
    return [];
  }
}

const ALLOWED_KEYS = ['mode', 'message', 'grounding_ids', 'requires_human_review'];

/** Validates any tutor output before display. Unknown keys or empty messages are rejected. */
export function validateTutorOutput(o: unknown): o is TutorOutput {
  if (!o || typeof o !== 'object') return false;
  const keys = Object.keys(o);
  if (keys.some((k) => !ALLOWED_KEYS.includes(k))) return false;
  const t = o as TutorOutput;
  return typeof t.message === 'string' && t.message.trim().length > 0 && Array.isArray(t.grounding_ids) && typeof t.requires_human_review === 'boolean';
}
