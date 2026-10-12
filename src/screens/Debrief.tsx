// S11: layered descriptive debrief. Starts with what the learner actually did. No scores, no
// correct/incorrect markers, no competence or entrustment statements.
import * as React from 'react';
import * as C from '../engine/commands.ts';
import { REFLECTION_QUESTIONS, getInvestigationDef } from '../case/publicCatalogue.ts';
import { indexTreatmentComparison, investigationRows, narrativeStatements } from '../engine/debrief.ts';
import { actionLabel, confidenceTrajectory, sessionMetrics, strategyLabel } from '../engine/selectors.ts';
import { useController, useDraft, useRun, useSession, useUi } from '../ui/session.tsx';
import { COMMIT_NOTE, ErrorNote, TextField } from '../components/forms.tsx';
import type { FollowUpContent } from '../case/types.ts';

const LAYERS = [
  { id: 'trajectory', label: '1 · Reasoning trajectory' },
  { id: 'investigations', label: '2 · Investigations' },
  { id: 'decisions', label: '3 · Key decisions' },
  { id: 'index', label: '4 · Proposed vs demonstration operation' },
  { id: 'postop', label: '5 · Postoperative course' },
  { id: 'reflect', label: '6 · Metrics and reflection' },
] as const;

function ConfidenceChart(props: { points: { label: string; value: number }[] }) {
  const pts = props.points;
  if (pts.length < 2) return <p className="muted">Not enough confidence entries to plot.</p>;
  const w = 560;
  const h = 180;
  const pad = { l: 36, r: 12, t: 12, b: 24 };
  const x = (i: number) => pad.l + (i * (w - pad.l - pad.r)) / (pts.length - 1);
  const y = (v: number) => pad.t + ((100 - v) * (h - pad.t - pad.b)) / 100;
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  return (
    <figure className="chart-figure">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Your recorded confidence over the session, 0 to 100. Values are listed in the table below.">
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} className="grid" />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" className="axis">
              {t}
            </text>
          </g>
        ))}
        <path d={d} className="line" fill="none" />
        {pts.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.value)} r={i === pts.length - 1 ? 4.5 : 3} className="dot" />
        ))}
        <text x={pad.l} y={h - 6} className="axis">
          Session start
        </text>
        <text x={w - pad.r} y={h - 6} textAnchor="end" className="axis">
          Latest entry
        </text>
      </svg>
      <figcaption className="muted small">Confidence is self-reported. Higher or lower confidence does not indicate better reasoning.</figcaption>
    </figure>
  );
}

function FollowUpBlock(props: { f: FollowUpContent }) {
  return (
    <div>
      <ul>
        {props.f.lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      {props.f.measures.length ? (
        <table className="outcome-table">
          <tbody>
            {props.f.measures.map((m) => (
              <tr key={m.label}>
                <th scope="row">{m.label}</th>
                <td>{m.baseline}</td>
                <td>{m.followUp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

export function Debrief() {
  const state = useSession();
  const controller = useController();
  const run = useRun();
  const [, setUi] = useUi();
  const [layer, setLayer] = React.useState<(typeof LAYERS)[number]['id']>('trajectory');
  const [answers, setAnswers, clearAnswers] = useDraft<Record<string, string>>('debrief:answers', {});
  const [error, setError] = React.useState<string | null>(null);
  const log = controller.log;
  const metrics = sessionMetrics(state, log[0]?.timestamp_utc ?? null, log[log.length - 1]?.timestamp_utc ?? null);
  const rows = investigationRows(state);
  const cmp = indexTreatmentComparison(state);
  const statements = narrativeStatements(state);
  const rec = state.recommendation?.recommendation;
  const paused = state.reviewPause !== null;

  // Information available at each learner commitment.
  const commitments = state.timeline.filter((t) => t.kind === 'learner' || t.kind === 'boundary');
  const availableAt = (seq: number) =>
    Object.values(state.investigations)
      .filter((r) => r.releasedAtSequence !== null && r.releasedAtSequence < seq)
      .map((r) => getInvestigationDef(r.id)?.title ?? r.id);

  return (
    <div className="screen debrief">
      <header className="debrief-head">
        <p className="eyebrow">{paused ? 'Debrief after an expert-review pause' : 'Debrief'}</p>
        <h2>What you did in this encounter</h2>
        <p className="muted">
          A descriptive record of your reasoning, built from your committed entries. It contains no score or judgment. Clinical quality of the arguments requires expert
          review.
        </p>
        <ul className="statements">
          {statements.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <div className="row">
          <button type="button" className="btn-primary" onClick={() => setUi({ dialog: 'export' })}>
            Download session JSON
          </button>
          <button type="button" className="btn-secondary" onClick={() => setUi({ dialog: 'restart' })}>
            Start new encounter
          </button>
          <span className="muted small">PDF debrief: coming later.</span>
        </div>
      </header>

      <div className="tabs layer-tabs" role="tablist" aria-label="Debrief layers">
        {LAYERS.map((l) => (
          <button key={l.id} type="button" role="tab" aria-selected={layer === l.id} className={layer === l.id ? 'active' : ''} onClick={() => setLayer(l.id)}>
            {l.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="layer">
        {layer === 'trajectory' ? (
          <section>
            <h3>Chronological reasoning trajectory</h3>
            <ol className="trajectory">
              {state.timeline.map((t) => {
                const avail = t.kind === 'learner' ? availableAt(t.sequence) : null;
                return (
                  <li key={t.sequence} className={`tl-${t.kind}`}>
                    <span className="tl-time">{t.sim_label}</span>
                    <span>{t.text}</span>
                    {avail ? <span className="avail">Results available at this point: {avail.length ? avail.join(', ') : 'none'}</span> : null}
                  </li>
                );
              })}
            </ol>
            <p className="muted small">{commitments.length} committed or recorded learner entries.</p>
          </section>
        ) : null}

        {layer === 'investigations' ? (
          <section>
            <h3>Investigation purpose, expectation, and observation</h3>
            {rows.length === 0 ? <p className="muted">No investigations were requested.</p> : null}
            {rows.map((r) => (
              <article key={r.id} className="inv-row">
                <h4>{r.title}</h4>
                <p className="muted small">{r.route}</p>
                <div className="cmp-grid">
                  <div>
                    <h5>Why you requested it</h5>
                    <p>{r.rationale}</p>
                  </div>
                  <div>
                    <h5>What you expected</h5>
                    <p>{r.expectation}</p>
                  </div>
                  <div>
                    <h5>Your interpretation</h5>
                    <p>{r.interpretation}</p>
                    {r.addenda.map((a) => (
                      <p key={a} className="muted small">
                        Addendum: {a}
                      </p>
                    ))}
                  </div>
                  <div>
                    <h5>Released result</h5>
                    <p>{r.result}</p>
                  </div>
                </div>
                <p className="small">
                  Effect you recorded: <strong>{r.effect}</strong> · {r.decision} · Management thinking: {r.managementThinking}
                  {r.reopened ? ` · Reopened ${r.reopened} time${r.reopened > 1 ? 's' : ''}` : ''}
                </p>
              </article>
            ))}
            {state.unsupportedRequests.length ? (
              <>
                <h4>Requests outside the catalogue</h4>
                <ul>
                  {state.unsupportedRequests.map((u) => (
                    <li key={u.sequence}>
                      <strong>{u.name}</strong>. Why: {u.rationale}. Expected: {u.expectation}. No result was generated.
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>
        ) : null}

        {layer === 'decisions' ? (
          <section>
            <h3>Key decisions in your own words</h3>
            {state.models
              .filter((m) => m.chain === 'preop' && (m.trigger === 'initial_assessment' || m.trigger === 'workup_conclusion'))
              .map((m) => (
                <div key={m.version_id} className="committed-block">
                  <h4>{m.trigger === 'initial_assessment' ? 'Initial assessment' : 'Integrated working model'}</h4>
                  <p className="quote">{m.problem_representation}</p>
                  {m.trigger === 'initial_assessment' ? <p className="small">Hypotheses: {m.hypotheses.join('; ')}</p> : null}
                  {m.confidence !== null ? <p className="muted small">Confidence {m.confidence}</p> : null}
                </div>
              ))}
            {rec ? (
              <div className="committed-block">
                <h4>Management recommendation</h4>
                <p>
                  <strong>{strategyLabel(rec.category)}</strong>: {rec.strategy_summary}
                </p>
                <dl className="kv small">
                  {(
                    [
                      ['Indication', rec.indication],
                      ['Symptom target', rec.symptom_target],
                      ['Level and extent', rec.level_extent],
                      ['Approach', rec.approach],
                      ['Facet preservation', rec.facet_preservation],
                      ['Fusion rationale', rec.fusion_rationale],
                      ['Expected benefit', rec.expected_benefit],
                      ['Risks', rec.risks],
                      ['Alternative', rec.alternative],
                      ['Patient preference', rec.patient_preference],
                      ['Uncertainty', rec.uncertainty],
                      ['Change threshold', rec.change_threshold],
                    ] as const
                  ).map(([k, v]) => (
                    <React.Fragment key={k}>
                      <dt>{k}</dt>
                      <dd>{v || 'Not recorded'}</dd>
                    </React.Fragment>
                  ))}
                  <dt>Confidence</dt>
                  <dd>{rec.confidence}</dd>
                </dl>
              </div>
            ) : null}
            {state.intraopProposal ? (
              <div className="two-col">
                <div className="committed-block">
                  <h4>Your intraoperative proposal</h4>
                  <p>{state.intraopProposal.immediate}</p>
                  <p className="small">Checks: {state.intraopProposal.checks || 'Not recorded'}</p>
                  <p className="small">Postoperative considerations: {state.intraopProposal.postop_considerations || 'Not recorded'}</p>
                </div>
                <div className="update-card">
                  <h4>Simulated team action</h4>
                  <ul>
                    {state.teamAction?.team_action.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {layer === 'index' ? (
          <section>
            <h3>Your proposed index treatment and the demonstration operation</h3>
            {cmp ? (
              <div className="two-col">
                <div className="committed-block">
                  <h4>Your recommendation</h4>
                  <p>{cmp.participant}</p>
                </div>
                <div className="update-card">
                  <h4>Predefined demonstration course</h4>
                  <p>{cmp.canonical}</p>
                </div>
              </div>
            ) : (
              <p className="muted">No recommendation was committed.</p>
            )}
            {cmp ? <p className="ack-copy">{cmp.note}</p> : null}
            {state.recommendationFlag ? <p className="boundary-note">{state.recommendationFlag}</p> : null}
          </section>
        ) : null}

        {layer === 'postop' ? (
          <section>
            <h3>Postoperative choices and authored consequences</h3>
            {state.postopDifferential.length ? <p>Your differential at reassessment: {state.postopDifferential.join('; ')}.</p> : null}
            {state.plans.map((p, i) => (
              <div key={p.plan_version_id} className="committed-block">
                <h4>
                  Plan version {i + 1}
                  {p.predecessor_id ? ' (linked to the previous version)' : ''}
                </h4>
                <p className="quote">{p.plan.plan}</p>
                <p className="small">Threshold: {p.plan.threshold || 'Not recorded'} · Confidence {p.plan.confidence}</p>
              </div>
            ))}
            {state.branchDecisions.map((d) => (
              <p key={d.sequence} className="decision-line">
                {d.kind === 'confirmed' ? 'Confirmed' : 'Recorded without authored consequence'}: {actionLabel(d.option_id)}
              </p>
            ))}
            <div className="scenario experienced">
              <h4>Experienced course</h4>
              {state.branchSteps.length ? (
                <ul>
                  {state.branchSteps.map((s) => (
                    <li key={s.id}>
                      <strong>{s.title}</strong> ({s.time.label}): {s.lines.join(' ')}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No authored branch consequence was executed.</p>
              )}
              {state.followUp ? <FollowUpBlock f={state.followUp.followup} /> : <p className="muted">Clinical follow-up is unavailable for this path.</p>}
            </div>
            {state.comparisons?.reference ? (
              <div className="scenario reference">
                <h4>{state.comparisons.reference.label}</h4>
                <p className="muted small">Not part of your experienced trajectory.</p>
                <p>
                  <strong>{state.comparisons.reference.summary.action}.</strong> {state.comparisons.reference.summary.consequence}
                </p>
                <FollowUpBlock f={state.comparisons.reference.followup} />
              </div>
            ) : null}
            {state.comparisons?.others.map((o) => (
              <div key={o.branch_id} className="scenario other">
                <h4>{o.label}</h4>
                <p>
                  <strong>{o.action}.</strong> {o.consequence}
                </p>
              </div>
            ))}
            <p className="muted small">
              These are modelled educational scenarios, not validated individualized predictions. They are compared by burden and reasoning, and no comparative outcome
              probabilities are implied.
            </p>
          </section>
        ) : null}

        {layer === 'reflect' ? (
          <section>
            <h3>Descriptive session metrics</h3>
            <table className="metrics">
              <thead>
                <tr>
                  <th scope="col">Metric</th>
                  <th scope="col">Value</th>
                  <th scope="col">Definition</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((m) => (
                  <tr key={m.label}>
                    <th scope="row">{m.label}</th>
                    <td className="tabular">{m.value}</td>
                    <td className="small">{m.definition}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3>Confidence over time</h3>
            <ConfidenceChart points={confidenceTrajectory(state)} />
            <details>
              <summary>Confidence entries</summary>
              <table className="mini-table">
                <tbody>
                  {confidenceTrajectory(state).map((p, i) => (
                    <tr key={i}>
                      <th scope="row">{p.label}</th>
                      <td className="tabular">{p.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
            <h3>Tutor exchanges</h3>
            {state.tutor.messages.filter((m) => m.role !== 'system').length ? (
              <ul className="small">
                {state.tutor.messages
                  .filter((m) => m.role !== 'system')
                  .map((m) => (
                    <li key={m.sequence}>
                      <strong>{m.role === 'tutor' ? 'Tutor' : 'You'}:</strong> {m.text}
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="muted">No tutor exchanges.</p>
            )}
            <h3>Reflection</h3>
            {state.reflections.map((r) => (
              <div key={r.reflection_version_id} className="committed-block">
                {REFLECTION_QUESTIONS.filter((q) => r.answers[q.id]).map((q) => (
                  <p key={q.id}>
                    <strong>{q.text}</strong> {r.answers[q.id]}
                  </p>
                ))}
              </div>
            ))}
            {!state.completion ? (
              <div className="task-block">
                {REFLECTION_QUESTIONS.map((q) => (
                  <TextField key={q.id} id={`refl-${q.id}`} label={q.text} value={answers[q.id] ?? ''} onChange={(v) => setAnswers({ ...answers, [q.id]: v })} rows={2} />
                ))}
                <p className="field-helper">{COMMIT_NOTE}</p>
                <ErrorNote message={error} />
                <div className="row">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      const r = run(C.commitReflection, { answers });
                      if (!r.ok) setError(r.message);
                      else {
                        clearAnswers();
                        setError(null);
                      }
                    }}
                  >
                    Commit reflection
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      const r = run(C.completeSession, undefined);
                      setError(r.ok ? null : r.message);
                    }}
                  >
                    Finish session
                  </button>
                </div>
              </div>
            ) : (
              <p className="resolved-note">
                Session finished ({state.completion.completion_status === 'clinical_pathway_completed' ? 'clinical pathway completed' : 'debriefed after an expert-review pause'}).
                Export the JSON to keep a copy.
              </p>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
