// Connects a TutorAdapter to the session. It can only append tutor events; the controller
// rejects any other event type from this path.
import type { EventDraft } from '../engine/types.ts';
import type { SessionController } from '../session/controller.ts';
import { buildTutorContext } from './context.ts';
import { validateTutorOutput, type TutorAdapter, type TutorMode, type TutorTrigger } from './contract.ts';

function triggerName(t: TutorTrigger): string {
  switch (t.kind) {
    case 'session_started':
      return 'session_started';
    case 'stage_entered':
      return `stage_entered:${t.stage}`;
    case 'report_released':
      return `report_released:${t.investigationId}`;
    case 'support_requested':
      return `support_requested:${t.mode}`;
    case 'boundary':
      return `boundary:${t.relatedTo}`;
  }
}

export function runTutor(controller: SessionController, adapter: TutorAdapter, trigger: TutorTrigger): void {
  const ctx = buildTutorContext(controller.state, trigger);
  const output = adapter.respond(ctx);
  const name = triggerName(trigger);
  let draft: EventDraft;
  if (output === null) {
    if (trigger.kind !== 'support_requested') return; // silence needs no record unless the learner asked
    draft = { event_type: 'tutor_silent', source: 'tutor', payload: { trigger: name, reason: 'no_prompt_for_context' } };
  } else if (!validateTutorOutput(output)) {
    draft = {
      event_type: 'tutor_message',
      source: 'tutor',
      payload: { mode: 'boundary', message: 'That information is not available in the current state.', grounding_ids: [], requires_human_review: true, trigger: `${name}:fallback`, budget_override_reason: null },
    };
  } else {
    draft = { event_type: 'tutor_message', source: 'tutor', payload: { ...output, trigger: name, budget_override_reason: null } };
  }
  controller.appendTutorEvents([draft]);
}

export function requestSupport(controller: SessionController, adapter: TutorAdapter, mode: TutorMode): void {
  controller.appendTutorEvents([{ event_type: 'tutor_support_requested', source: 'learner', payload: { mode, trigger: 'learner_selected' } }]);
  runTutor(controller, adapter, { kind: 'support_requested', mode });
}

export function respondToTutor(controller: SessionController, text: string, inReplyTo: string | null): void {
  if (!text.trim()) return;
  controller.appendTutorEvents([{ event_type: 'tutor_response', source: 'learner', payload: { text: text.trim(), in_reply_to: inReplyTo } }]);
}

export function setTutorPreference(controller: SessionController, mode: 'auto' | 'on_request'): void {
  controller.appendTutorEvents([{ event_type: 'tutor_preference_changed', source: 'learner', payload: { mode } }]);
}
