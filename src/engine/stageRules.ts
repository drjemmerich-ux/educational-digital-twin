// Stage rules shared by commands and selectors (no hidden content).
import type { InvestigationContext } from '../case/types.ts';
import type { Stage } from './types.ts';

export function contextStageOf(context: InvestigationContext): Stage {
  return context === 'preop' ? 'N2.workup' : context === 'postop' ? 'N4.postop_workup' : 'N5.followup';
}

/** Stages in which the clinical episode is over or paused, so comparisons may be shown. */
export function episodeClosed(stage: Stage): boolean {
  return stage === 'N5.debrief' || stage === 'REVIEW.pause';
}
