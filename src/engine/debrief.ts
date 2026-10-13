// Deterministic, descriptive debrief statements grounded only in observable trace entries.
// No scores, no correct/incorrect labels, no inferred strengths or omissions beyond field presence.
import { getInvestigationDef } from '../case/publicCatalogue.ts';
import { actionLabel, strategyLabel } from './selectors.ts';
import type { SessionState } from './types.ts';

const q = (s: string) => `“${s}”`;

export interface DebriefInvestigationRow {
  id: string;
  title: string;
  route: string;
  rationale: string;
  expectation: string;
  interpretation: string;
  addenda: string[];
  result: string;
  effect: string;
  decision: string;
  managementThinking: string;
  reopened: number;
}

export function investigationRows(state: SessionState): DebriefInvestigationRow[] {
  return Object.values(state.investigations)
    .filter((r) => r.requestedAtSequence !== null)
    .sort((a, b) => (a.requestedAtSequence ?? 0) - (b.requestedAtSequence ?? 0))
    .map((r) => ({
      id: r.id,
      title: getInvestigationDef(r.id)?.title ?? r.id,
      route:
        r.variant === 'image_gate'
          ? 'Images (technical placeholders) → your interpretation → report'
          : r.variant === 'text_only'
            ? 'Text-only route: authored findings released without image reading'
            : 'Report → your interpretation',
      rationale: r.rationale?.text ?? 'Not recorded',
      expectation: r.expectation?.text ?? 'Not recorded',
      interpretation: r.interpretations[0]?.text ?? 'Not recorded',
      addenda: r.interpretations.slice(1).map((i) => i.text),
      result: r.report ? r.report.accessibleSummary : 'Not released',
      effect: r.modelUpdate ? r.modelUpdate.effect : 'Not recorded',
      decision: r.modelUpdate ? (r.modelUpdate.decision === 'revise' ? 'Revised working model' : 'Maintained working model') : 'Not recorded',
      managementThinking: r.modelUpdate ? r.modelUpdate.management_thinking : 'Not recorded',
      reopened: r.reopenCount,
    }));
}

export function narrativeStatements(state: SessionState): string[] {
  const out: string[] = [];
  const preop = state.models.filter((m) => m.chain === 'preop');
  const first = preop[0];
  if (first) out.push(`You initially considered: ${first.hypotheses.map(q).join(', ')}.`);
  const revised = preop.filter((m) => m.predecessor_id && m.trigger !== 'workup_conclusion');
  if (revised.length) out.push(`You revised your pre-operative working model ${revised.length} time${revised.length > 1 ? 's' : ''} during the work-up.`);
  else if (first) out.push('You maintained your initial working model through the work-up without a committed revision.');
  for (const row of investigationRows(state)) {
    out.push(`After reviewing ${row.title}, you indicated that the result ${row.effect === 'Not recorded' ? 'had an unrecorded effect on' : `${row.effect === 'unchanged' ? 'left unchanged' : row.effect}`} your working model.`);
  }
  if (state.recommendation) {
    const r = state.recommendation.recommendation;
    out.push(`You recommended ${strategyLabel(r.category).toLowerCase()}: ${q(r.strategy_summary)}.`);
    if (!r.change_threshold.trim()) out.push('You did not explicitly record a threshold that would change your recommendation.');
    if (!r.alternative.trim()) out.push('You did not explicitly record a credible alternative strategy.');
  }
  if (state.intraopProposal) out.push(`At the intraoperative checkpoint you proposed: ${q(state.intraopProposal.immediate)}.`);
  const plans = state.plans;
  if (plans[0]) {
    out.push(`For the new postoperative findings you planned: ${q(plans[0].plan.plan)}.`);
    if (!plans[0].plan.threshold) out.push('You did not explicitly record an escalation threshold for your initial postoperative plan.');
  }
  if (plans.length > 1) out.push(`You committed ${plans.length - 1} later plan version${plans.length > 2 ? 's' : ''} after reassessment; your original plan is preserved.`);
  for (const d of state.branchDecisions) {
    out.push(`${d.kind === 'confirmed' ? 'You confirmed the action' : 'You recorded an action without an authored consequence'}: ${actionLabel(d.option_id)}.`);
  }
  // Decision 1 (12 October 2026): state neutrally when drainage started without a postoperative MRI.
  const drainWithoutMri = state.branchDecisions.some(
    (d) => d.kind === 'confirmed' && d.option_id === 'opt_drain' && 'postop_mri_released_before_choice' in d && !d.postop_mri_released_before_choice,
  );
  if (drainWithoutMri) out.push('You started lumbar drainage without a postoperative MRI.');
  return out;
}

export function indexTreatmentComparison(state: SessionState): { participant: string; canonical: string; note: string } | null {
  const rec = state.recommendation?.recommendation;
  if (!rec) return null;
  const differs = rec.category !== 'decompression';
  return {
    participant: `${strategyLabel(rec.category)}${rec.category === 'other' ? ` (${rec.other_strategy})` : ''}: ${rec.strategy_summary}`,
    canonical:
      'Predefined demonstration operation: complete L4-L5 decompression with bilateral lateral-recess decompression and limited cranial extension into L3-L4, without fusion or instrumentation.',
    note: differs
      ? 'Your recommendation and the demonstration operation differ. The simulated course followed the predefined operation for educational comparability; your recommendation did not cause it and was not replaced.'
      : 'The simulated course followed the predefined operation for educational comparability. Matching categories do not mean the details of your plan were adopted or endorsed.',
  };
}
