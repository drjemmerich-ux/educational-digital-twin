// S00: start encounter. No pathology, complication, or branch is named here.
import * as React from 'react';
import { APP_NAME, CASE_TITLE, CONSENT_STATEMENTS, CONSENT_VERSION, PARTICIPANT_INFORMATION, TRAINING_LEVELS, stageLabel } from '../case/publicCatalogue.ts';
import type { ImagingRoute } from '../engine/types.ts';
import { PersistenceError, type SessionMeta } from '../session/repository.ts';
import { useController, useRun } from '../ui/session.tsx';
import { ErrorNote, RadioGroup } from '../components/forms.tsx';

export function StartScreen(props: { restoreError: string | null; onRestoreErrorCleared: () => void }) {
  const controller = useController();
  const run = useRun();
  const [code, setCode] = React.useState('');
  const [route, setRoute] = React.useState<ImagingRoute | null>('image_gate_placeholder');
  const [error, setError] = React.useState<string | null>(null);
  const [sessions, setSessions] = React.useState<SessionMeta[]>([]);
  const [lockPrompt, setLockPrompt] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const remote = controller.capabilities.storage === 'server';

  const refresh = React.useCallback(() => {
    controller.listSessions().then(setSessions, (err: unknown) => setError(`Your encounters could not be listed. ${(err as Error).message ?? ''}`.trim()));
  }, [controller]);
  React.useEffect(() => refresh(), [refresh]);
  const unfinished = remote ? sessions.find((s) => s.session_kind === 'participant' && s.status !== 'completed') : undefined;

  const [step, setStep] = React.useState<'landing' | 'consent'>('landing');
  const [agreed, setAgreed] = React.useState<Record<string, boolean>>({});
  const [level, setLevel] = React.useState<string | null>(null);
  const [randomCode] = React.useState(() => {
    if (controller.assignedParticipantCode) return controller.assignedParticipantCode;
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = new Uint8Array(6);
    globalThis.crypto?.getRandomValues?.(bytes);
    return 'P-' + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  });

  const proceed = () => {
    if (!route) return setError('Choose an imaging route.');
    setError(null);
    setStep('consent');
  };

  const participantCode = controller.assignedParticipantCode ?? (code.trim() || randomCode);

  const start = async () => {
    if (!route) return setError('Choose an imaging route.');
    if (busy) return;
    setBusy(true);
    const res = await run('startSession', {
      participant_code: participantCode,
      imaging_route: route,
      session_kind: 'participant',
      consent_statement_ids: CONSENT_STATEMENTS.filter((c) => agreed[c.id]).map((c) => c.id),
      training_level: level,
    });
    setBusy(false);
    if (!res.ok) setError(res.message);
  };

  if (step === 'consent') {
    const allAgreed = CONSENT_STATEMENTS.every((c) => agreed[c.id]);
    return (
      <main className="start" id="main">
        <div className="start-inner">
          <p className="eyebrow">Before you start</p>
          <h1>Participant information and consent</h1>
          <p className="lede">Please read this information. The session starts only after you confirm each statement below.</p>
          <section className="start-card" aria-labelledby="info-title">
            <h2 id="info-title">Information for participants</h2>
            <div className="consent-info">
              {PARTICIPANT_INFORMATION.map((i) => (
                <div key={i.heading}>
                  <h3>{i.heading}</h3>
                  <p>{i.text}</p>
                </div>
              ))}
            </div>
            <p className="muted small">Information sheet version: {CONSENT_VERSION}. Bracketed items are completed before the pilot opens.</p>
          </section>
          <section className="start-card" aria-labelledby="consent-title">
            <h2 id="consent-title">Consent</h2>
            <p>
              {controller.assignedParticipantCode ? 'Your participant code is' : 'Your random code for this session is'} <span className="code-chip">{participantCode}</span>. Keep it if you may want your data withdrawn later.
            </p>
            <ul className="consent-list">
              {CONSENT_STATEMENTS.map((c) => (
                <li key={c.id}>
                  <label>
                    <input type="checkbox" checked={!!agreed[c.id]} onChange={(e) => setAgreed({ ...agreed, [c.id]: e.target.checked })} />
                    <span>{c.text}</span>
                  </label>
                </li>
              ))}
            </ul>
            <RadioGroup<string>
              name="training-level"
              legend="What is your current training level?"
              required
              value={level}
              onChange={setLevel}
              options={TRAINING_LEVELS.map((t) => ({ id: t.id, label: t.label }))}
            />
            <ErrorNote message={error} />
            <div className="row">
              <button type="button" className="btn-primary btn-large" disabled={!allAgreed || !level || busy} onClick={() => void start()}>
                I agree to take part. Start the session
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setStep('landing');
                  setAgreed({});
                  setLevel(null);
                }}
              >
                I do not wish to take part
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const resume = async (id: string, force = false) => {
    try {
      const r = await controller.open(id, force);
      if (r.lockedElsewhere) setLockPrompt(id);
    } catch (err) {
      setError(err instanceof PersistenceError ? `${err.message} The record has been left untouched.` : (err as Error).message ?? String(err));
    }
  };

  const openDemo = async () => {
    try {
      await controller.startDemo?.();
    } catch (err) {
      setError(`The demonstration session could not be stored: ${(err as Error).message}`);
    }
  };

  return (
    <main className="start" id="main">
      <div className="start-inner">
        <p className="eyebrow">{APP_NAME}</p>
        <h1>{CASE_TITLE}</h1>
        <p className="lede">
          You will manage a patient over time: review the presentation, decide which information you need, interpret it, and commit to management decisions. A scripted
          tutor may occasionally ask a question.
        </p>
        <div className="start-grid">
          <section className="start-card" aria-labelledby="before-title">
            <h2 id="before-title">Before you begin</h2>
            <ul className="plain">
              <li>
                <strong>Fictional and synthetic.</strong> The patient, images and outcomes are invented for education. Nothing here is clinical advice. This is a
                demonstration to evaluate the potential of this educational model.
              </li>
              <li>
                <strong>Formative only.</strong> There is no grade, score or pass mark. Several strategies can be defensible.
              </li>
              <li>
                <strong>Reasoning first.</strong> Before a study is released you record why you want it and what you expect. You interpret images before the report opens.
              </li>
              <li>
                <strong>Information arrives progressively.</strong> Only what has happened is shown.
              </li>
              {remote ? (
                <li>
                  <strong>Saved on the study server.</strong> You can close the page and continue later with your personal link. Keep the link private.
                </li>
              ) : (
                <li>
                  <strong>Saved in this browser.</strong> Browser data can be cleared; use Export to keep a JSON record.
                </li>
              )}
              <li>
                <strong>Estimated time 25 to 35 minutes.</strong> This is a planning estimate and has not been validated.
              </li>
            </ul>
          </section>
          {unfinished ? (
            <section className="start-card" aria-labelledby="new-title">
              <h2 id="new-title">Continue your encounter</h2>
              <p>You have an encounter in progress. It continues exactly where you left it.</p>
              <button type="button" className="btn-primary btn-large" onClick={() => void resume(unfinished.session_id)}>
                Continue encounter
              </button>
              <ErrorNote message={error} />
            </section>
          ) : (
          <section className="start-card" aria-labelledby="new-title">
            <h2 id="new-title">New encounter</h2>
            {controller.assignedParticipantCode ? (
              <p>
                Participant code from your personal link: <span className="code-chip">{controller.assignedParticipantCode}</span>
              </p>
            ) : (
              <div className="field">
                <label className="field-label" htmlFor="participant-code">
                  Participant code <span className="optional">(optional, pseudonymous)</span>
                </label>
                <p className="field-helper">Do not enter your name or any identifiable information.</p>
                <input id="participant-code" type="text" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" />
              </div>
            )}
            <RadioGroup<ImagingRoute>
              name="route"
              legend="Imaging route"
              value={route}
              onChange={setRoute}
              options={[
                {
                  id: 'image_gate_placeholder',
                  label: 'Image viewer with technical placeholders',
                  hint: 'Full interpretation-before-report workflow. Placeholder frames contain no diagnostic content.',
                },
                {
                  id: 'text_only',
                  label: 'Text-only demonstration',
                  hint: 'Authored findings are released as text after the request gate. Image reading is not assessed.',
                },
              ]}
            />
            <ErrorNote message={error} />
            <button type="button" className="btn-primary btn-large" onClick={proceed}>
              Start patient encounter
            </button>
          </section>
          )}
        </div>

        {props.restoreError ? (
          <section className="start-card boundary" role="alert">
            <h2>A saved encounter could not be restored</h2>
            <p>{props.restoreError}</p>
            <p>The stored record has not been changed. You can start a new encounter; the earlier record remains in browser storage for recovery.</p>
            <button type="button" className="btn-secondary" onClick={props.onRestoreErrorCleared}>
              Dismiss
            </button>
          </section>
        ) : null}

        {lockPrompt ? (
          <section className="start-card boundary" role="alert">
            <h2>This encounter is open in another tab</h2>
            <p>To avoid conflicting entries, continue in the other tab, or take over here. The other tab will then stop saving.</p>
            <div className="row">
              <button type="button" className="btn-primary" onClick={() => { void resume(lockPrompt, true); setLockPrompt(null); }}>
                Take over in this tab
              </button>
              <button type="button" className="btn-secondary" onClick={() => { controller.reset(); setLockPrompt(null); }}>
                Cancel
              </button>
            </div>
          </section>
        ) : null}

        {sessions.length ? (
          <section className="start-card" aria-labelledby="saved-title">
            <h2 id="saved-title">{remote ? 'Your encounters' : 'Saved encounters in this browser'}</h2>
            <table className="sessions">
              <thead>
                <tr>
                  <th scope="col">Session</th>
                  <th scope="col">Type</th>
                  <th scope="col">Stage reached</th>
                  <th scope="col">Last activity</th>
                  <th scope="col">
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.session_id}>
                    <td>
                      {s.participant_code || 'No code'}
                      <br />
                      <span className="muted small">{s.session_id.slice(0, 18)}</span>
                    </td>
                    <td>{s.session_kind === 'demonstration' ? 'Demonstration' : 'Participant'}</td>
                    <td>{s.status === 'completed' ? 'Completed' : s.status === 'paused_for_review' ? 'Paused for expert review' : stageLabel(s.stage)}</td>
                    <td className="tabular">{s.updated_at_utc ? new Date(s.updated_at_utc).toLocaleString() : ''}</td>
                    <td>
                      <button type="button" className="btn-secondary btn-small" onClick={() => void resume(s.session_id)}>
                        {s.status === 'completed' ? 'Open' : 'Resume'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" className="btn-link" onClick={refresh}>
              Refresh list
            </button>
          </section>
        ) : null}

        {controller.capabilities.demo ? (
        <section className="start-card demo" aria-labelledby="demo-title">
          <h2 id="demo-title">For reviewers: demonstration session</h2>
          <p>
            Opens a separate, clearly labelled session with prefilled sample reasoning, already advanced to the debrief along the reference course. It is not a participant
            record and does not change any other session.
          </p>
          <button type="button" className="btn-secondary" onClick={() => void openDemo()}>
            Open demonstration session
          </button>
        </section>
        ) : null}
      </div>
    </main>
  );
}
