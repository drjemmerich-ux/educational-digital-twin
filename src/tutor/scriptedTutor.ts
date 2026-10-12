// Deterministic scripted Socratic tutor (Prototype 1.5).
// It never reads case content, never interprets results, and cannot change clinical state.
// It asks at most one focused question at a time and is often silent.
import type { TutorAdapter, TutorContext, TutorMode, TutorOutput } from './contract.ts';

export const NODE_PROMPT_BUDGET = 3; // additional prompts per node before a decision
export const CYCLE_PROMPT_BUDGET = 2; // additional prompts per investigation cycle

const PROMPTS: Record<Exclude<TutorMode, 'orientation' | 'boundary'>, Record<string, string>> = {
  clarify: {
    N1: 'What clinical problem are you trying to explain?',
    N2: 'In one sentence, what problem is your current working model trying to explain?',
    N4: 'What clinical problem are you trying to explain now?',
    default: 'What are you most concerned about at this moment, and why?',
  },
  support: {
    default: 'Which currently available finding most supports your leading hypothesis?',
  },
  discriminate: {
    N1: 'What finding would make you reconsider your leading hypothesis?',
    N3: 'Which uncertainty most affects your recommendation, and how might it be reduced?',
    N4: 'Which feature would best separate your leading explanation from the next most likely one?',
    default: 'What finding would make you reconsider that hypothesis?',
  },
  integrate: {
    default: 'How does the most recent result change your previous working model?',
  },
  alternative: {
    default: 'Which patient-specific features support your strategy over a reasonable alternative?',
  },
  threshold: {
    default: 'What development would make you change or escalate this plan?',
  },
  reflect: {
    default: 'Which information most changed your reasoning, and why?',
    second: 'Where did your expectations and the results diverge most, and what does that suggest?',
  },
};

const BOUNDARY = 'That information is not available in the current state. What outcome are you trying to anticipate?';

function prompt(mode: Exclude<TutorMode, 'orientation' | 'boundary'>, node: string): string {
  const table = PROMPTS[mode];
  return table[node] ?? table.default ?? '';
}

function out(mode: TutorMode, message: string, ctx: TutorContext): TutorOutput {
  const grounding = [`stage:${ctx.stage}`];
  if (ctx.trigger.kind === 'report_released') grounding.push(`cycle:${ctx.trigger.investigationId}`);
  else if (ctx.openCycleInvestigationId && mode !== 'boundary' && mode !== 'orientation') grounding.push(`cycle:${ctx.openCycleInvestigationId}`);
  return { mode, message, grounding_ids: grounding, requires_human_review: false };
}

function withinBudget(ctx: TutorContext): boolean {
  if (ctx.probesInNode >= NODE_PROMPT_BUDGET) return false;
  if ((ctx.trigger.kind === 'report_released' || ctx.openCycleInvestigationId) && ctx.probesInCycle >= CYCLE_PROMPT_BUDGET) return false;
  return true;
}

export class ScriptedTutor implements TutorAdapter {
  readonly id = 'scripted-tutor-1.0';
  readonly label = 'Scripted tutor prototype';

  respond(ctx: TutorContext): TutorOutput | null {
    const t = ctx.trigger;
    switch (t.kind) {
      case 'session_started':
        return out(
          'orientation',
          'I am a scripted tutor prototype. I ask one question at a time and will often stay silent. I cannot see unreleased information, order studies, or change the patient’s course. Use “Ask for a prompt” whenever a question would help.',
          ctx,
        );
      case 'boundary':
        return out('boundary', BOUNDARY, ctx);
      case 'report_released':
        // Restraint: at most one unrequested prompt per node; later results get silence.
        if (ctx.preference !== 'auto' || !withinBudget(ctx) || ctx.probesInNode > 0) return null;
        if (t.variant === 'image_gate') {
          return out('integrate', 'Compare the report with your own reading. Where do they differ, and does any difference matter for your working model?', ctx);
        }
        return out('integrate', 'How much weight should this result carry relative to the clinical picture, and why?', ctx);
      case 'stage_entered':
        if (ctx.preference !== 'auto' || !withinBudget(ctx)) return null;
        if (t.stage === 'N3.recommendation') return out('alternative', prompt('alternative', 'N3'), ctx);
        return null;
      case 'support_requested': {
        if (!withinBudget(ctx)) {
          return out('orientation', 'Take a moment with your own reasoning here. Your working model, the chart, and the released results remain available.', ctx);
        }
        if (t.mode === 'orientation' || t.mode === 'boundary') return null;
        if (t.mode === 'integrate' && ctx.releasedInvestigationIds.length === 0) {
          return out('support', prompt('support', ctx.node), ctx);
        }
        if (t.mode === 'reflect' && ctx.probesInNode >= 1) return out('reflect', PROMPTS.reflect.second ?? '', ctx);
        return out(t.mode, prompt(t.mode, ctx.node), ctx);
      }
    }
  }

  supportOptions(ctx: TutorContext): { mode: TutorMode; label: string }[] {
    const s = ctx.stage;
    if (s === 'N1.assessment') {
      return [
        { mode: 'clarify', label: 'Clarify the problem' },
        { mode: 'discriminate', label: 'Challenge my hypothesis' },
      ];
    }
    if (s === 'N2.workup' || s === 'N4.postop_workup' || s === 'N5.followup') {
      const opts: { mode: TutorMode; label: string }[] = [
        { mode: 'support', label: 'Weigh the evidence' },
        { mode: 'discriminate', label: 'Challenge my hypothesis' },
      ];
      if (ctx.releasedInvestigationIds.length > 0) opts.push({ mode: 'integrate', label: 'Integrate a result' });
      return opts;
    }
    if (s.startsWith('N3')) {
      return [
        { mode: 'alternative', label: 'Compare with an alternative' },
        { mode: 'discriminate', label: 'Examine uncertainty' },
        { mode: 'threshold', label: 'Set a change threshold' },
      ];
    }
    if (s === 'N4.durotomy_proposal' || s === 'N4.pod3_reassessment') {
      return [
        { mode: 'clarify', label: 'Clarify the problem' },
        { mode: 'discriminate', label: 'Separate explanations' },
      ];
    }
    if (s === 'N4.branch_selection' || s.endsWith('persistence')) {
      return [
        { mode: 'threshold', label: 'Set a change threshold' },
        { mode: 'alternative', label: 'Compare with an alternative' },
      ];
    }
    if (s === 'N5.debrief' || s === 'REVIEW.pause') return [{ mode: 'reflect', label: 'Reflect' }];
    return [];
  }
}
