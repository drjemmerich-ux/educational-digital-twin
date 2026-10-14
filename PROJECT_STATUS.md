# Project status · Educational Digital Twin

| Item | Value |
| --- | --- |
| Current version | Prototype 1.7 (`ui-1.7.0`, `engine-1.7.0`, content `edt-lum-dummy-001-handoff-1.1`) |
| Case | `EDT-LUM-DUMMY-001`, fictional lumbar degenerative spondylolisthesis sandbox |
| Updated | 14 October 2026 |
| Stage | Pilot server built and tested locally; live deployment waiting on three one-time setup steps |

## Completed

| Component | Status |
| --- | --- |
| Prototype 1.6 (five nodes, branches, consent, debrief, scripted tutor, local persistence, export) | Implemented, tested |
| Gateway refactor: interface reaches the engine by command name only | Implemented, tested (local suite unchanged, 17/17) |
| Server engine handler, Supabase store, append-only schema, atomic append | Implemented; handler tested with memory store; **live database not yet exercised** |
| Personal links, participant pilot page, facilitator page (create/disable links, progress, JSON export) | Implemented, tested in browser against local server |
| Hidden-content build check for pilot bundles | Implemented, passing |
| GitHub repository, private, `main` | Live: source pushed |
| Supabase project (Frankfurt) | Created; schema not applied |
| Edge Function deployment workflow (GitHub Actions) | Written; needs `SUPABASE_ACCESS_TOKEN` secret |
| Vercel configuration | Written; project not created |

## Waiting on Dr Emmerich (one-time, see `docs/DEPLOYMENT.md`)

1. Run `deploy/setup-database.sql` in the Supabase SQL editor (creates the schema and returns the facilitator key).
   Applying it from this session was attempted three times and the approval was cancelled each time.
2. Add the `SUPABASE_ACCESS_TOKEN` repository secret on GitHub, then run the "Deploy server engine" workflow.
3. Import the repository in Vercel, or re-authorize the Vercel connector for the `educamy` team
   (the connector was refused: "Not authorized: Trying to access resource under scope educamy").

## Placeholder or awaiting expert review

- Images: all 43 packages `Planned`. First batch-1 radiographs reviewed 14 October; not approved (level count, no identifiable L4-L5 slip; the "flexion" upload duplicated the neutral file).
- Consent text placeholders: retention period, withdrawal date, coordinator name and emails.
- Reading list: durotomy and standing-versus-supine references not supplied.

## Not verified

- Live Supabase, Edge Function and Vercel behaviour (not deployed yet).
- Screen readers, non-Chromium browsers, phones.

## Tests

Type-check against real React types: pass (GitHub Actions) · unit 50/50 (38 acceptance + 12 server) · browser 22/22 (17 local + 5 pilot) · reference export replay pass. Details in `docs/TEST_REPORT.md`.

## Next step

Complete the three setup steps; then Claude verifies the live service end to end (link → encounter → facilitator export),
runs the security advisors, and publishes the pilot URL.
