// Pilot entry point: a participant opens the encounter with a personal link (#t=<token>).
// The case engine and hidden content run on the server; this bundle contains neither.
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { APP_NAME, CASE_TITLE } from './case/publicCatalogue.ts';
import { REMOTE_API_URL, apiHeaders } from './config/remote.ts';
import { RemoteGateway, browserDraftStore, fetchTransport } from './session/remoteGateway.ts';
import { ScriptedTutor } from './tutor/scriptedTutor.ts';
import { SessionProvider } from './ui/session.tsx';
import { App } from './ui/App.tsx';

function readToken(): string | null {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);
  const t = hash.get('t') ?? query.get('t');
  return t && /^[A-Za-z0-9_-]{20,200}$/.test(t) ? t : null;
}

function Notice(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="app-name">{APP_NAME}</span>
          <span className="case-name">{CASE_TITLE}</span>
        </div>
      </header>
      <main className="start" id="main">
        <div className="start-inner">
          <section className="start-card" role="alert">
            <h1>{props.title}</h1>
            {props.children}
          </section>
        </div>
      </main>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
const token = readToken();

if (!token) {
  root.render(
    <Notice title="Personal link required">
      <p>This encounter opens only from the personal link you received from the course facilitator. Please open that link again.</p>
      <p className="muted">If you no longer have it, ask the facilitator for your link. Do not share your link with others.</p>
    </Notice>,
  );
} else {
  root.render(
    <Notice title="Opening your encounter">
      <p role="status">Connecting to the study server…</p>
    </Notice>,
  );
  const gateway = new RemoteGateway(fetchTransport(REMOTE_API_URL, apiHeaders()), token, browserDraftStore());
  (window as unknown as { __edt?: unknown }).__edt = { gateway };
  void gateway.init().then((error) => {
    if (error) {
      root.render(
        <Notice title="This link cannot be opened">
          <p>{error}</p>
        </Notice>,
      );
      return;
    }
    root.render(
      <React.StrictMode>
        <SessionProvider controller={gateway} tutor={new ScriptedTutor()}>
          <App restoreError={null} />
        </SessionProvider>
      </React.StrictMode>,
    );
  });
}
