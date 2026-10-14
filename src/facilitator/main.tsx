// Facilitator entry point (facilitator.html). Talks to the server with a facilitator key.
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { REMOTE_API_URL, apiHeaders } from '../config/remote.ts';
import { fetchTransport } from '../session/remoteGateway.ts';
import { FacilitatorApp } from './FacilitatorApp.tsx';

const base = new URL('./', window.location.href).href;
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FacilitatorApp transport={fetchTransport(REMOTE_API_URL, apiHeaders())} participantBaseUrl={base} />
  </React.StrictMode>,
);
