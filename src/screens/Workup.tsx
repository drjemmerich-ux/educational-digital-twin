// S02: diagnostic work-up. Neutral catalogue cards (no thumbnails, no results before release),
// visible working model, and the active study (S04). Reused for postoperative and follow-up studies.
import * as React from 'react';
import * as C from '../engine/commands.ts';
import type { InvestigationContext } from '../case/types.ts';
import { catalogue, currentModel, integratedRadiologyReport, modelChain } from '../engine/selectors.ts';
import type { ModelChain } from '../engine/types.ts';
import { useDraft, useRun, useSession, useUi } from '../ui/session.tsx';
import { COMMIT_NOTE, CommitBar, ConfidenceInput, ErrorNote, ListInput, StatusChip, TextField } from '../components/forms.tsx';
import { ReportView, StudyPanel } from '../components/StudyPanel.tsx';

export function WorkingModelCard(props: { chain: ModelChain; editable: boolean; title?: string }) {
  const state = useSession();
  const run = useRun();
  const cur = currentModel(state, props.chain);
  const history = modelChain(state, props.chain);
  const [revising, setRevising] = React.useState(false);
  const k = `wm:${props.chain}`;
  const [pr, setPr, clearPr] = useDraft(`${k}:pr`, cur?.problem_representation ?? '');
  const [hyps, setHyps, clearH] = useDraft<string[]>(`${k}:h`, cur?.hypotheses ?? ['']);
  const [prio, setPrio, clearP] = useDraft(`${k}:p`, cur?.priorities ?? '');
  const [reason, setReason, clearR] = useDraft(`${k}:reason`, '');
  const [conf, setConf, clearC] = useDraft<number | null>(`${k}:c`, null);
  const [error, setError] = React.useState<string | null>(null);
  if (!cur) return null;
  return (
    <section className="model-card" aria-labelledby={`model-${props.chain}`}>
      <div className="model-head">
        <h3 id={`model-${props.chain}`}>{props.title ?? 'Your current working model'}</h3>
        <span className="muted small">
          Version {cur.version}
          {cur.confidence !== null ? ` · confidence ${cur.confidence}` : ''}
        </span>
      </div>
      <p>{cur.problem_representation}</p>
      <ol className="hyp-list">
        {cur.hypotheses.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ol>
      {cur.priorities ? <p className="muted small">Priorities: {cur.priorities}</p> : null}
      <div className="row">
        {props.editable && !revising ? (
          <button
            type="button"
            className="btn-secondary btn-small"
            onClick={() => {
              setPr(cur.problem_representation);
              setHyps(cur.hypotheses);
              setPrio(cur.priorities);
              setRevising(true);
            }}
          >
            Revise working model
          </button>
        ) : null}
        {history.length > 1 ? (
          <details className="history">
            <summary>Version history ({history.length})</summary>
            <ol>
              {history.map((m) => (
                <li key={m.version_id}>
                  <strong>v{m.version}</strong> · {m.trigger.replace(/_/g, ' ').replace('study update:', 'after ')}
                  {m.predecessor_id ? ' · linked to previous version' : ''}
                  <p className="quote">{m.problem_representation}</p>
                </li>
              ))}
            </ol>
          </details>
        ) : null}
      </div>
      {revising ? (
        <div className="revise-box">
          <TextField id={`${k}-pr`} label="Problem representation" value={pr} onChange={setPr} rows={3} required />
          <ListInput idBase={`${k}-h`} label="Hypotheses" items={hyps} onChange={setHyps} addLabel="Add hypothesis" required />
          <TextField id={`${k}-prio`} label="Information priorities" value={prio} onChange={setPrio} rows={2} />
          <TextField id={`${k}-reason`} label="What prompted this revision?" value={reason} onChange={setReason} rows={2} />
          <ConfidenceInput id={`${k}-conf`} value={conf} onChange={setConf} />
          <ErrorNote message={error} />
          <div className="row">
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                const res = run(C.reviseWorkingModel, { problem_representation: pr, hypotheses: hyps, priorities: prio, reason, confidence: conf });
                if (!res.ok) setError(res.message);
                else {
                  [clearPr, clearH, clearP, clearR, clearC].forEach((f) => f());
                  setRevising(false);
                  setError(null);
                }
              }}
            >
              Save as new version
            </button>
            <button type="button" className="btn-secondary" onClick={() => setRevising(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function Catalogue(props: { context: InvestigationContext }) {
  const state = useSession();
  const [ui, setUi] = useUi();
  const run = useRun();
  const items = catalogue(state, props.context);
  return (
    <section aria-labelledby={`cat-${props.context}`}>
      <h3 id={`cat-${props.context}`} className="section-title">
        Investigations
      </h3>
      <p className="muted small">Request in any order. You do not need every study before deciding. Each request needs your reasoning first.</p>
      <ul className="catalogue">
        {items.map(({ def, record, cardState, requestable, nextStep }) => (
          <li key={def.id} className={`cat-card state-${cardState} ${ui.activeStudy === def.id ? 'active' : ''}`}>
            <div className="cat-body">
              <h4>{def.title}</h4>
              <p className="muted small">{def.kind === 'imaging' ? 'Imaging' : 'Report'} · {def.description}</p>
            </div>
            <div className="cat-foot">
              <StatusChip tone={cardState === 'complete' ? 'resolved' : cardState === 'available' ? 'neutral' : cardState === 'closed' ? 'neutral' : 'pending'}>
                {cardState === 'available' ? 'Available' : cardState === 'closed' ? 'Not available now' : nextStep}
              </StatusChip>
              {requestable ? (
                <button type="button" className="btn-primary btn-small" onClick={() => setUi({ drawerStudy: def.id, drawerMode: 'request' })} aria-label={`Request ${def.title}`}>
                  Request
                </button>
              ) : record.status !== 'AVAILABLE' ? (
                <button
                  type="button"
                  className="btn-secondary btn-small"
                  aria-label={`Open ${def.title}`}
                  onClick={() => {
                    if (ui.activeStudy === def.id) return;
                    // Reopening a released study is logged as a view, never as a new order.
                    run(C.openStudy, { investigation_id: def.id });
                    setUi({ activeStudy: def.id });
                  }}
                >
                  Open
                </button>
              ) : null}
            </div>
          </li>
        ))}
        {state.stage === C.contextStage(items[0]!.def) ? (
          <li className="cat-card other">
            <div className="cat-body">
              <h4>Request another investigation</h4>
              <p className="muted small">For a test or record not listed here. Your reasoning is saved even if no result exists.</p>
            </div>
            <div className="cat-foot">
              <span />
              <button type="button" className="btn-secondary btn-small" onClick={() => setUi({ drawerStudy: null, drawerMode: 'unsupported' })}>
                Describe request
              </button>
            </div>
          </li>
        ) : null}
      </ul>
      {state.unsupportedRequests.filter((u) => u.context === state.stage).length ? (
        <div className="boundary-list">
          <h4>Requests outside the catalogue</h4>
          <ul>
            {state.unsupportedRequests
              .filter((u) => u.context === state.stage)
              .map((u) => (
                <li key={u.sequence}>
                  <strong>{u.name}</strong>: no result in this case. Reasoning preserved.
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export function WorkupWorkspace(props: { context: InvestigationContext; chain: ModelChain; footer?: React.ReactNode; intro?: React.ReactNode }) {
  const state = useSession();
  const [ui, setUi] = useUi();
  const active = ui.activeStudy && state.investigations[ui.activeStudy] && catalogue(state, props.context).some((c) => c.def.id === ui.activeStudy) ? ui.activeStudy : null;
  return (
    <div className="screen">
      {props.intro}
      <WorkingModelCard chain={props.chain} editable={state.stage === 'N2.workup' || state.stage === 'N4.postop_workup'} />
      {active ? (
        <StudyPanel investigationId={active} onClose={() => setUi({ activeStudy: null })} />
      ) : (
        <Catalogue context={props.context} />
      )}
      {!active ? props.footer : null}
    </div>
  );
}

export function IntegratedReport() {
  const state = useSession();
  const items = integratedRadiologyReport(state, 'preop');
  if (!items.length) return null;
  return (
    <details className="integrated-report">
      <summary>Integrated radiology report ({items.length} interpreted imaging {items.length === 1 ? 'study' : 'studies'})</summary>
      <p className="muted small">Includes only imaging you requested and interpreted in this session.</p>
      {items.map((i) => (
        <ReportView key={i.investigation_id} report={i.report} compact />
      ))}
    </details>
  );
}

export function Workup() {
  return <WorkupWorkspace context="preop" chain="preop" footer={<ConcludeWorkup />} intro={<IntegratedReport />} />;
}

function ConcludeWorkup() {
  const state = useSession();
  const run = useRun();
  const [open, setOpen] = React.useState(false);
  const [model, setModel, clearM] = useDraft('n2:integrated', '');
  const [conf, setConf, clearC] = useDraft<number | null>('n2:conf', null);
  const [enough, setEnough] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const pending = Object.values(state.investigations).filter((r) => r.status !== 'AVAILABLE' && r.status !== 'MODEL_UPDATED');
  if (!open) {
    return (
      <div className="continue-block">
        <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
          I have enough information to formulate a management plan
        </button>
      </div>
    );
  }
  return (
    <section className="task-block" aria-labelledby="conclude-title">
      <h3 id="conclude-title">Integrated working model</h3>
      {pending.length ? (
        <p className="pending-note">
          {pending.length} released {pending.length === 1 ? 'study has' : 'studies have'} an unfinished interpretation or model update. If you continue, they stay recorded as
          incomplete.
        </p>
      ) : null}
      <TextField
        id="n2-integrated"
        label="Summarize your integrated working model"
        helper="Bring together the clinical picture and the information you obtained, including what remains uncertain."
        value={model}
        onChange={setModel}
        rows={4}
        required
      />
      <ConfidenceInput id="n2-conf" value={conf} onChange={setConf} required />
      <label className="check">
        <input type="checkbox" checked={enough} onChange={(e) => setEnough(e.target.checked)} /> I have enough information to propose a management plan.
      </label>
      <CommitBar
        label="Commit and continue to management"
        confirmText={`${COMMIT_NOTE} The pre-operative investigation catalogue closes after this step.`}
        error={error}
        onCommit={() => {
          const res = run(C.concludeWorkup, { integrated_model: model, confidence: conf as number, enough_information: enough });
          if (!res.ok) setError(res.message);
          else {
            clearM();
            clearC();
          }
        }}
      />
      <button type="button" className="btn-link" onClick={() => setOpen(false)}>
        Return to investigations
      </button>
    </section>
  );
}
