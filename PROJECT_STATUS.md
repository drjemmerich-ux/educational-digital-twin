# Project status · Educational Digital Twin

| Item | Value |
| --- | --- |
| Current version | Prototype 1.7 (`ui-1.7.0`, `engine-1.7.0`, content `edt-lum-dummy-001-handoff-1.1`) |
| Case | `EDT-LUM-DUMMY-001`, fictional lumbar degenerative spondylolisthesis sandbox |
| Updated | 14 October 2026 |
| Stage | Pilot live at https://educational-digital-twin.vercel.app; ready for a facilitator dry run |

## Completed

| Component | Status |
| --- | --- |
| Prototype 1.6 (five nodes, branches, consent, debrief, scripted tutor, local persistence, export) | Implemented, tested |
| Gateway refactor: interface reaches the engine by command name only | Implemented, tested (local suite unchanged, 17/17) |
| Server engine handler, Supabase store, append-only schema, atomic append | Implemented, tested locally and live (15 October) |
| Personal links, participant pilot page, facilitator page (create/disable links, progress, JSON export) | Implemented, tested in browser against local server |
| Hidden-content build check for pilot bundles | Implemented, passing |
| GitHub repository, private, `main` | Live: source pushed |
| Supabase project (Frankfurt) | Live: schema applied, security advisor shows only the intended "RLS without policies" notice |
| Edge Function `edt-engine` | Live, deployed by GitHub Actions on each push to `main` (tests run first) |
| Vercel site | Live: https://educational-digital-twin.vercel.app and `/facilitator` |

## Live verification (15 October 2026)

Link creation, consent, initial assessment, a study request with the interpretation gate, reload and resume, stale-write
refusal, facilitator overview and the absence of hidden strings in the served pages were verified on the live service with
a temporary key (revoked). Details in `docs/DEPLOYMENT.md`. Test residue: run `deploy/cleanup-live-test.sql`.

## Placeholder or awaiting expert review

- Images: all 43 packages `Planned`. First batch-1 radiographs reviewed 14 October; not approved (level count, no identifiable L4-L5 slip; the "flexion" upload duplicated the neutral file).
- Consent text placeholders: retention period, withdrawal date, coordinator name and emails.
- Reading list: durotomy and standing-versus-supine references not supplied.

## Not verified

- Full five-node journey and JSON download on the live service (verified on the local pilot server only).
- Behaviour under several simultaneous participants (free-plan limits not load-tested).
- Screen readers, non-Chromium browsers, phones.

## Tests

Type-check against real React types: pass (GitHub Actions) · unit 50/50 (38 acceptance + 12 server) · browser 22/22 (17 local + 5 pilot) · reference export replay pass. Details in `docs/TEST_REPORT.md`.

## Next step

1. Dr Emmerich: facilitator dry run (create one link, complete the case once end to end, download the JSON).
2. Complete the consent placeholders (retention, withdrawal date, coordinator, contact) before inviting fellows.
3. Approved images for batch 1, then batches 2-4.
