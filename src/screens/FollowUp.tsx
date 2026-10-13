// S10: follow-up encounter. Patient outcome only; no feedback about reasoning here.
import * as React from 'react';
import * as C from '../engine/commands.ts';
import { useRun, useSession } from '../ui/session.tsx';
import { ErrorNote } from '../components/forms.tsx';
import { Catalogue } from './Workup.tsx';
import { StudyPanel } from '../components/StudyPanel.tsx';
import { useUi } from '../ui/session.tsx';

export function FollowUpView() {
  const f = useSession().followUp?.followup;
  if (!f) return null;
  return (
    <section className="update-card" aria-labelledby="fu-title">
      <p className="eyebrow">{f.time.label}</p>
      <h2 id="fu-title">{f.title}</h2>
      <ul>
        {f.lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      {f.measures.length ? (
        <table className="outcome-table">
          <thead>
            <tr>
              <th scope="col">Measure</th>
              <th scope="col">Baseline</th>
              <th scope="col">Six weeks</th>
            </tr>
          </thead>
          <tbody>
            {f.measures.map((m) => (
              <tr key={m.label}>
                <th scope="row">{m.label}</th>
                <td className="tabular">{m.baseline}</td>
                <td className="tabular">{m.followUp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {f.unavailable.map((u) => (
        <p key={u} className="muted small">
          {u}
        </p>
      ))}
    </section>
  );
}

export function FollowUp() {
  const state = useSession();
  const run = useRun();
  const [ui, setUi] = useUi();
  const [error, setError] = React.useState<string | null>(null);
  const b1 = state.followUp?.course === 'B1';
  return (
    <div className="screen">
      <FollowUpView />
      {b1 ? (
        ui.activeStudy === 'followup_xr' && state.investigations.followup_xr ? (
          <StudyPanel investigationId="followup_xr" onClose={() => setUi({ activeStudy: null })} />
        ) : (
          <Catalogue context="followup" />
        )
      ) : (
        <p className="muted">No follow-up investigations are authored for this course.</p>
      )}
      <div className="continue-block">
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            const r = run(C.enterDebrief, undefined);
            setError(r.ok ? null : r.message);
          }}
        >
          Continue to the debrief
        </button>
      </div>
      <ErrorNote message={error} />
    </div>
  );
}
