// S07: new postoperative findings, reassessment, postoperative work-up (same gates), plan, and
// neutral action-category confirmation.
import * as React from 'react';
import * as C from '../engine/commands.ts';
import { POSTOP_ACTION_OPTIONS } from '../case/publicCatalogue.ts';
import type { BranchOptionId } from '../case/types.ts';
import type { PlanInput } from '../engine/types.ts';
import { useDraft, useRun, useSession } from '../ui/session.tsx';
import { COMMIT_NOTE, CommitBar, ConfidenceInput, ErrorNote, ListInput, RadioGroup, TextField } from '../components/forms.tsx';
import { UpdateCard } from './Procedure.tsx';
import { WorkupWorkspace } from './Workup.tsx';

export function PlanFields(props: { prefix: string; value: Omit<PlanInput, 'confidence'> & { confidence: number | null }; onChange: (v: Omit<PlanInput, 'confidence'> & { confidence: number | null }) => void }) {
  const v = props.value;
  return (
    <>
      <TextField id={`${props.prefix}-plan`} label="Management plan" value={v.plan} onChange={(x) => props.onChange({ ...v, plan: x })} rows={3} required />
      <TextField id={`${props.prefix}-rationale`} label="Rationale" value={v.rationale} onChange={(x) => props.onChange({ ...v, rationale: x })} rows={2} />
      <TextField id={`${props.prefix}-monitoring`} label="Monitoring" value={v.monitoring} onChange={(x) => props.onChange({ ...v, monitoring: x })} rows={2} />
      <TextField
        id={`${props.prefix}-threshold`}
        label="Change or escalation threshold"
        helper="What development would make you change or escalate this plan?"
        value={v.threshold}
        onChange={(x) => props.onChange({ ...v, threshold: x })}
        rows={2}
      />
      <ConfidenceInput id={`${props.prefix}-conf`} value={v.confidence} onChange={(x) => props.onChange({ ...v, confidence: x })} required />
    </>
  );
}

export const EMPTY_PLAN = { plan: '', rationale: '', monitoring: '', threshold: '', confidence: null as number | null };

function Reassessment() {
  const run = useRun();
  const [pr, setPr, c1] = useDraft('pod3:pr', '');
  const [dd, setDd, c2] = useDraft<string[]>('pod3:dd', ['']);
  const [prio, setPrio, c3] = useDraft('pod3:prio', '');
  const [conf, setConf, c4] = useDraft<number | null>('pod3:conf', null);
  const [error, setError] = React.useState<string | null>(null);
  return (
    <section className="task-block" aria-labelledby="reassess-title">
      <p className="eyebrow">Your task</p>
      <h3 id="reassess-title">Reassess the patient</h3>
      <TextField id="pod3-pr" label="New problem representation" value={pr} onChange={setPr} rows={3} required />
      <ListInput idBase="pod3-dd" label="Differential diagnosis" helper="Most likely first." items={dd} onChange={setDd} addLabel="Add diagnosis" required />
      <TextField id="pod3-prio" label="Immediate priorities" value={prio} onChange={setPrio} rows={2} required />
      <ConfidenceInput id="pod3-conf" value={conf} onChange={setConf} required label="Confidence in your leading explanation" />
      <CommitBar
        label="Commit reassessment"
        confirmText={`${COMMIT_NOTE} You can then request investigations.`}
        error={error}
        onCommit={() => {
          const r = run(C.commitPostopReassessment, { problem_representation: pr, differential: dd, priorities: prio, confidence: conf as number });
          if (!r.ok) setError(r.message);
          else [c1, c2, c3, c4].forEach((f) => f());
        }}
      />
    </section>
  );
}

function PlanForm() {
  const run = useRun();
  const [open, setOpen] = React.useState(false);
  const [plan, setPlan, clear] = useDraft('postop:plan', EMPTY_PLAN);
  const [error, setError] = React.useState<string | null>(null);
  if (!open) {
    return (
      <div className="continue-block">
        <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
          I am ready to commit a management plan
        </button>
      </div>
    );
  }
  return (
    <section className="task-block" aria-labelledby="plan-title">
      <p className="eyebrow">Your task</p>
      <h3 id="plan-title">Postoperative management plan</h3>
      <PlanFields prefix="postop" value={plan} onChange={setPlan} />
      <CommitBar
        label="Commit plan"
        confirmText={`${COMMIT_NOTE} The postoperative investigation catalogue closes after this step.`}
        error={error}
        onCommit={() => {
          const r = run(C.commitPostopPlan, { ...plan, confidence: plan.confidence as number });
          if (!r.ok) setError(r.message);
          else clear();
        }}
      />
      <button type="button" className="btn-link" onClick={() => setOpen(false)}>
        Return to investigations
      </button>
    </section>
  );
}

export function PlanSummary(props: { index?: number }) {
  const state = useSession();
  const p = state.plans[props.index ?? state.plans.length - 1];
  if (!p) return null;
  return (
    <section className="committed-block">
      <h3>Your committed plan{state.plans.length > 1 ? ` (version ${(props.index ?? state.plans.length - 1) + 1})` : ''}</h3>
      <p className="quote">{p.plan.plan}</p>
      <dl className="kv small">
        <dt>Rationale</dt>
        <dd>{p.plan.rationale || 'Not recorded'}</dd>
        <dt>Monitoring</dt>
        <dd>{p.plan.monitoring || 'Not recorded'}</dd>
        <dt>Threshold</dt>
        <dd>{p.plan.threshold || 'Not recorded'}</dd>
        <dt>Confidence</dt>
        <dd>{p.plan.confidence}</dd>
      </dl>
    </section>
  );
}

export function ActionSelect(props: { onConfirm: (id: BranchOptionId) => void; error: string | null; legend: string }) {
  const [choice, setChoice] = React.useState<BranchOptionId | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  return (
    <section className="task-block" aria-labelledby="action-title">
      <h3 id="action-title">{props.legend}</h3>
      <p className="muted">Choose the category that best describes the action in your plan. The categories are listed in no particular order.</p>
      <RadioGroup<BranchOptionId>
        name="action"
        legend="Action category"
        required
        value={choice}
        onChange={(v) => {
          setChoice(v);
          setConfirming(false);
        }}
        options={POSTOP_ACTION_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
      />
      <ErrorNote message={props.error} />
      {confirming && choice ? (
        <div className="confirm-inline">
          <p>
            Confirm “{POSTOP_ACTION_OPTIONS.find((o) => o.id === choice)?.label}”? The simulated course will continue from this choice.
            {choice === 'opt_none' ? ' This case has no authored consequence for other actions, so the session will pause for expert review with your plan preserved.' : ''}
          </p>
          <div className="row">
            <button type="button" className="btn-primary" onClick={() => props.onConfirm(choice)}>
              Confirm action
            </button>
            <button type="button" className="btn-secondary" onClick={() => setConfirming(false)}>
              Change selection
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn-primary" disabled={!choice} onClick={() => setConfirming(true)}>
          Continue
        </button>
      )}
    </section>
  );
}

export function Postop() {
  const state = useSession();
  const run = useRun();
  const [error, setError] = React.useState<string | null>(null);
  const pod3 = state.clinicalUpdates.find((u) => u.id === 'pod3');
  const intro = pod3 ? <UpdateCard update={pod3} tone="alert" /> : null;
  if (state.stage === 'N4.pod3_reassessment') {
    return (
      <div className="screen">
        {intro}
        <Reassessment />
      </div>
    );
  }
  if (state.stage === 'N4.postop_workup') {
    return <WorkupWorkspace context="postop" chain="postop" intro={intro} footer={<PlanForm />} />;
  }
  return (
    <div className="screen">
      {intro}
      <PlanSummary />
      <ActionSelect
        legend="Which action does your plan describe?"
        error={error}
        onConfirm={(id) => {
          const r = run(C.confirmBranchSelection, { option_id: id });
          setError(r.ok ? null : r.message);
        }}
      />
    </div>
  );
}
