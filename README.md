# Educational Digital Twin · Prototype 1.7

Lumbar Spine Patient Encounter — fictional case `EDT-LUM-DUMMY-001`, content bundle `edt-lum-dummy-001-handoff-1.1`.

Two builds share one engine and one interface:

- **Local build** (`dist/`): the engine runs in the browser; sessions are kept in browser storage. Used for review, the claude.ai Artifact preview and the demonstration session.
- **Pilot build** (`dist-web/`): each fellow opens a personal link; every command runs on the server engine (Supabase Edge Function `edt-engine`), which holds the hidden case content and the append-only record. A facilitator page creates and disables links and exports records. See `docs/DEPLOYMENT.md`.

A formative clinical-reasoning simulation for spine surgery education. The learner manages a synthetic patient across
five nodes (initial presentation, diagnostic work-up, management strategy, procedure and complication, outcome and
debrief). Reasoning is committed before information arrives, every committed entry is preserved, and the debrief is
descriptive with no scores.

Synthetic educational case. Not real patient data. Not clinical decision support. Images are labelled technical
placeholders until approved synthetic images exist.

## Run it

Requirements: Node 20 or later.

```bash
npm install
npm run build            # dist/index.html (single self-contained file), dist/artifact.html, dist/app.js + app.css
npm run dev              # build and serve at http://localhost:5173
npm test                 # engine, persistence, export, tutor acceptance tests (node:test)
npx playwright install chromium
npm run test:browser     # browser walkthroughs against dist/index.html
npm run reference-session  # regenerate docs/reference-path-session.json and verify it by replay
npm run typecheck        # strict TypeScript against @types/react
npm run build:web        # pilot build: dist-web/index.html + facilitator.html (fails if hidden content leaks)
npm run build:edge       # server engine bundle: supabase/functions/edt-engine/engine.js
npm run dev:pilot        # local pilot server with an in-memory store at http://localhost:5174
```

`dist/index.html` also works when opened directly from disk. Session data are saved in that browser's local storage.

## Architecture

```text
src/case/        frozen content and public catalogue
  versions.ts          version bundle carried by every session
  publicCatalogue.ts   requestable names, neutral option labels, fixed copy (no results)
  caseContent.ts       HIDDEN facts, results, consequences (read only by engine/commands.ts)
  assetManifest.ts     43 planned asset packages; frame_paths null until approved files exist
src/engine/      deterministic case engine
  types.ts             stages, event payloads, derived state
  commands.ts          guarded commands -> event drafts (the only reader of hidden content)
  reducer.ts           pure fold of events -> state (no hidden content)
  selectors.ts         learner-visible derivations, metrics, export content
  debrief.ts           deterministic descriptive statements
src/session/     persistence, export, replay
  repository.ts        SessionRepository interface (swap for a server later)
  localRepository.ts   browser localStorage, atomic append, tab lock, conflict detection
  memoryRepository.ts  tests and explicit memory-only fallback
  controller.ts        command -> stamp -> atomic persist -> state; tutor events only via appendTutorEvents
  export.ts            session JSON export and replay verification
  scriptedJourney.ts   drives real commands for the demonstration session, fixture and tests
src/tutor/       educational conversation only
  contract.ts          TutorAdapter, TutorContext (released state only), TutorOutput, LiveTutorAdapterDisabled
  scriptedTutor.ts     deterministic Socratic prompts and hidden budgets
  tutorService.ts      appends tutor events; cannot reach engine commands
src/components/, src/screens/   React presentation (S00-S11)
src/server/      server engine (pilot)
  api.ts               wire contract shared by pages and server
  handler.ts           authenticate link/key, fold log, run guarded command, stamp, atomic append
  store.ts, memoryStore.ts, supabaseStore.ts   persistence boundary and implementations
  edgeEntry.ts         bundle entry for the Supabase Edge Function
src/session/gateway.ts, localGateway.ts, remoteGateway.ts   the UI's only route to the engine
src/mainRemote.tsx, src/facilitator/   pilot participant and facilitator entry points
supabase/        migrations (append-only schema) and the edt-engine function
tests/unit/      AT01-AT30, AT32 at engine/persistence level; SRV01-SRV12 server
tests/browser/   Playwright walkthroughs incl. AT31 keyboard and DOM leakage checks; PIL01-PIL05 pilot
docs/            decision log, test report, screenshots, reference-path session JSON
```

Separation of responsibilities, as enforced in code:

- **Engine** owns patient facts, availability, simulated time, transitions, and authored consequences. UI buttons are
  disabled for convenience only; every command re-checks its guards.
- **Learner** owns requests, reasoning, interpretations, recommendations and supported choices. Committed entries are
  never edited; revisions are new linked versions.
- **Tutor** receives a `TutorContext` built from released state only and returns a message or silence. The controller
  rejects any non-tutor event from the tutor path (test AT20).
- **Storage** sits behind `SessionRepository`. Every learner-visible payload is stored in its release event, so an
  export can be replayed without the case file (`replayExport`).

The local prototype necessarily bundles hidden content in its JavaScript. UI guards are a simulation-integrity
boundary, not a security boundary. A production build must move `caseContent.ts` and `commands.ts` to a server that
returns only released payloads.

## Replacing placeholders with approved images

See `public/assets/README.md`. In short: add frames under `public/assets/` with the normalized file name, set the
asset's `frame_paths`, `approval_state`, `version` and `reviewers` in `src/case/assetManifest.ts`, and rebuild. Asset IDs
are preserved from the Visual Bible; gates and reports do not change.

## Adding a live tutor later

Implement `TutorAdapter` on a server-backed adapter. Give it only `TutorContext` and approved evidence snippets, validate
output with `validateTutorOutput` plus grounding and forbidden-content checks, and fall back to an authored boundary
message on failure. Record model, prompt, policy and evidence versions in `tutor_message` payloads.
