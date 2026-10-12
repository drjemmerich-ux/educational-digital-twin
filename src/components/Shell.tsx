// Workspace chrome: top bar, chart panel, tutor panel, and global dialogs.
import * as React from 'react';
import { APP_NAME, CASE_TITLE, SYNTHETIC_LABEL, getInvestigationDef, stageLabel } from '../case/publicCatalogue.ts';
import { CURRENT_VERSIONS } from '../case/versions.ts';
import { releasedResults } from '../engine/selectors.ts';
import { buildExport } from '../session/export.ts';
import { saveTextFile } from '../ui/fileSave.ts';
import { requestSupport, respondToTutor, setTutorPreference } from '../tutor/tutorService.ts';
import { buildTutorContext } from '../tutor/context.ts';
import { useController, useSession, useTutor, useUi } from '../ui/session.tsx';
import { Dialog, StatusChip } from './forms.tsx';
import { StudyPanel } from './StudyPanel.tsx';

export function TopBar(props: { onExit: () => void }) {
  const state = useSession();
  const controller = useController();
  const [ui, setUi] = useUi();
  const save = controller.saveStatus;
  const saveText =
    save === 'saved' ? 'Saved in this browser' : save === 'memory_only' ? 'Not saved: memory only' : save === 'failed' ? 'Last save failed' : save === 'conflict' ? 'Open in another tab' : 'Ready';
  return (
    <header className="topbar">
      <div className="topbar-brand">
        <span className="app-name">{APP_NAME}</span>
        <span className="case-name">{CASE_TITLE}</span>
      </div>
      <div className="topbar-stage" aria-live="polite">
        <span className="stage-label">{stageLabel(state.stage)}</span>
        {state.stage !== 'START' ? <span className="sim-time">Clinical time: {state.simTime.label}</span> : null}
      </div>
      <div className="topbar-actions">
        <span className={`save-status save-${save}`} role="status">
          {saveText}
        </span>
        <span className="synthetic-chip">{SYNTHETIC_LABEL}</span>
        <button type="button" className="topbar-btn drawer-toggle" aria-expanded={ui.chartOpen} onClick={() => setUi({ chartOpen: !ui.chartOpen, tutorOpen: false })}>
          Chart
        </button>
        <button type="button" className="topbar-btn drawer-toggle" aria-expanded={ui.tutorOpen} onClick={() => setUi({ tutorOpen: !ui.tutorOpen, chartOpen: false })}>
          Tutor
        </button>
        <button type="button" className="topbar-btn" onClick={() => setUi({ dialog: 'help' })}>
          Help
        </button>
        <button type="button" className="topbar-btn" onClick={() => setUi({ dialog: 'export' })}>
          Export
        </button>
        <button type="button" className="topbar-btn" onClick={props.onExit}>
          Exit
        </button>
      </div>
    </header>
  );
}

export function ChartPanel() {
  const state = useSession();
  const [, setUi] = useUi();
  const p = state.presentation;
  if (!p) return null;
  const results = releasedResults(state);
  const notes = [
    ...state.clinicalUpdates.flatMap((u) => u.notes ?? []),
    ...state.branchSteps.flatMap((s) => s.notes ?? []),
  ];
  return (
    <nav className="chart" aria-label="Patient chart">
      <section className="chart-id">
        <div className="portrait" role="img" aria-label="Patient portrait placeholder (CLIN-N1-001 pending)">
          <span aria-hidden="true">A</span>
        </div>
        <div>
          <h2>{p.patient.displayName}</h2>
          <p>
            {p.patient.ageYears}-year-old {p.patient.sex.toLowerCase()}
          </p>
          <p className="muted">{p.patient.occupation}</p>
        </div>
      </section>
      <p className="portrait-note">Portrait pending (synthetic asset CLIN-N1-001).</p>

      <section className="chart-section">
        <h3>Presentation</h3>
        <dl className="kv">
          <dt>Concern</dt>
          <dd>{p.history.chiefConcern}</dd>
          <dt>Duration</dt>
          <dd>{p.history.duration}</dd>
          <dt>Walking</dt>
          <dd>{p.history.walkingTolerance}</dd>
          <dt>Height / weight</dt>
          <dd className="tabular">
            {p.patient.heightCm} cm / {p.patient.weightKg} kg (BMI {p.patient.bmi} kg/m²)
          </dd>
        </dl>
        <details>
          <summary>Examination and baseline measures</summary>
          <table className="mini-table">
            <tbody>
              {p.examination.map((e) => (
                <tr key={e.domain}>
                  <th scope="row">{e.domain}</th>
                  <td>{e.finding}</td>
                </tr>
              ))}
              {p.baselineMeasures.map((m) => (
                <tr key={m.label}>
                  <th scope="row">{m.label}</th>
                  <td>{m.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <section className="chart-section">
        <h3>Results</h3>
        {results.length === 0 ? <p className="muted">No investigations released yet.</p> : null}
        <ul className="result-list">
          {results.map(({ def, r }) => (
            <li key={def.id}>
              <button type="button" className="result-link" onClick={() => setUi({ recordStudy: def.id })}>
                <span>{def.title}</span>
                <StatusChip tone={r.status === 'MODEL_UPDATED' ? 'resolved' : 'pending'}>{r.status === 'MODEL_UPDATED' ? 'Integrated' : 'Open'}</StatusChip>
              </button>
            </li>
          ))}
        </ul>
        {state.unsupportedRequests.length ? (
          <p className="muted">
            {state.unsupportedRequests.length} request{state.unsupportedRequests.length > 1 ? 's' : ''} outside the catalogue recorded.
          </p>
        ) : null}
      </section>

      {state.teamAction || notes.length ? (
        <section className="chart-section">
          <h3>Clinical documents</h3>
          {state.teamAction ? (
            <details>
              <summary>{state.teamAction.operative_report.title}</summary>
              {state.teamAction.operative_report.sections.map((s) => (
                <p key={s.heading}>
                  <strong>{s.heading}.</strong> {s.lines.join(' ')}
                </p>
              ))}
            </details>
          ) : null}
          {notes.length ? (
            <details>
              <summary>Nursing and progress notes ({notes.length})</summary>
              <ul className="notes">
                {notes.map((n, i) => (
                  <li key={i}>
                    <span className="note-time">{n.time}</span> {n.author}: {n.text}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}

      <section className="chart-section">
        <h3>Experienced timeline</h3>
        <ol className="timeline">
          {state.timeline.map((t) => (
            <li key={t.sequence} className={`tl-${t.kind}`}>
              <span className="tl-time">{t.sim_label}</span>
              <span>{t.text}</span>
            </li>
          ))}
        </ol>
      </section>
    </nav>
  );
}

export function TutorPanel() {
  const state = useSession();
  const controller = useController();
  const tutor = useTutor();
  const [ui, setUi] = useUi();
  const [reply, setReply] = React.useState('');
  const listRef = React.useRef<HTMLDivElement>(null);
  const ctx = buildTutorContext(state, { kind: 'session_started' });
  const options = tutor.supportOptions(ctx);
  const lastTutor = [...state.tutor.messages].reverse().find((m) => m.role === 'tutor');
  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [state.tutor.messages.length]);

  if (ui.tutorCollapsed) {
    return (
      <aside className="tutor collapsed" aria-label="Tutor (collapsed)">
        <button type="button" className="tutor-expand" onClick={() => setUi({ tutorCollapsed: false })} aria-label="Expand tutor panel">
          Tutor
        </button>
      </aside>
    );
  }
  const readOnly = controller.readOnly || state.stage === 'START';
  return (
    <aside className="tutor" aria-label="Tutor">
      <div className="tutor-head">
        <div>
          <h2>Tutor</h2>
          <span className="muted small">{tutor.label}</span>
        </div>
        <button type="button" className="btn-secondary btn-small collapse-btn" onClick={() => setUi({ tutorCollapsed: true, tutorOpen: false })} aria-label="Collapse tutor panel">
          Collapse
        </button>
      </div>
      <div className="tutor-pref">
        <label htmlFor="tutor-pref">Prompts</label>
        <select
          id="tutor-pref"
          value={state.tutor.preference}
          disabled={readOnly}
          onChange={(e) => setTutorPreference(controller, e.target.value as 'auto' | 'on_request')}
        >
          <option value="auto">Occasional prompts and on request</option>
          <option value="on_request">Only when I ask</option>
        </select>
      </div>
      <div className="tutor-messages" ref={listRef} aria-live="polite">
        {state.tutor.messages.length === 0 ? <p className="muted">The tutor is quiet. Ask for a prompt when a question would help.</p> : null}
        {state.tutor.messages
          .filter((m) => m.role !== 'system')
          .map((m) => (
            <div key={m.sequence} className={`tutor-msg ${m.role} mode-${m.mode}`}>
              {m.role === 'tutor' && m.mode !== 'orientation' ? <span className="tutor-mode">{m.mode === 'boundary' ? 'Boundary' : m.mode}</span> : null}
              <p>{m.text}</p>
            </div>
          ))}
      </div>
      {!readOnly && lastTutor && lastTutor.mode !== 'orientation' ? (
        <div className="tutor-reply">
          <label htmlFor="tutor-reply">Reply (optional, saved to your record)</label>
          <textarea id="tutor-reply" rows={2} value={reply} onChange={(e) => setReply(e.target.value)} />
          <button
            type="button"
            className="btn-secondary btn-small"
            disabled={!reply.trim()}
            onClick={() => {
              respondToTutor(controller, reply, String(lastTutor.sequence));
              setReply('');
            }}
          >
            Save reply
          </button>
        </div>
      ) : null}
      {!readOnly && options.length ? (
        <div className="tutor-ask">
          <p className="field-label">Ask for a prompt</p>
          <div className="chip-row">
            {options.map((o) => (
              <button key={o.mode} type="button" className="btn-chip" onClick={() => requestSupport(controller, tutor, o.mode)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <p className="tutor-foot">The tutor uses released information only. It cannot order tests, interpret unreleased results, or change the patient’s course.</p>
    </aside>
  );
}

export function RecordDialog() {
  const [ui, setUi] = useUi();
  const state = useSession();
  if (!ui.recordStudy) return null;
  const def = getInvestigationDef(ui.recordStudy);
  const close = () => setUi({ recordStudy: null });
  const canWork = def && state.stage === (def.context === 'preop' ? 'N2.workup' : def.context === 'postop' ? 'N4.postop_workup' : 'N5.followup');
  return (
    <Dialog title={def?.title ?? 'Record'} onClose={close} wide>
      {canWork ? (
        <p className="muted">
          This study is part of your current work-up.{' '}
          <button
            type="button"
            className="btn-link"
            onClick={() => {
              setUi({ recordStudy: null, activeStudy: ui.recordStudy });
            }}
          >
            Open it in the workspace
          </button>
        </p>
      ) : null}
      <StudyPanel investigationId={ui.recordStudy} readOnly />
    </Dialog>
  );
}

export function HelpDialog() {
  const [, setUi] = useUi();
  const controller = useController();
  const [failArmed, setFailArmed] = React.useState(controller.repo.failNextWrites > 0);
  return (
    <Dialog title="Help" onClose={() => setUi({ dialog: null })} wide>
      <h3>About this encounter</h3>
      <p>
        This is a fictional, fully synthetic patient used for formative education. It is not real patient data and not clinical decision support. There is no grade or
        score. Information appears only when you request it and commit your reasoning first.
      </p>
      <h3>How investigations work</h3>
      <ol>
        <li>Choose an investigation and write why you want it now.</li>
        <li>Separately, write what you expect it to clarify or demonstrate.</li>
        <li>For images, commit your own interpretation before the report opens.</li>
        <li>Record how the result affects your working model.</li>
      </ol>
      <h3>Saving</h3>
      <p>
        Your session is saved in this browser only. Browser data can be cleared, so use Export to keep a reviewable JSON record. Committed entries are not edited; changes are
        saved as new linked versions.
      </p>
      <h3>Tutor</h3>
      <p>
        Scripted tutor prototype. It asks short questions from a fixed script and is often silent. It does not understand free text, does not assess your answers, and cannot
        see information you have not released.
      </p>
      <h3>Images</h3>
      <p>
        Validated synthetic images are not yet available. Image studies show labelled technical placeholders or use a text-only route. Neither is a test of image-reading skill.
      </p>
      <h3>Image viewer keys</h3>
      <p>Arrow keys or mouse wheel: change frame. Plus and minus or Ctrl + wheel: zoom. Drag: pan. 0: reset. F: full screen.</p>
      <h3>Versions</h3>
      <dl className="kv small">
        {Object.entries(controller.state.versions ?? CURRENT_VERSIONS).map(([k, v]) => (
          <React.Fragment key={k}>
            <dt>{k.replace(/_/g, ' ')}</dt>
            <dd>{v}</dd>
          </React.Fragment>
        ))}
      </dl>
      <details className="dev-tools">
        <summary>Developer review tools</summary>
        <p className="muted">For verifying integrity rules. These do not change patient content.</p>
        <button
          type="button"
          className="btn-secondary btn-small"
          onClick={() => {
            controller.repo.failNextWrites = 1;
            setFailArmed(true);
          }}
        >
          Simulate a storage failure on the next save
        </button>
        {failArmed ? <p className="muted">Armed: the next commitment will fail to save and nothing will be released.</p> : null}
      </details>
    </Dialog>
  );
}

export function exportFileName(sessionId: string | null): string {
  return `EDT-LUM-DUMMY-001__${sessionId ?? 'session'}__${new Date().toISOString().slice(0, 10)}.json`;
}

export function ExportDialog() {
  const [, setUi] = useUi();
  const controller = useController();
  const [copied, setCopied] = React.useState<string | null>(null);
  const exp = React.useMemo(() => buildExport(controller.log), [controller.log]);
  const text = React.useMemo(() => JSON.stringify(exp, null, 2), [exp]);
  const taRef = React.useRef<HTMLTextAreaElement>(null);
  const download = () => {
    void saveTextFile(exportFileName(exp.session.session_id), text).then(setCopied);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied('Session JSON copied to the clipboard.');
    } catch {
      taRef.current?.select();
      setCopied('Copy was blocked. The JSON is selected: press Ctrl+C or Cmd+C.');
    }
  };
  return (
    <Dialog title="Export session" onClose={() => setUi({ dialog: null })} wide>
      <p>
        The export contains your experienced trace only: {exp.integrity.event_count} ordered events, released results, your reasoning versions, and tutor exchanges. It does not
        contain unreleased case content.
      </p>
      <dl className="kv small">
        <dt>Session</dt>
        <dd>{exp.session.session_id}</dd>
        <dt>Status</dt>
        <dd>{exp.session.completion_status.replace(/_/g, ' ')}</dd>
        <dt>Imaging route</dt>
        <dd>{exp.session.imaging_route === 'text_only' ? 'Text-only demonstration' : 'Technical placeholders with interpretation gate'}</dd>
        <dt>File name</dt>
        <dd>{exportFileName(exp.session.session_id)}</dd>
      </dl>
      <div className="row">
        <button type="button" className="btn-primary" onClick={download}>
          Download session JSON
        </button>
        <button type="button" className="btn-secondary" onClick={() => void copy()}>
          Copy JSON
        </button>
      </div>
      {copied ? (
        <p className="muted" role="status">
          {copied}
        </p>
      ) : null}
      <label htmlFor="export-json" className="field-label">
        Session JSON
      </label>
      <textarea id="export-json" ref={taRef} className="json-view" readOnly rows={12} value={text} />
    </Dialog>
  );
}
