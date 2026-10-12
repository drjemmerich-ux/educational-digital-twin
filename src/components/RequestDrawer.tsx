// S03: investigation request drawer with two separate commitments.
// Data stay locked until both fields are committed and the transaction is saved.
import * as React from 'react';
import * as C from '../engine/commands.ts';
import { REQUEST_HELPERS, getInvestigationDef } from '../case/publicCatalogue.ts';
import { useDraft, useRun, useUi } from '../ui/session.tsx';
import { ConfidenceInput, ErrorNote, TextField } from './forms.tsx';

export function RequestDrawer() {
  const [ui, setUi] = useUi();
  if (!ui.drawerMode) return null;
  const key = ui.drawerMode === 'unsupported' ? 'unsupported' : `${ui.drawerMode}:${ui.drawerStudy}`;
  return <DrawerBody key={key} mode={ui.drawerMode} studyId={ui.drawerStudy} onClose={() => setUi({ drawerMode: null, drawerStudy: null })} onReleased={(id) => setUi({ drawerMode: null, drawerStudy: null, activeStudy: id })} />;
}

function DrawerBody(props: { mode: 'request' | 'repeat' | 'unsupported'; studyId: string | null; onClose: () => void; onReleased: (id: string) => void }) {
  const run = useRun();
  const def = props.studyId ? getInvestigationDef(props.studyId) : undefined;
  const k = `req:${props.mode}:${props.studyId ?? 'other'}`;
  const [name, setName, clearName] = useDraft(`${k}:name`, '');
  const [rationale, setRationale, clearR] = useDraft(`${k}:rationale`, '');
  const [expectation, setExpectation, clearE] = useDraft(`${k}:expectation`, '');
  const [conf, setConf, clearC] = useDraft<number | null>(`${k}:conf`, null);
  const [error, setError] = React.useState<string | null>(null);
  const [boundary, setBoundary] = React.useState<string | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);
  const opener = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    opener.current = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input, textarea')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose();
    };
    const node = ref.current;
    node?.addEventListener('keydown', onKey);
    return () => {
      node?.removeEventListener('keydown', onKey);
      opener.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const title = props.mode === 'unsupported' ? 'Request another investigation' : props.mode === 'repeat' ? `Repeat request: ${def?.title}` : def?.title;
  const clearAll = () => {
    clearName();
    clearR();
    clearE();
    clearC();
  };

  const commit = () => {
    setError(null);
    if (props.mode === 'request' && def) {
      const res = run(C.commitRequest, { investigation_id: def.id, rationale, expectation, confidence: conf });
      if (!res.ok) return setError(res.message);
      clearAll();
      props.onReleased(def.id);
    } else if (props.mode === 'repeat' && def) {
      const res = run(C.requestRepeat, { investigation_id: def.id, rationale, expectation });
      if (!res.ok) return setError(res.message);
      clearAll();
      const b = res.events.find((e) => e.event_type === 'boundary_response');
      setBoundary(b && b.event_type === 'boundary_response' ? b.payload.message : 'Recorded.');
    } else {
      const res = run(C.requestUnsupported, { name, rationale, expectation });
      if (!res.ok) return setError(res.message);
      clearAll();
      const b = res.events.find((e) => e.event_type === 'boundary_response');
      setBoundary(b && b.event_type === 'boundary_response' ? b.payload.message : 'Recorded.');
    }
  };

  return (
    <div className="drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}>
      <div className="drawer" ref={ref} role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <div className="drawer-head">
          <p className="eyebrow">{props.mode === 'request' ? 'Investigation request' : props.mode === 'repeat' ? 'Repeat investigation' : 'Outside the catalogue'}</p>
          <h2 id="drawer-title">{title}</h2>
          {def && props.mode === 'request' ? <p className="muted">{def.description}</p> : null}
        </div>
        {boundary ? (
          <div className="drawer-body">
            <p className="boundary-note" role="status">
              {boundary}
            </p>
            <button type="button" className="btn-primary" onClick={props.onClose}>
              Return to the work-up
            </button>
          </div>
        ) : (
          <div className="drawer-body">
            {props.mode === 'unsupported' ? (
              <TextField id="drawer-name" label="Investigation you want" helper="Name the test or record. If it is not in this case, your reasoning is still saved." value={name} onChange={setName} rows={1} required />
            ) : null}
            <TextField id="drawer-rationale" label={REQUEST_HELPERS.rationale.label} helper={REQUEST_HELPERS.rationale.helper} value={rationale} onChange={setRationale} rows={3} required />
            <TextField
              id="drawer-expectation"
              label={REQUEST_HELPERS.expectation.label}
              helper={REQUEST_HELPERS.expectation.helper}
              value={expectation}
              onChange={setExpectation}
              rows={3}
              required
            />
            {props.mode === 'request' ? <ConfidenceInput id="drawer-conf" value={conf} onChange={setConf} label="Confidence in your expectation" /> : null}
            <p className="field-helper">Both answers are saved as separate entries before any data are released. Committed entries cannot be edited.</p>
            <ErrorNote message={error} />
            <div className="row">
              <button type="button" className="btn-primary" onClick={commit}>
                {props.mode === 'request' ? 'Commit request and reveal' : 'Commit request'}
              </button>
              <button type="button" className="btn-secondary" onClick={props.onClose}>
                Cancel
              </button>
            </div>
            {error && /could not be saved/.test(error) ? (
              <p className="muted">Your text is still here. Select Commit again to retry.</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
