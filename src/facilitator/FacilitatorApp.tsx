// Facilitator page: create and disable personal links, follow progress, export session records.
// It shows participant codes and neutral labels only; no names are stored by this system.
import * as React from 'react';
import { APP_NAME, TRAINING_LEVELS, stageLabel } from '../case/publicCatalogue.ts';
import type { Stage } from '../engine/types.ts';
import type { ApiRequest, ApiResponse, CreatedLink, FacilitatorOverview, LoadedSession } from '../server/api.ts';
import { buildExport } from '../session/export.ts';
import { saveTextFile } from '../ui/fileSave.ts';

export type FacTransport = (req: ApiRequest) => Promise<ApiResponse>;

const KEY_STORE = 'edt-facilitator-key';

function readKey(): string {
  try {
    return sessionStorage.getItem(KEY_STORE) ?? '';
  } catch {
    return '';
  }
}
function writeKey(k: string | null) {
  try {
    if (k) sessionStorage.setItem(KEY_STORE, k);
    else sessionStorage.removeItem(KEY_STORE);
  } catch {
    /* session-only convenience */
  }
}

const levelLabel = (id: string | null) => TRAINING_LEVELS.find((t) => t.id === id)?.label ?? '—';
const when = (iso: string) => (iso ? new Date(iso).toLocaleString() : '');
const statusLabel = (s: string, stage: string) =>
  s === 'completed' ? 'Completed' : s === 'paused_for_review' ? 'Paused for expert review' : stageLabel(stage as Stage);

export function FacilitatorApp(props: { transport: FacTransport; participantBaseUrl: string }) {
  const [key, setKey] = React.useState(readKey);
  const [keyInput, setKeyInput] = React.useState('');
  const [data, setData] = React.useState<FacilitatorOverview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [label, setLabel] = React.useState('');
  const [created, setCreated] = React.useState<CreatedLink | null>(null);
  const [busy, setBusy] = React.useState(false);

  const call = React.useCallback(
    async <T,>(req: ApiRequest): Promise<T | null> => {
      try {
        const r = await props.transport(req);
        if (!r.ok) {
          if (r.code === 'KEY_INVALID') {
            writeKey(null);
            setKey('');
            setData(null);
          }
          setError(r.message);
          return null;
        }
        setError(null);
        return r.data as T;
      } catch (err) {
        setError((err as Error).message);
        return null;
      }
    },
    [props.transport],
  );

  const refresh = React.useCallback(
    async (k = key) => {
      if (!k) return;
      const d = await call<FacilitatorOverview>({ action: 'fac_overview', key: k });
      if (d) setData(d);
    },
    [call, key],
  );

  React.useEffect(() => {
    if (key) void refresh(key);
  }, [key, refresh]);

  React.useEffect(() => {
    document.title = 'Facilitator · Educational Digital Twin';
  }, []);

  const signIn = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    const k = keyInput.trim();
    if (!k) return;
    const d = await call<FacilitatorOverview>({ action: 'fac_overview', key: k });
    if (d) {
      writeKey(k);
      setKey(k);
      setData(d);
      setKeyInput('');
    }
  };

  const createLink = async () => {
    setBusy(true);
    const r = await call<CreatedLink>({ action: 'fac_create_link', key, label });
    setBusy(false);
    if (r) {
      setCreated(r);
      setLabel('');
      void refresh();
    }
  };

  const linkFor = (token: string) => `${props.participantBaseUrl}#t=${token}`;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage('Link copied to the clipboard.');
    } catch {
      setMessage('Copy was blocked. Select the link and copy it manually.');
    }
  };

  const toggle = async (participantId: string, disabled: boolean) => {
    if (await call({ action: 'fac_set_disabled', key, participant_id: participantId, disabled })) void refresh();
  };

  const exportSession = async (sessionId: string) => {
    const r = await call<LoadedSession>({ action: 'fac_session_events', key, session_id: sessionId });
    if (!r) return;
    const exp = buildExport(r.events);
    setMessage(await saveTextFile(`EDT-LUM-DUMMY-001__${r.meta.participant_code}__${sessionId}.json`, JSON.stringify(exp, null, 2)));
  };

  const exportAll = async () => {
    if (!data) return;
    setBusy(true);
    const sessions = [];
    for (const s of data.sessions) {
      const r = await call<LoadedSession>({ action: 'fac_session_events', key, session_id: s.session_id });
      if (!r) {
        setBusy(false);
        return;
      }
      sessions.push({ participant_code: s.participant_code, training_level: s.training_level, export: buildExport(r.events) });
    }
    setBusy(false);
    const bundle = { bundle_kind: 'edt-facilitator-export', exported_at_utc: new Date().toISOString(), session_count: sessions.length, sessions };
    setMessage(await saveTextFile(`EDT-LUM-DUMMY-001__all-sessions__${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(bundle, null, 2)));
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="app-name">{APP_NAME}</span>
          <span className="case-name">Facilitator</span>
        </div>
        {key ? (
          <div className="topbar-actions">
            <button type="button" className="topbar-btn" onClick={() => void refresh()}>
              Refresh
            </button>
            <button
              type="button"
              className="topbar-btn"
              onClick={() => {
                writeKey(null);
                setKey('');
                setData(null);
                setCreated(null);
              }}
            >
              Sign out
            </button>
          </div>
        ) : null}
      </header>
      <main className="start" id="main">
        <div className="start-inner">
          {!key ? (
            <section className="start-card" aria-labelledby="fac-signin">
              <h1 id="fac-signin">Facilitator access</h1>
              <p>Enter your facilitator key. It is kept only in this browser tab and removed when you sign out or close the tab.</p>
              <form onSubmit={(e: { preventDefault(): void }) => void signIn(e)}>
                <div className="field">
                  <label className="field-label" htmlFor="fac-key">
                    Facilitator key
                  </label>
                  <input id="fac-key" type="password" autoComplete="off" value={keyInput} onChange={(e: { target: HTMLInputElement }) => setKeyInput(e.target.value)} />
                </div>
                {error ? (
                  <p className="error-text" role="alert">
                    {error}
                  </p>
                ) : null}
                <button type="submit" className="btn-primary">
                  Open facilitator view
                </button>
              </form>
            </section>
          ) : (
            <>
              {error ? (
                <section className="start-card boundary" role="alert">
                  <p>{error}</p>
                </section>
              ) : null}
              {message ? (
                <p className="muted" role="status">
                  {message}
                </p>
              ) : null}

              <section className="start-card" aria-labelledby="fac-new">
                <h2 id="fac-new">Create a personal link</h2>
                <p className="field-helper">
                  Each fellow receives one link. Use a neutral label such as "Fellow 01" and keep any name mapping outside this system. The link is shown only once.
                </p>
                <div className="row">
                  <label className="sr-only" htmlFor="fac-label">
                    Label
                  </label>
                  <input id="fac-label" type="text" maxLength={80} placeholder="Fellow 01" value={label} onChange={(e: { target: HTMLInputElement }) => setLabel(e.target.value)} autoComplete="off" />
                  <button type="button" className="btn-primary" disabled={busy} onClick={() => void createLink()}>
                    Create link
                  </button>
                </div>
                {created ? (
                  <div className="created-link" role="status">
                    <p>
                      <strong>{created.participant.label || 'New link'}</strong> · participant code <span className="code-chip">{created.participant.participant_code}</span>
                    </p>
                    <input className="link-field" type="text" readOnly value={linkFor(created.token)} onFocus={(e: { target: HTMLInputElement }) => e.target.select()} aria-label="Personal link" />
                    <div className="row">
                      <button type="button" className="btn-secondary btn-small" onClick={() => void copy(linkFor(created.token))}>
                        Copy link
                      </button>
                      <button type="button" className="btn-link" onClick={() => setCreated(null)}>
                        I have saved it. Hide the link
                      </button>
                    </div>
                    <p className="muted small">This link cannot be shown again. If it is lost, disable it and create a new one.</p>
                  </div>
                ) : null}
              </section>

              <section className="start-card" aria-labelledby="fac-links">
                <h2 id="fac-links">Personal links ({data?.participants.length ?? 0})</h2>
                {data && data.participants.length ? (
                  <table className="sessions">
                    <thead>
                      <tr>
                        <th scope="col">Code</th>
                        <th scope="col">Label</th>
                        <th scope="col">Created</th>
                        <th scope="col">Encounters</th>
                        <th scope="col">Access</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.participants.map((p) => {
                        const n = data.sessions.filter((s) => s.participant_id === p.participant_id).length;
                        return (
                          <tr key={p.participant_id}>
                            <td>
                              <span className="code-chip">{p.participant_code}</span>
                            </td>
                            <td>{p.label}</td>
                            <td className="tabular">{when(p.created_at)}</td>
                            <td>{n}</td>
                            <td>
                              <button type="button" className="btn-secondary btn-small" onClick={() => void toggle(p.participant_id, !p.disabled)}>
                                {p.disabled ? 'Enable link' : 'Disable link'}
                              </button>
                              {p.disabled ? <span className="muted small"> Disabled</span> : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <p className="muted">No personal links yet.</p>
                )}
              </section>

              <section className="start-card" aria-labelledby="fac-sessions">
                <h2 id="fac-sessions">Encounters ({data?.sessions.length ?? 0})</h2>
                {data && data.sessions.length ? (
                  <>
                    <table className="sessions">
                      <thead>
                        <tr>
                          <th scope="col">Code</th>
                          <th scope="col">Training level</th>
                          <th scope="col">Progress</th>
                          <th scope="col">Events</th>
                          <th scope="col">Started</th>
                          <th scope="col">Last activity</th>
                          <th scope="col">
                            <span className="sr-only">Export</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.sessions.map((s) => (
                          <tr key={s.session_id}>
                            <td>
                              <span className="code-chip">{s.participant_code}</span>
                            </td>
                            <td>{levelLabel(s.training_level)}</td>
                            <td>{statusLabel(s.status, s.stage)}</td>
                            <td className="tabular">{s.event_count}</td>
                            <td className="tabular">{when(s.started_at_utc)}</td>
                            <td className="tabular">{when(s.updated_at_utc)}</td>
                            <td>
                              <button type="button" className="btn-secondary btn-small" onClick={() => void exportSession(s.session_id)}>
                                Download JSON
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="row">
                      <button type="button" className="btn-primary" disabled={busy} onClick={() => void exportAll()}>
                        Download all encounters
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="muted">No encounters yet.</p>
                )}
              </section>
              <p className="muted small">
                Exports contain each participant's experienced trace only: released results, committed reasoning versions and tutor exchanges. Data withdrawal requests are
                handled in the database by the study coordinator.
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
