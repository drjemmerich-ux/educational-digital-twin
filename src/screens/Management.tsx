// S05: management commitment, then the transparent canonical-continuation acknowledgement.
import * as React from 'react';
import { STRATEGY_CATEGORIES, type StrategyCategory } from '../case/publicCatalogue.ts';
import { strategyLabel } from '../engine/selectors.ts';
import type { RecommendationInput } from '../engine/types.ts';
import { useDraft, useRun, useSession } from '../ui/session.tsx';
import { COMMIT_NOTE, CommitBar, ConfidenceInput, RadioGroup, TextField } from '../components/forms.tsx';
import { IntegratedReport, WorkingModelCard } from './Workup.tsx';

const FIELDS: { key: keyof RecommendationInput; label: string; helper?: string }[] = [
  { key: 'indication', label: 'Indication', helper: 'Why treatment is, or is not, indicated now.' },
  { key: 'symptom_target', label: 'Dominant symptom you aim to treat' },
  { key: 'level_extent', label: 'Level and extent' },
  { key: 'approach', label: 'Approach' },
  { key: 'facet_preservation', label: 'Anticipated facet preservation' },
  { key: 'fusion_rationale', label: 'Rationale for including or excluding fusion' },
  { key: 'expected_benefit', label: 'Expected benefit' },
  { key: 'risks', label: 'Important risks' },
  { key: 'alternative', label: 'Credible alternative strategy' },
  { key: 'patient_preference', label: "How the patient's preferences shape this plan" },
  { key: 'uncertainty', label: 'Unresolved uncertainty' },
  { key: 'change_threshold', label: 'What would change your recommendation?' },
];

const COMPARISON_OPTIONS = ['Nonoperative care', 'Decompression alone', 'Decompression with fusion'];

export function Management() {
  const run = useRun();
  const [category, setCategory] = useDraft<StrategyCategory | null>('n3:category', null);
  const [other, setOther] = useDraft('n3:other', '');
  const [summary, setSummary] = useDraft('n3:summary', '');
  const [fields, setFields] = useDraft<Record<string, string>>('n3:fields', {});
  const [comparison, setComparison] = useDraft<Record<string, Record<string, string>>>('n3:comparison', {});
  const [conf, setConf] = useDraft<number | null>('n3:conf', null);
  const [error, setError] = React.useState<string | null>(null);
  const setField = (k: string, v: string) => setFields({ ...fields, [k]: v });
  const setCmp = (opt: string, k: string, v: string) => setComparison({ ...comparison, [opt]: { ...(comparison[opt] ?? {}), [k]: v } });

  const commit = async () => {
    const input: RecommendationInput = {
      category: (category ?? '') as StrategyCategory,
      other_strategy: other,
      strategy_summary: summary,
      indication: fields.indication ?? '',
      symptom_target: fields.symptom_target ?? '',
      level_extent: fields.level_extent ?? '',
      approach: fields.approach ?? '',
      facet_preservation: fields.facet_preservation ?? '',
      fusion_rationale: fields.fusion_rationale ?? '',
      expected_benefit: fields.expected_benefit ?? '',
      risks: fields.risks ?? '',
      alternative: fields.alternative ?? '',
      patient_preference: fields.patient_preference ?? '',
      uncertainty: fields.uncertainty ?? '',
      change_threshold: fields.change_threshold ?? '',
      confidence: conf as number,
      comparison: COMPARISON_OPTIONS.filter((o) => Object.values(comparison[o] ?? {}).some((v) => v.trim())).map((o) => ({
        option: o,
        benefits: comparison[o]?.benefits ?? '',
        risks: comparison[o]?.risks ?? '',
        uncertainty: comparison[o]?.uncertainty ?? '',
        preference_fit: comparison[o]?.preference_fit ?? '',
      })),
    };
    const res = await run('commitRecommendation', input);
    setError(res.ok ? null : res.message);
  };

  return (
    <div className="screen">
      <WorkingModelCard chain="preop" editable={false} title="Your integrated working model" />
      <IntegratedReport />
      <section className="task-block" aria-labelledby="n3-title">
        <p className="eyebrow">Your task · Day 14 after case entry</p>
        <h2 id="n3-title">Management recommendation</h2>
        <p className="muted">
          Propose the strategy you would recommend for this patient. Categories organize your answer; none is preselected or treated as expected.
        </p>
        <RadioGroup<StrategyCategory>
          name="strategy"
          legend="Strategy category"
          required
          value={category}
          onChange={setCategory}
          options={STRATEGY_CATEGORIES.map((c) => ({ id: c.id, label: c.label }))}
        />
        {category === 'other' ? <TextField id="n3-other" label="Describe your other strategy" value={other} onChange={setOther} rows={2} required /> : null}
        <TextField id="n3-summary" label="Your strategy in one sentence" value={summary} onChange={setSummary} rows={2} required />
        <div className="field-grid">
          {FIELDS.map((f) => (
            <TextField key={f.key} id={`n3-${f.key}`} label={f.label} helper={f.helper} value={fields[f.key] ?? ''} onChange={(v) => setField(f.key, v)} rows={2} />
          ))}
        </div>
        <details className="comparison">
          <summary>Optional strategy comparison workspace</summary>
          <p className="muted small">Compare the options side by side in your own words. Nothing here is filled in for you.</p>
          <div className="table-scroll">
            <table className="cmp-table">
              <thead>
                <tr>
                  <th scope="col">Option</th>
                  <th scope="col">Benefits</th>
                  <th scope="col">Risks</th>
                  <th scope="col">Uncertainty</th>
                  <th scope="col">Fit with patient preferences</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_OPTIONS.map((o, i) => (
                  <tr key={o}>
                    <th scope="row">{o}</th>
                    {['benefits', 'risks', 'uncertainty', 'preference_fit'].map((k) => (
                      <td key={k}>
                        <label className="sr-only" htmlFor={`cmp-${i}-${k}`}>
                          {o}: {k.replace('_', ' ')}
                        </label>
                        <textarea id={`cmp-${i}-${k}`} rows={2} value={comparison[o]?.[k] ?? ''} onChange={(e) => setCmp(o, k, e.target.value)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        <ConfidenceInput id="n3-conf" value={conf} onChange={setConf} required label="Confidence in your recommendation" />
        <CommitBar label="Commit recommendation" confirmText={`${COMMIT_NOTE} Your recommendation is saved before anything else happens in the case.`} error={error} onCommit={commit} />
      </section>
    </div>
  );
}

export function CanonicalAck() {
  const state = useSession();
  const run = useRun();
  const [error, setError] = React.useState<string | null>(null);
  const rec = state.recommendation?.recommendation;
  return (
    <div className="screen">
      <section className="committed-block" aria-labelledby="rec-saved">
        <p className="eyebrow">Saved</p>
        <h2 id="rec-saved">Your recommendation</h2>
        {rec ? (
          <>
            <p>
              <strong>{strategyLabel(rec.category)}</strong>
              {rec.category === 'other' ? `: ${rec.other_strategy}` : ''}
            </p>
            <p className="quote">{rec.strategy_summary}</p>
            <p className="muted small">Confidence {rec.confidence}</p>
          </>
        ) : null}
        {state.recommendationFlag ? <p className="boundary-note">{state.recommendationFlag}</p> : null}
      </section>
      <section className="ack-block" aria-labelledby="ack-title">
        <h2 id="ack-title">How the simulated course continues</h2>
        <p className="ack-copy">{state.canonicalExplained}</p>
        <p>
          The predefined procedure is a complete L4-L5 decompression with bilateral lateral-recess decompression and limited cranial extension into L3-L4, without fusion or
          instrumentation. It does not replace your recommendation, which stays in your record exactly as you committed it.
        </p>
        <button
          type="button"
          className="btn-primary"
          onClick={async () => {
            const r = await run('acknowledgeCanonical', undefined);
            if (!r.ok) setError(r.message);
          }}
        >
          I understand. Continue with the predefined course
        </button>
        {error ? <p className="error-note">{error}</p> : null}
      </section>
    </div>
  );
}
