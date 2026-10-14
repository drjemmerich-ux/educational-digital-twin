// S04: study view, independent interpretation gate, report release, and model update.
import * as React from 'react';
import { contextStageOf } from '../engine/stageRules.ts';
import { INTERPRETATION_PROMPT, getInvestigationDef } from '../case/publicCatalogue.ts';
import { currentModel, nextStepFor, record } from '../engine/selectors.ts';
import type { EffectOnModel, ManagementThinking, ReleasedReport, ReleasedSeries } from '../engine/types.ts';
import { useController, useDraft, useRun, useSession, useUi } from '../ui/session.tsx';
import { COMMIT_NOTE, CommitBar, ConfidenceInput, ErrorNote, ListInput, RadioGroup, StatusChip, TextField } from './forms.tsx';
import { StudyViewer } from './StudyViewer.tsx';

export function ReportView(props: { report: ReleasedReport; compact?: boolean }) {
  return (
    <article className="report" aria-label={props.report.title}>
      <header className="report-head">
        <h4>{props.report.title}</h4>
        <span className="muted">{props.report.acquiredAt.label} · Synthetic case document</span>
      </header>
      {props.report.sections.map((sec) => (
        <section key={sec.heading} className="report-section">
          <h5>{sec.heading}</h5>
          <ul>
            {sec.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}

const STEPS = ['Request', 'Data released', 'Your interpretation', 'Report', 'Model update'];

function stepIndex(status: string, variant: string | null, interpreted: boolean, hasReport: boolean): number {
  if (status === 'MODEL_UPDATED') return 5;
  if (interpreted && hasReport) return 4;
  if (variant === 'image_gate') return interpreted ? 3 : 2;
  return hasReport ? (interpreted ? 4 : 2) : 1;
}

export function StudyPanel(props: { investigationId: string; readOnly?: boolean; onClose?: () => void }) {
  const state = useSession();
  const controller = useController();
  const [, setUi] = useUi();
  const def = getInvestigationDef(props.investigationId);
  const r = record(state, props.investigationId);
  const [tab, setTab] = React.useState<'images' | 'report' | 'annotations'>('images');
  const interpreted = r.interpretations.length > 0;
  const editable = !props.readOnly && def !== undefined && state.stage === contextStageOf(def.context);

  if (!def) return null;

  const placeholderShown = (assetId: string) => {
    if (!controller.state.assetNotices.some((n) => n.asset_id === assetId && n.kind === 'placeholder_displayed')) {
      void controller.run('recordAssetNotice', { asset_id: assetId, kind: 'placeholder_displayed', detail: 'Approved frames not supplied; technical placeholder shown.' });
    }
  };
  const loadError = (assetId: string, detail: string) => void controller.run('recordAssetNotice', { asset_id: assetId, kind: 'load_error', detail });

  // Comparison: only series from other studies already released in this session.
  const compareOptions = Object.values(state.investigations)
    .filter((x) => x.id !== r.id && x.series && x.series.length)
    .flatMap((x) =>
      (x.series as ReleasedSeries[]).map((s) => ({
        key: `${x.id}:${s.assetId}`,
        label: `${getInvestigationDef(x.id)?.title ?? x.id}: ${s.title}`,
        series: s,
        studyTitle: getInvestigationDef(x.id)?.title ?? x.id,
      })),
    );

  const active = stepIndex(r.status, r.variant, interpreted, r.report !== null);
  const isImageGate = r.variant === 'image_gate';

  return (
    <section className="study-panel" aria-labelledby={`study-${r.id}-title`}>
      <header className="study-head">
        <div>
          <p className="eyebrow">{r.acquiredAt ? r.acquiredAt.label : 'Investigation'}</p>
          <h3 id={`study-${r.id}-title`} tabIndex={-1}>
            {def.title}
          </h3>
        </div>
        <div className="row">
          {r.variant === 'text_only' ? <StatusChip tone="boundary">Text-only route</StatusChip> : null}
          {isImageGate ? <StatusChip tone="info">Technical placeholders</StatusChip> : null}
          <StatusChip tone={r.status === 'MODEL_UPDATED' ? 'resolved' : 'pending'}>{nextStepFor(r)}</StatusChip>
          {props.onClose ? (
            <button type="button" className="btn-secondary btn-small" onClick={props.onClose}>
              Back to investigations
            </button>
          ) : null}
        </div>
      </header>

      <ol className="stepper" aria-label="Investigation steps">
        {STEPS.map((label, i) => {
          const skip = i === 1 && !isImageGate && r.variant !== null;
          return (
            <li key={label} className={i < active ? 'done' : i === active ? 'current' : ''} aria-current={i === active ? 'step' : undefined}>
              {skip ? 'Result released' : label}
            </li>
          );
        })}
      </ol>

      <div className="request-recap">
        <div>
          <h4>Why you requested it</h4>
          <p>{r.rationale?.text}</p>
        </div>
        <div>
          <h4>What you expected</h4>
          <p>{r.expectation?.text}</p>
          {r.expectation?.confidence != null ? <p className="muted">Confidence {r.expectation.confidence}</p> : null}
        </div>
      </div>

      {r.imageUnavailableReason ? (
        <p className="boundary-note">
          <strong>Image interpretation not available for this study.</strong> {r.imageUnavailableReason}
        </p>
      ) : null}

      {isImageGate ? (
        <>
          <div className="tabs" role="tablist" aria-label="Study content">
            <button role="tab" type="button" aria-selected={tab === 'images'} className={tab === 'images' ? 'active' : ''} onClick={() => setTab('images')}>
              Images
            </button>
            <button
              role="tab"
              type="button"
              aria-selected={tab === 'report'}
              aria-disabled={!r.report}
              className={tab === 'report' ? 'active' : ''}
              onClick={() => setTab('report')}
            >
              Report{!r.report ? ' (locked)' : ''}
            </button>
            <button
              role="tab"
              type="button"
              aria-selected={tab === 'annotations'}
              aria-disabled={!r.report}
              className={tab === 'annotations' ? 'active' : ''}
              onClick={() => {
                setTab('annotations');
                if (r.report && interpreted) void controller.run('openAnnotations', { investigation_id: r.id });
              }}
            >
              Teaching annotations{!r.report ? ' (locked)' : ''}
            </button>
          </div>
          <div role="tabpanel">
            {tab === 'images' && r.series ? (
              <StudyViewer
                series={r.series}
                studyTitle={def.title}
                acquiredLabel={r.acquiredAt?.label ?? ''}
                compareOptions={compareOptions}
                onPlaceholderShown={placeholderShown}
                onLoadError={loadError}
              />
            ) : null}
            {tab === 'report' ? (
              r.report ? (
                <ReportView report={r.report} />
              ) : (
                <p className="locked-note">The formal report opens after you commit your own interpretation of the images.</p>
              )
            ) : null}
            {tab === 'annotations' ? (
              r.report ? (
                <p className="locked-note">{r.report.annotation.reason} No annotation copy is shown until expert validation is complete.</p>
              ) : (
                <p className="locked-note">Teaching annotations open after you commit your own interpretation.</p>
              )
            ) : null}
          </div>
        </>
      ) : r.report ? (
        <ReportView report={r.report} />
      ) : null}

      {interpreted ? <InterpretationRecord investigationId={r.id} editable={editable} /> : null}

      {editable && !interpreted && (r.status === 'RAW_DATA_RELEASED' || r.status === 'REPORT_RELEASED') ? (
        <InterpretationForm
          investigationId={r.id}
          imageGate={isImageGate}
          onCommitted={() => {
            setTab('report');
            setTimeout(() => document.getElementById(`study-${r.id}-title`)?.focus(), 0);
          }}
        />
      ) : null}

      {editable && isImageGate && r.status === 'RAW_DATA_RELEASED' ? <TextOnlySwitch investigationId={r.id} /> : null}

      {r.report && interpreted && !r.modelUpdate && editable ? <ModelUpdateForm investigationId={r.id} /> : null}
      {r.report && interpreted && !r.modelUpdate && !editable ? (
        <p className="muted">The model update for this study was not recorded before the case moved on.</p>
      ) : null}
      {r.modelUpdate ? (
        <div className="committed-block">
          <h4>Your model update</h4>
          <p>
            Effect on hypotheses: <strong>{effectLabel(r.modelUpdate.effect)}</strong> · Working model:{' '}
            <strong>{r.modelUpdate.decision === 'revise' ? 'revised (new version)' : 'maintained'}</strong> · Management thinking:{' '}
            <strong>{r.modelUpdate.management_thinking}</strong>
            {r.modelUpdate.confidence != null ? ` · Confidence ${r.modelUpdate.confidence}` : ''}
          </p>
          {r.modelUpdate.explanation ? <p className="quote">{r.modelUpdate.explanation}</p> : null}
        </div>
      ) : null}

      {editable && r.status !== 'AVAILABLE' ? (
        <p className="repeat-row">
          Need this study again later in time?{' '}
          <button type="button" className="btn-link" onClick={() => setUi({ drawerStudy: r.id, drawerMode: 'repeat' })}>
            Record a repeat request
          </button>
        </p>
      ) : null}
      {state.boundaryMessages.filter((b) => b.related_to === r.id).map((b) => (
        <p key={b.sequence} className="boundary-note" role="status">
          {b.message}
        </p>
      ))}
    </section>
  );
}

export function effectLabel(e: EffectOnModel): string {
  return e === 'supports' ? 'supports' : e === 'weakens' ? 'weakens' : e === 'mixed' ? 'mixed' : 'leaves unchanged';
}

function InterpretationRecord(props: { investigationId: string; editable: boolean }) {
  const state = useSession();
  const run = useRun();
  const r = record(state, props.investigationId);
  const [adding, setAdding] = React.useState(false);
  const [text, setText, clear] = useDraft(`addendum:${r.id}`, '');
  const [error, setError] = React.useState<string | null>(null);
  return (
    <div className="committed-block">
      <h4>Your interpretation</h4>
      {r.interpretations.map((i, idx) => (
        <div key={i.reasoning_version_id} className="version">
          <p className="muted">{idx === 0 ? 'Original, committed before the report' : `Addendum ${idx}, linked to the original`}</p>
          <p className="quote">{i.text}</p>
        </div>
      ))}
      {props.editable ? (
        adding ? (
          <div>
            <TextField id={`addendum-${r.id}`} label="Addendum" helper="Adds a linked version. Your original interpretation stays unchanged." value={text} onChange={setText} required />
            <ErrorNote message={error} />
            <div className="row">
              <button
                type="button"
                className="btn-primary"
                onClick={async () => {
                  const res = await run('addInterpretationAddendum', { investigation_id: r.id, text });
                  if (!res.ok) setError(res.message);
                  else {
                    clear();
                    setAdding(false);
                    setError(null);
                  }
                }}
              >
                Commit addendum
              </button>
              <button type="button" className="btn-secondary" onClick={() => setAdding(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn-link" onClick={() => setAdding(true)}>
            Add an addendum
          </button>
        )
      ) : null}
    </div>
  );
}

function InterpretationForm(props: { investigationId: string; imageGate: boolean; onCommitted: () => void }) {
  const run = useRun();
  const [text, setText, clear] = useDraft(`interp:${props.investigationId}`, '');
  const [conf, setConf, clearConf] = useDraft<number | null>(`interpconf:${props.investigationId}`, null);
  const [error, setError] = React.useState<string | null>(null);
  return (
    <div className="task-block">
      <h4>{props.imageGate ? 'Your independent interpretation' : 'Your interpretation of the result'}</h4>
      {props.imageGate ? <p className="field-helper">The formal report and teaching annotations stay locked until you commit this.</p> : null}
      <TextField
        id={`interp-${props.investigationId}`}
        label={props.imageGate ? INTERPRETATION_PROMPT : 'What does this result show, and which findings are most relevant?'}
        helper="Describe what you observe and what matters for your working model."
        value={text}
        onChange={setText}
        rows={4}
        required
      />
      <ConfidenceInput id={`interpconf-${props.investigationId}`} value={conf} onChange={setConf} />
      <p className="field-helper">{COMMIT_NOTE}</p>
      <ErrorNote message={error} />
      <button
        type="button"
        className="btn-primary"
        onClick={async () => {
          const res = await run('commitInterpretation', { investigation_id: props.investigationId, text, confidence: conf });
          if (!res.ok) setError(res.message);
          else {
            clear();
            clearConf();
            setError(null);
            props.onCommitted();
          }
        }}
      >
        {props.imageGate ? 'Commit interpretation and open report' : 'Commit interpretation'}
      </button>
    </div>
  );
}

function TextOnlySwitch(props: { investigationId: string }) {
  const run = useRun();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  if (!open) {
    return (
      <p className="repeat-row">
        Cannot review these images?{' '}
        <button type="button" className="btn-link" onClick={() => setOpen(true)}>
          Use the text-only route for this study
        </button>
      </p>
    );
  }
  return (
    <div className="task-block subtle">
      <TextField id={`textonly-${props.investigationId}`} label="Why is image interpretation not possible?" helper="Recorded in the session so the export shows which route you used." value={reason} onChange={setReason} required rows={2} />
      <ErrorNote message={error} />
      <div className="row">
        <button
          type="button"
          className="btn-primary"
          onClick={async () => {
            const res = await run('switchStudyToTextOnly', { investigation_id: props.investigationId, reason });
            if (!res.ok) setError(res.message);
          }}
        >
          Release authored findings as text
        </button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function ModelUpdateForm(props: { investigationId: string }) {
  const state = useSession();
  const run = useRun();
  const def = getInvestigationDef(props.investigationId)!;
  const chain = def.context === 'preop' ? 'preop' : 'postop';
  const cur = currentModel(state, chain);
  const key = `mu:${props.investigationId}`;
  const [effect, setEffect] = useDraft<EffectOnModel | null>(`${key}:effect`, null);
  const [explanation, setExplanation] = useDraft(`${key}:explanation`, '');
  const [decision, setDecision] = useDraft<'maintain' | 'revise' | null>(`${key}:decision`, null);
  const [pr, setPr] = useDraft(`${key}:pr`, cur?.problem_representation ?? '');
  const [hyps, setHyps] = useDraft<string[]>(`${key}:hyps`, cur?.hypotheses ?? ['']);
  const [prio, setPrio] = useDraft(`${key}:prio`, cur?.priorities ?? '');
  const [conf, setConf] = useDraft<number | null>(`${key}:conf`, null);
  const [mgmt, setMgmt] = useDraft<ManagementThinking | null>(`${key}:mgmt`, null);
  const [error, setError] = React.useState<string | null>(null);
  return (
    <div className="task-block">
      <h4>Update your working model</h4>
      <RadioGroup<EffectOnModel>
        name={`effect-${props.investigationId}`}
        legend="How does this result affect your hypotheses?"
        required
        value={effect}
        onChange={setEffect}
        options={[
          { id: 'supports', label: 'Supports' },
          { id: 'weakens', label: 'Weakens' },
          { id: 'unchanged', label: 'Leaves unchanged' },
          { id: 'mixed', label: 'Mixed' },
        ]}
      />
      <TextField id={`expl-${props.investigationId}`} label="Explain briefly" value={explanation} onChange={setExplanation} rows={2} />
      <RadioGroup<'maintain' | 'revise'>
        name={`decision-${props.investigationId}`}
        legend="Your working model"
        required
        value={decision}
        onChange={setDecision}
        options={[
          { id: 'maintain', label: 'Maintain my current working model' },
          { id: 'revise', label: 'Revise it (saved as a new version)' },
        ]}
      />
      {decision === 'revise' ? (
        <div className="revise-box">
          <TextField id={`rev-pr-${props.investigationId}`} label="Revised problem representation" value={pr} onChange={setPr} rows={3} required />
          <ListInput idBase={`rev-h-${props.investigationId}`} label="Revised hypotheses" items={hyps} onChange={setHyps} addLabel="Add hypothesis" required />
          <TextField id={`rev-p-${props.investigationId}`} label="Information priorities" value={prio} onChange={setPrio} rows={2} />
        </div>
      ) : null}
      <RadioGroup<ManagementThinking>
        name={`mgmt-${props.investigationId}`}
        legend="Has your management thinking changed?"
        required
        value={mgmt}
        onChange={setMgmt}
        options={[
          { id: 'changed', label: 'Yes' },
          { id: 'unchanged', label: 'No' },
          { id: 'unsure', label: 'Unsure' },
        ]}
      />
      <ConfidenceInput id={`mu-conf-${props.investigationId}`} value={conf} onChange={setConf} />
      <CommitBar
        label="Commit model update"
        confirmText={COMMIT_NOTE}
        error={error}
        onCommit={async () => {
          const res = await run('commitModelUpdate', {
            investigation_id: props.investigationId,
            effect,
            explanation,
            decision,
            revised: decision === 'revise' ? { problem_representation: pr, hypotheses: hyps, priorities: prio } : undefined,
            confidence: conf,
            management_thinking: mgmt,
          });
          setError(res.ok ? null : res.message);
        }}
      />
    </div>
  );
}
