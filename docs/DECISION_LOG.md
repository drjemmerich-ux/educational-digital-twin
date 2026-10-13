# Developer decision log

Prototype 1.5 · content bundle `edt-lum-dummy-001-handoff-1.0` · 12 October 2026

Authority: `EDT_Lumbar_Functional_Prototype_Master_Prompt_v1.0.md` (sections 1–25, Appendix A), supplemented by
`Biblia_Visual_Caso_Lumbar_v0.1.json` (29 September 2026). No clinical fact was added beyond these sources.
Entries marked **Expert review** need Dr Emmerich's judgment; none blocks the current build.

## Version precedence and supersessions

| ID | Decision | Status |
| --- | --- | --- |
| P1 | Spec §6 says "borderline dynamic **mobility**"; the Visual Bible says "borderline dynamic **instability**". The spec controls; no report or screen uses either phrase as a diagnosis. | Applied |
| P2 | The project contains two files named `EDT_Lumbar_Functional_Prototype_Master_Prompt_v1.0.md` (uploaded 22:41 and 22:44 UTC). The later upload was read in full and used. The two were not compared line by line. | Applied; confirm if they differ |
| P3 | Superseded details (66-year-old teacher, EHL 4/5, 7/9/6 mm, 5°, instrumented fusion or TLIF, failed clamp, extra 48 h drainage, beta-2 transferrin result) are absent; an automated test (AT32) scans all case content for them. | Applied, tested |

## Clinical content questions for expert review

| ID | Item | Current handling |
| --- | --- | --- |
| C1 | **Postoperative CT timing.** Assets CT-N4-001/002 are authored as postoperative day 1 series, but the spec places the postoperative work-up after the day 3 reassessment. | CT is requestable in the day 3 work-up; its release is labelled postoperative day 3. Content describes bony anatomy only. **Expert review** |
| C2 | **Postoperative laboratory timing.** LAB-N4-001 is authored for days 1 to 4; it is requested on day 3. | Titled "Postoperative laboratory trend since surgery", released at day 3, no numbers. **Expert review** |
| C3 | **Collection dimensions.** The spec forbids assigning axes the source has not established; MRI-N4-003 in the Visual Bible implies 55 mm is craniocaudal. | Reports state "approximately 48 x 18 x 55 mm" with no axis labels. Manifest keeps the Visual Bible wording. **Expert review** |
| C4 | **CT coronal series wording.** CT-N2-003 lists "mild L4-L5 degeneration" while CT-N2-002 and spec §6 state advanced bilateral L4-L5 facet arthrosis. | The CT report omits "mild L4-L5 degeneration" and keeps "symmetric pedicles; no segmentation anomaly". **Expert review** |
| C5 | **B1 prerequisite.** B1 is authored as drainage "after assessment and MRI". | The branch executes even if the learner did not request the MRI; the decision event records `postop_mri_released_before_choice`. **Expert review**: should B1 without MRI pause instead? |
| C6 | **B2 second decision.** Only lumbar drainage is authored as the B2 rescue. | Re-exploration, repeated observation, deferral or "none" after persistence enter expert review with the plan preserved. |
| C7 | **Interval labels.** Observation, re-exploration and deferral intervals are not specified. | Simulated time shows labels such as "After the monitored observation period (interval not specified in the case)". |
| C8 | **Nursing note wording.** POD3 note reads "Postural headache reported. Increased clear drainage on the dressing with mobilization." "On the dressing" is consistent with the wound-photograph package but is a paraphrase. | **Expert review** of all note text in `src/case/caseContent.ts` (CLINICAL_UPDATES, BRANCH_STEPS). |
| C9 | **Postoperative MRI impression** uses "communicating postoperative pseudomeningocele" (VD-016 terminology). Released only after the learner's interpretation. | Applied; confirm wording. |
| C10 | **Six-week table** shows baseline right EHL 4+/5 beside 5/5, and left leg pain "Not recorded in this case". | Applied (no invented value). |
| C11 | **"Other strategy" recommendations** are automatically flagged for expert review, because the build cannot tell whether they need facts absent from the case. | Applied |

## Software decisions (routine, reversible)

| ID | Decision |
| --- | --- |
| S1 | The package registry is blocked in this build environment. React 19, esbuild, TypeScript, tsx and Playwright were available offline, so XState and Vite were replaced by a strictly typed event-sourced engine (pure reducer + guarded commands) and an esbuild build script. The spec allows "a clearly typed equivalent". |
| S2 | Type-checking uses a local React type shim (`types-sandbox/`, `npm run typecheck:offline`). `npm run typecheck` against real `@types/react` has **not** been run here. |
| S3 | Every learner-visible fact is carried inside its release event, so export and replay never need hidden content. Only `src/engine/commands.ts` imports hidden case content (enforced by test AT21). |
| S4 | A request commits `investigation_requested`, `rationale_committed`, `expectation_committed` and the release in one atomic append; a storage failure releases nothing (AT24). |
| S5 | Imaging route is chosen per session (placeholder viewer with interpretation gate, or text-only demonstration). An individual image study can switch to text-only with a recorded reason. |
| S6 | Confidence inputs start unset. Confidence is required at the initial assessment, the integrated working model, the recommendation, the postoperative reassessment and each postoperative plan; optional elsewhere. |
| S7 | Leaving the pre-operative work-up is allowed with unfinished study cycles; they are recorded as open cycles and their reports stay locked. |
| S8 | Scripted tutor restraint: unrequested prompts only on entering the management decision and after the first result of a node; hidden budgets of 3 prompts per node and 2 per investigation cycle; prompts never duplicate mandatory form questions. |
| S9 | Local persistence with an advisory single-tab lock and cross-tab conflict detection; an explicit memory-only mode when storage is unavailable. |
| S10 | The Artifact preview inlines the same bundled build that the tests ran against, instead of loading React from a CDN, so the published page is the tested page. File export in the Artifact uses the platform `downloads` capability, with Copy JSON as a fallback. |
| S11 | A demonstration session (prefilled "Sample:" text, labelled banner, `session_kind: demonstration`) is separate from participant sessions. |

## Expert decisions of 12 October 2026 (Dr Juan P. Emmerich)

These amend the approved specification where noted. They are applied in content version
`edt-lum-dummy-001-handoff-1.1` (pending implementation).

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Lumbar drainage without postoperative MRI (C5) | Allowed. The omission is recorded and the debrief states it neutrally: "You started lumbar drainage without a postoperative MRI." No pause. |
| 2 | Postoperative CT and laboratory timing (C1, C2) | Laboratory trend presented as routine, available since postoperative day 1, still behind the request gate. Postoperative CT is a new day 3 acquisition. |
| 3 | Collection dimensions (C3) | **Amendment.** Reports state 48 mm transverse x 18 mm anteroposterior x 55 mm craniocaudal. |
| 4 | CT wording (C4) | **Amendment.** CT reads "mild disc-space narrowing at L4-L5 with advanced bilateral facet arthrosis, without vacuum phenomenon" (consistent with partially preserved disc height). CT-N2-003 manifest wording aligned. |
| 5 | Unauthored continuations (C6) | **Amendment, newly authored outcomes.** Observation, persistence, then re-exploration: the leak resolves; additional operative burden and a longer stay than the reference course. Deferral, persistence, then lumbar drainage: the leak resolves; longer stay than the reference course. Deferral, persistence, then re-exploration: the leak resolves; additional operative burden and a longer stay than the reference course. Further observation or deferral after persistence remains an expert-review pause. No numbers or six-week measures for these courses. |
| 6 | Case text approval | A content review pack of every learner-facing line, each marked verbatim, paraphrased or newly authored, for sign-off in one pass. |
| 7 | Patient name | **Amendment.** The patient is Elena Marsh. |
| 8 | Expert commentary | A "Faculty perspective" section in the debrief, drafted by Claude, edited and signed off by Dr Emmerich; shown only after the episode ends. |
| 9 | Tutor prompts | Case-specific Socratic prompts drafted by Claude with tested release conditions; wording approved in the review pack. |
| 10 | Evidence | A verified reading list of 5 to 8 references, debrief only, neutral one-line notes, each checked against the original publication. |
| 11 | Audience | Final prototype serves a small fellow pilot (2 to 10), each with a unique personal link, no login. |
| 12 | Backend | Supabase (Frankfurt, EU) with a server-side engine; Vercel hosting; GitHub private repository `educational-digital-twin`. Free tiers during development; Supabase Pro recommended during the pilot. Personal project, not linked to AO at this stage. |
| 13 | Live tutor | Scripted tutor for the first pilot round; a live tutor later as a separate, controlled step, tested by Dr Emmerich first. |
| 14 | Version control | Covered by decision 12. |
| 15 | Images | Generated by Dr Emmerich in ChatGPT from a Claude-prepared production pack (prompts, consistency anchors, frame plans, filenames, review checklists). About 8 data-driven packages built programmatically. Batch 1 first. |
| 16 | Reviewers | Dr Emmerich holds all three reviewer roles for the pilot; two additional reviewers after the pilot. |
| 17 | Research use | Plan for research from the start: ethics approval or exemption before inviting fellows. Claude prepares the participant information sheet, consent text, data management description and protocol summary. A participant information and agreement screen precedes the first session. |
