# Test report · Prototype 1.7

Run on 14 October 2026 in the build environment (Node 22.22, headless Chromium via Playwright 1.56).
Raw logs: `docs/verification/`. Screenshots: `docs/screenshots/`.

| Check | Result |
| --- | --- |
| Type-check (strict TS, offline React shim) | Pass |
| Type-check against real `@types/react` | Pass on GitHub Actions (run 38590051784); unit tests also pass there |
| Engine, persistence, export, tutor and server tests (`npm test`) | 50 of 50 pass (38 acceptance + 12 server) |
| Browser walkthroughs (`npm run test:browser`) | 22 of 22 pass (17 local build + 5 pilot build), three consecutive full runs. AT31 was intermittent after commits became asynchronous (the test read state before the commit resolved); it now waits for the commit and still asserts focus return |
| Hidden-content check on pilot bundles | Pass: 212 hidden case strings, none in the participant or facilitator page |
| Reference-path export regenerated and replayed | Pass: 96 events, `clinical_pathway_completed`, checksum `7a9c021c` (version labels changed to 1.7) |
| Live Supabase database, Edge Function, Vercel site | Pass for the checks listed in `docs/DEPLOYMENT.md` (15 October); full five-node journey not repeated live |
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

## Server and pilot checks (new in 1.7)

| ID | What it checks | Result |
| --- | --- | --- |
| SRV01 | Facilitator key required; link created once; only the token hash stored; overview never returns tokens | Pass |
| SRV02 | Invalid and disabled links refused | Pass |
| SRV03 | Reference journey through the server equals the local engine (event types, stage, released content); export replays | Pass |
| SRV04 | Stored log equals the participant trace; reopening rebuilds identical state | Pass |
| SRV05 | Guards on the server: consent, imaging route, unknown command, malformed input, wrong stage; link cannot start a demonstration | Pass |
| SRV06 | One open encounter per link; another link cannot read it | Pass |
| SRV07 | Stale tab refused with CONFLICT, becomes read-only, nothing appended | Pass |
| SRV08 | Database or network failure releases nothing | Pass |
| SRV09 | Tutor path can only append tutor events | Pass |
| SRV10 | Double submission sends one request | Pass |
| SRV11 | Facilitator overview with training level; disable and re-enable | Pass |
| SRV12 | Participant and facilitator sources import no engine commands or hidden content | Pass |
| PIL01 | No link or a bad link: clear message | Pass |
| PIL02 | Served participant page contains no hidden case content | Pass |
| PIL03 | Browser: facilitator creates link → consent → B1 to completion with a reload mid-session → server record equals trace → facilitator JSON export | Pass |
| PIL04 | Disabled link stops access | Pass |
| PIL05 | Wrong facilitator key refused | Pass |

The pilot browser tests use the local development server, which runs the same handler as the Edge Function with an
in-memory store. The Supabase store and SQL functions were exercised live on 15 October (link creation, appends, conflict, overview, withdrawal path not yet run live).

## Required walkthroughs

Reference B1, B2 rescue, B3, B4 review pause, fusion recommendation with disclosed continuation, unsupported study,
placeholder image, refresh after interpretation, unsupported postoperative action, and reference export verified
against the on-screen sequence: all completed in the browser suite.

## What these checks do not establish

Clinical realism of images (none exist yet), clinical accuracy of wording beyond the frozen facts, screen-reader
behaviour with assistive technology, behaviour in browsers other than Chromium, and educational efficacy.
