# Project status · Educational Digital Twin

| Item | Value |
| --- | --- |
| Current version | Prototype 1.6 (`ui-1.6.0`, `engine-1.6.0`, content `edt-lum-dummy-001-handoff-1.1`, approved 13 October 2026) |
| Case | `EDT-LUM-DUMMY-001`, fictional lumbar degenerative spondylolisthesis sandbox |
| Updated | 13 October 2026 |
| Stage | Clinical content locked and implemented; images and server deployment pending |

## Completed

| Component | Status |
| --- | --- |
| Frozen case content, public catalogue, 43-package asset manifest | Implemented, tested |
| Deterministic event-sourced engine with guarded commands (N1–N5, review pause) | Implemented, tested |
| Two-commitment investigation gate; interpretation-before-report gate; non-imaging and text-only routes | Implemented, tested |
| Working-model, interpretation and plan versioning with predecessor links | Implemented, tested |
| Management commitment with canonical-continuation acknowledgement | Implemented, tested |
| Durotomy checkpoint (proposal before team action) | Implemented, tested |
| Day 3 findings, postoperative work-up, branches B1–B4, expert-review pause | Implemented, tested |
| Six-week follow-up (B1 measures; B2/B3 qualitative only) | Implemented, tested |
| Layered descriptive debrief with metrics, comparisons and reflection | Implemented, tested |
| Local persistence, drafts, refresh restore, tab lock, memory-only fallback | Implemented, tested |
| Session JSON export, replay verification, reference-path fixture | Implemented, tested |
| Scripted Socratic tutor with adapter contract; live adapter disabled | Implemented, tested |
| Three-column clinical workspace (1024 px and above), drawers below 1024 px | Implemented, tested at 420–1440 px |
| Demonstration session (separate, labelled) | Implemented, tested |

## Added in 1.6

| Component | Status |
| --- | --- |
| Expert decisions 1-21 (patient Elena Marsh, CT wording, collection axes, laboratory and CT timing, block record) | Implemented, tested |
| Authored continuations after persistence (observation then re-exploration; deferral then drainage or re-exploration) | Implemented, tested |
| Participant information and consent screen, training level, consent recorded in the session | Implemented, tested (text contains bracketed placeholders) |
| Neutral debrief statement for drainage without a postoperative MRI | Implemented, tested |
| Faculty perspective and five verified references (debrief only) | Implemented, tested |
| Twelve case-specific tutor prompts with release conditions; tutor silent at the intraoperative checkpoint | Implemented, tested |

## Placeholder or awaiting expert review

- **Images:** all 43 packages are `Planned`; the viewer shows labelled technical placeholders. No image is clinically validated.
- **Portrait, body map, timeline diagram, annotated teaching copies:** placeholders or not shown.
- **Consent text placeholders:** retention period, withdrawal date, coordinator name and emails.
- **Reading list:** durotomy and standing-versus-supine references not yet supplied or verified.

## Not verified

- Type-check against real `@types/react` (registry blocked in the build environment).
- The published claude.ai Artifact preview was not opened from this session.
- Full five-node keyboard-only journey (keyboard tested through the first investigation cycle).
- Screen readers, non-Chromium browsers, phones.
- No GitHub repository is connected. Source is delivered as a zip; commit history exists only in the build workspace.

## Tests

Engine 38/38 pass · browser 17/17 pass · reference export replay pass. Details in `docs/TEST_REPORT.md`.

## Next step

1. Image production pack for ChatGPT, batch 1 first (decision 15).
2. Account setup by Dr Emmerich: GitHub, Supabase (Frankfurt), Vercel; then the server engine, personal links and facilitator page.
3. Complete the consent placeholders and name a coordinator.
