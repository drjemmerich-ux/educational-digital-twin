# Test report · Prototype 1.6

Run on 13 October 2026 in the build environment (Node 22.22, headless Chromium via Playwright 1.56).
Raw logs: `docs/verification/`. Screenshots: `docs/screenshots/`.

| Check | Result |
| --- | --- |
| Type-check (strict TS, offline React shim) | Pass |
| Type-check against real `@types/react` | **Not run** (package registry unavailable here) |
| Engine, persistence, export, tutor tests (`npm test`) | 38 of 38 pass |
| Browser walkthroughs (`npm run test:browser`) | 17 of 17 pass |
| Reference-path export regenerated and replayed | Pass: 96 events, `clinical_pathway_completed`, checksum `f0556768` |
| Horizontal overflow at 420, 768, 900, 1024, 1280 px | None |
| Published Artifact preview opened and exercised in claude.ai | **Not verified** from this session |

## Acceptance criteria coverage

| ID | Where tested | Result |
| --- | --- | --- |
| AT01 | Unit (released state at N1) + browser DOM, attributes and title scan at S00, S01, S02 | Pass |
| AT02, AT03 | Unit; browser (drawer refuses rationale-only) | Pass |
| AT04 | Unit: distinct ordered events in one atomic transaction before release | Pass |
| AT05 | Unit; browser (Report and annotations tabs locked; no report text in DOM before interpretation) | Pass |
| AT06 | Unit (non-imaging route, no image step) | Pass |
| AT07 | Unit (integrated report includes only interpreted imaging) | Pass |
| AT08 | Unit; browser (request outside catalogue, repeat request) | Pass |
| AT09 | Unit; browser (reopen logged as view, no duplicate order) | Pass |
| AT10 | Unit (model versions, interpretation addendum linked to original) | Pass |
| AT11, AT12 | Unit (fusion and nonoperative); browser (fusion, acknowledgement required) | Pass |
| AT13 | Unit; browser (team action absent until proposal committed) | Pass |
| AT14 | Unit scan of all postoperative content for hardware terms; no postoperative image files exist | Pass (no images to inspect) |
| AT15 | Unit; browser B1 walkthrough | Pass |
| AT16 | Unit (incl. repeated observation pauses); browser B2 rescue walkthrough | Pass |
| AT17 | Unit; browser B3 walkthrough | Pass |
| AT18 | Unit; browser B4 review walkthrough (further deferral after persistence) | Pass |
| D1, D5, D8-D10, D17 | Unit: drainage-without-MRI statement, authored continuations, debrief-only faculty perspective and references, prompt release conditions and checkpoint silence, consent required; browser: consent screen, B4 then drainage | Pass |
| AT19 | Unit; browser ("None of these" pauses; uncommitted choice editable) | Pass |
| AT20 | Unit: tutor cannot append non-tutor events, output contract rejects extra fields, tutor sources import no engine commands or hidden content, clinical state unchanged by tutor activity | Pass |
| AT21 | Unit static check (only `engine/commands.ts` imports hidden content); browser DOM scans | Pass |
| AT22 | Unit; browser (text-only route and placeholder notices in UI and export) | Pass. A real image load error is handled in code but only exercised at engine level, because no image files exist |
| AT23 | Unit; browser reload after interpretation (gates, event order, drafts) | Pass |
| AT24 | Unit; browser (developer tool simulates a storage failure; nothing released; retry succeeds) | Pass |
| AT25 | Unit (mid-session export excludes hidden payloads); browser (export matches on-screen trace) | Pass |
| AT26 | Unit replay for B1, B2, B3, B4 and unsupported paths; tampered export detected | Pass |
| AT27 | Unit; browser (exit, new encounter, both sessions listed) | Pass |
| AT28 | Unit (72-hour drainage spans POD4 to POD7 with seconds of real time) | Pass |
| AT29 | Unit; browser (900 m, 3/10, 2/10, 24%, 5/5; no numbers for B2 or B3) | Pass |
| AT30 | Unit (no grading or competence vocabulary, no citations); browser debrief text scan | Pass |
| AT31 | Browser keyboard-only journey at 1280 and 1024 px, visible focus | Pass for start, assessment, request, interpretation. The full five-node journey was not repeated keyboard-only |
| AT32 | Unit scan for superseded details; asset registry has 43 unique planned packages | Pass |

## Required walkthroughs

Reference B1, B2 rescue, B3, B4 review pause, fusion recommendation with disclosed continuation, unsupported study,
placeholder image, refresh after interpretation, unsupported postoperative action, and reference export verified
against the on-screen sequence: all completed in the browser suite.

## What these checks do not establish

Clinical realism of images (none exist yet), clinical accuracy of wording beyond the frozen facts, screen-reader
behaviour with assistive technology, behaviour in browsers other than Chromium, and educational efficacy.
