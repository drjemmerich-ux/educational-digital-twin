# Project status · Educational Digital Twin

| Item | Value |
| --- | --- |
| Current version | Prototype 1.5 (`ui-1.5.0`, `engine-1.5.0`, content `edt-lum-dummy-001-handoff-1.0`) |
| Case | `EDT-LUM-DUMMY-001`, fictional lumbar degenerative spondylolisthesis sandbox |
| Updated | 12 October 2026 |
| Stage | Ready for preliminary review of workflow; images pending |

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

## Placeholder or awaiting expert review

- **Images:** all 43 packages are `Planned`; the viewer shows labelled technical placeholders. No image is clinically validated.
- **Portrait, body map, timeline diagram, annotated teaching copies:** placeholders or not shown.
- **Clinical wording questions C1–C11:** see `docs/DECISION_LOG.md` (postoperative CT and laboratory timing, collection axes, CT coronal wording, B1 without MRI, note wording).

## Not verified

- Type-check against real `@types/react` (registry blocked in the build environment).
- The published claude.ai Artifact preview was not opened from this session.
- Full five-node keyboard-only journey (keyboard tested through the first investigation cycle).
- Screen readers, non-Chromium browsers, phones.
- No GitHub repository is connected; source is delivered as a zip with local git history.

## Tests

Engine 33/33 pass · browser 16/16 pass · reference export replay pass. Details in `docs/TEST_REPORT.md`.

## Next step

1. Expert review of the decision-log questions C1–C11 and of all case text in `src/case/caseContent.ts`.
2. Production and review of image batch 1 (XR-N2-002, XR-N2-003, XR-N2-004, MRI-N2-001, MRI-N2-002, MRI-N2-004, CT-N2-002), then replacement by asset ID.
3. Two or three preliminary fellow walkthroughs with exported sessions.
