// S09: expert review required. A safe application boundary, not a competence judgment and not
// simulated deterioration.
import * as React from 'react';
import { actionLabel } from '../engine/selectors.ts';
import { useRun, useSession, useUi } from '../ui/session.tsx';
import { ErrorNote } from '../components/forms.tsx';

const LABELS: Record<string, string> = {
  plan: 'Plan',
  rationale: 'Rationale',
  monitoring: 'Monitoring',
  threshold: 'Change or escalation threshold',
  confidence: 'Confidence',
  selected_action: 'Selected action category',
};

export function Review() {
  const state = useSession();
  const run = useRun();
  const [, setUi] = useUi();
  const [error, setError] = React.useState<string | null>(null);
  const pause = state.reviewPause;
  if (!pause) return null;
  return (
    <div className="screen">
      <section className="boundary-block" aria-labelledby="review-title">
        <p className="eyebrow">Simulation boundary</p>
        <h2 id="review-title">Expert review required</h2>
        <p className="ack-copy">{pause.copy}</p>
        <p className="muted">{pause.reason}</p>
        <p className="muted">
          This pause is a limit of the sandbox. It is not a judgment of your reasoning, and nothing has happened to the patient as a result of it.
        </p>
      </section>
      <section className="committed-block" aria-labelledby="preserved-title">
        <h3 id="preserved-title">Your preserved plan</h3>
        <dl className="kv">
          {Object.entries(pause.preserved).map(([k, v]) => (
            <React.Fragment key={k}>
              <dt>{LABELS[k] ?? k}</dt>
              <dd>{k === 'selected_action' ? actionLabel(v) : v || 'Not recorded'}</dd>
            </React.Fragment>
          ))}
        </dl>
      </section>
      <div className="continue-block row">
        <button
          type="button"
          className="btn-primary"
          onClick={async () => {
            const r = await run('enterDebrief', undefined);
            setError(r.ok ? null : r.message);
          }}
        >
          Open the debrief of your recorded reasoning
        </button>
        <button type="button" className="btn-secondary" onClick={() => setUi({ dialog: 'export' })}>
          Export session
        </button>
      </div>
      <p className="muted small">Revealed results remain available in the chart. Clinical follow-up is unavailable for this path. A restart would create a separate session.</p>
      <ErrorNote message={error} />
    </div>
  );
}
