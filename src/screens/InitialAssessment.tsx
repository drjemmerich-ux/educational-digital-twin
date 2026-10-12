// S01: initial patient presentation and the first committed reasoning. Nothing is prefilled.
import * as React from 'react';
import * as C from '../engine/commands.ts';
import { useDraft, useRun, useSession } from '../ui/session.tsx';
import { COMMIT_NOTE, CommitBar, ConfidenceInput, ListInput, TextField } from '../components/forms.tsx';

export function PresentationDocument() {
  const p = useSession().presentation;
  if (!p) return null;
  return (
    <article className="presentation" aria-labelledby="pres-title">
      <header className="doc-head">
        <p className="eyebrow">Outpatient spine clinic · Case entry</p>
        <h2 id="pres-title">Referral and clinical assessment</h2>
        <p>
          {p.patient.displayName}, {p.patient.ageYears}-year-old woman. {p.patient.occupation}. {p.patient.activity}.
        </p>
      </header>
      <div className="doc-grid">
        <section>
          <h3>History</h3>
          <p>{p.history.chiefConcern}</p>
          <dl className="kv">
            <dt>Duration</dt>
            <dd>{p.history.duration}</dd>
            <dt>Walking tolerance</dt>
            <dd>{p.history.walkingTolerance}</dd>
            <dt>Worse with</dt>
            <dd>{p.history.aggravating.join('; ')}</dd>
            <dt>Better with</dt>
            <dd>{p.history.relieving.join('; ')}</dd>
          </dl>
          <h4>Treatment so far</h4>
          <ul className="treatment">
            {p.history.priorManagement.map((t) => (
              <li key={t.what}>
                <span className="muted">{t.when}.</span> {t.what}.
              </li>
            ))}
          </ul>
          <h4>Asked and not present</h4>
          <p>{p.history.redFlagsAbsent.join(', ')}.</p>
          <h4>What matters to her</h4>
          <p>{p.history.preference}</p>
        </section>
        <section>
          <h3>Examination</h3>
          <table className="exam-table">
            <thead>
              <tr>
                <th scope="col">Domain</th>
                <th scope="col">Finding</th>
              </tr>
            </thead>
            <tbody>
              {p.examination.map((e) => (
                <tr key={e.domain}>
                  <th scope="row">{e.domain}</th>
                  <td>{e.finding}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>Baseline measures</h3>
          <table className="exam-table">
            <tbody>
              {p.baselineMeasures.map((m) => (
                <tr key={m.label}>
                  <th scope="row">{m.label}</th>
                  <td className="tabular">
                    {m.value}
                    {m.note ? <span className="cell-note">{m.note}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">Height {p.patient.heightCm} cm · weight {p.patient.weightKg} kg · BMI {p.patient.bmi} kg/m²</p>
        </section>
      </div>
    </article>
  );
}

export function InitialAssessment() {
  const run = useRun();
  const [pr, setPr, clearPr] = useDraft('n1:pr', '');
  const [hyps, setHyps, clearH] = useDraft<string[]>('n1:hyps', ['']);
  const [prio, setPrio, clearP] = useDraft('n1:prio', '');
  const [conf, setConf, clearC] = useDraft<number | null>('n1:conf', null);
  const [error, setError] = React.useState<string | null>(null);
  return (
    <div className="screen">
      <PresentationDocument />
      <section className="task-block" aria-labelledby="n1-task">
        <p className="eyebrow">Your task</p>
        <h2 id="n1-task">Initial assessment</h2>
        <p className="muted">Represent the problem in your own words before requesting any information.</p>
        <TextField
          id="n1-pr"
          label="Problem representation"
          helper="A concise summary of the clinical problem as you understand it now."
          value={pr}
          onChange={setPr}
          rows={3}
          required
        />
        <ListInput
          idBase="n1-h"
          label="Working hypotheses"
          helper="List the explanations you are considering, most likely first."
          items={hyps}
          onChange={setHyps}
          addLabel="Add hypothesis"
          required
        />
        <TextField
          id="n1-prio"
          label="Information priorities"
          helper="What do you most need to know next, and why?"
          value={prio}
          onChange={setPrio}
          rows={3}
          required
        />
        <ConfidenceInput id="n1-conf" value={conf} onChange={setConf} required label="Confidence in your leading hypothesis" />
        <CommitBar
          label="Commit initial assessment"
          confirmText={`${COMMIT_NOTE} After this you can request investigations.`}
          error={error}
          onCommit={() => {
            const res = run(C.commitInitialAssessment, { problem_representation: pr, hypotheses: hyps, priorities: prio, confidence: conf as number });
            if (!res.ok) setError(res.message);
            else {
              clearPr();
              clearH();
              clearP();
              clearC();
            }
          }}
        />
      </section>
    </div>
  );
}
