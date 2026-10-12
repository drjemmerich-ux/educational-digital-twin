// S08: execute the confirmed branch with authored simulated-time controls. Only this branch's
// consequences appear. Persistence requires a new committed response stored as a new version.
import * as React from 'react';
import * as C from '../engine/commands.ts';
import { actionLabel } from '../engine/selectors.ts';
import { useDraft, useRun, useSession } from '../ui/session.tsx';
import { ErrorNote } from '../components/forms.tsx';
import { ActionSelect, EMPTY_PLAN, PlanFields, PlanSummary } from './Postop.tsx';

const ADVANCE_LABEL: Record<string, string> = {
  'N4.B1.drainage': 'Advance through the prescribed drainage period',
  'N4.B2.rescue_drainage': 'Advance through the prescribed drainage period',
  'N4.B2.observation': 'Advance to reassessment',
  'N4.B3.reexploration': 'Advance to reassessment',
  'N4.B4.deferred': 'Advance to reassessment',
};

export function Branch() {
  const state = useSession();
  const run = useRun();
  const [error, setError] = React.useState<string | null>(null);
  const [plan, setPlan, clear] = useDraft('second:plan', EMPTY_PLAN);
  const stage = state.stage;
  const persistence = stage === 'N4.B2.persistence' || stage === 'N4.B4.persistence';
  const resolved = stage === 'N4.B1.resolved' || stage === 'N4.B2.resolved' || stage === 'N4.B3.resolved';
  const go = (cmd: typeof C.advanceBranch) => {
    const r = run(cmd, undefined);
    setError(r.ok ? null : r.message);
  };
  return (
    <div className="screen">
      <PlanSummary index={0} />
      {state.branchDecisions.map((d) => (
        <p key={d.sequence} className="decision-line">
          {d.kind === 'confirmed' ? 'Action confirmed' : 'Action recorded'}: <strong>{actionLabel(d.option_id)}</strong>
        </p>
      ))}
      <ol className="course" aria-label="Experienced postoperative course">
        {state.branchSteps.map((s) => (
          <li key={s.id} className="update-card">
            <p className="eyebrow">{s.time.label}</p>
            <h3>{s.title}</h3>
            <ul>
              {s.lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            {s.notes?.map((n, i) => (
              <p key={i} className="note-box">
                <span className="note-time">{n.time}</span> {n.author}: {n.text}
              </p>
            ))}
          </li>
        ))}
      </ol>
      {state.plans.length > 1 ? <PlanSummary /> : null}
      {ADVANCE_LABEL[stage] ? (
        <div className="continue-block">
          <p className="muted small">Simulated clinical time advances; no real waiting is involved.</p>
          <button type="button" className="btn-primary" onClick={() => go(C.advanceBranch)}>
            {ADVANCE_LABEL[stage]}
          </button>
        </div>
      ) : null}
      {persistence ? (
        <>
          <section className="task-block" aria-labelledby="second-title">
            <p className="eyebrow">Your task</p>
            <h3 id="second-title">Respond to the reassessment</h3>
            <p className="muted">Your original plan stays in the record. This response is saved as a new linked version.</p>
            <PlanFields prefix="second" value={plan} onChange={setPlan} />
          </section>
          <ActionSelect
            legend="Which action does your revised plan describe?"
            error={error}
            onConfirm={(id) => {
              const r = run(C.commitSecondDecision, { ...plan, confidence: plan.confidence as number, option_id: id });
              if (!r.ok) setError(r.message);
              else clear();
            }}
          />
        </>
      ) : null}
      {resolved ? (
        <div className="continue-block">
          <button type="button" className="btn-primary" onClick={() => go(C.advanceToFollowUp)}>
            Continue to follow-up
          </button>
        </div>
      ) : null}
      {!persistence ? <ErrorNote message={error} /> : null}
    </div>
  );
}
