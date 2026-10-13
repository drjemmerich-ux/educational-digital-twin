// Browser journey checks (Playwright + headless Chromium) against the built dist/index.html.
// Covers full walkthroughs B1-B4, fusion recommendation, unsupported study, placeholder images,
// refresh after interpretation, unsupported postoperative action, save failure, DOM leakage,
// keyboard operation, and export-vs-screen verification.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const URL_ = new URL('../../dist/index.html', import.meta.url).href;
const SHOTS = new URL('../../docs/screenshots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
let browser;
before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});

async function open(viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(URL_);
  return { page, context, errors };
}

const confirm = async (page, label) => {
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.getByRole('button', { name: 'Confirm and commit' }).click();
};
const setConfidence = async (page, id) => {
  await page.locator(`#${id}`).focus();
  await page.keyboard.press('ArrowRight');
};

async function start(page, route = 'image') {
  if (route === 'text') await page.getByRole('radio', { name: /Text-only demonstration/ }).check();
  await page.getByRole('button', { name: 'Start patient encounter' }).click();
  await consent(page);
}

async function consent(page) {
  const boxes = page.locator('.consent-list input[type="checkbox"]');
  const n = await boxes.count();
  for (let i = 0; i < n; i++) await boxes.nth(i).check();
  await page.getByRole('radio', { name: 'Fellow' }).check();
  await page.getByRole('button', { name: 'I agree to take part. Start the session' }).click();
}

async function initialAssessment(page) {
  await page.fill('#n1-pr', 'Learner problem representation');
  await page.fill('#n1-h-0', 'Learner hypothesis one');
  await page.fill('#n1-prio', 'Learner priorities');
  await setConfidence(page, 'n1-conf');
  await confirm(page, 'Commit initial assessment');
}

async function study(page, title, opts = {}) {
  await page.getByRole('button', { name: `Request ${title}`, exact: true }).click();
  await page.fill('#drawer-rationale', `Why ${title}`);
  await page.fill('#drawer-expectation', `Expect ${title}`);
  await page.getByRole('button', { name: 'Commit request and reveal' }).click();
  const imaging = await page.getByRole('tab', { name: /Images/ }).count();
  const id = await page.locator('.study-panel textarea[id^="interp-"]').first().getAttribute('id');
  await page.fill(`#${id}`, `My interpretation of ${title}`);
  await page.getByRole('button', { name: imaging ? 'Commit interpretation and open report' : 'Commit interpretation' }).click();
  if (opts.stopAfterInterpretation) return;
  const form = page.locator('.task-block', { hasText: 'Update your working model' });
  await form.getByRole('radio', { name: 'Supports' }).check();
  await form.getByRole('radio', { name: opts.revise ? 'Revise it (saved as a new version)' : 'Maintain my current working model' }).check();
  await form.getByRole('radio', { name: 'No' }).check();
  await confirm(page, 'Commit model update');
  await page.getByRole('button', { name: 'Back to investigations' }).click();
}

async function concludeWorkup(page) {
  await page.getByRole('button', { name: 'I have enough information to formulate a management plan' }).click();
  await page.fill('#n2-integrated', 'Integrated model');
  await setConfidence(page, 'n2-conf');
  await page.getByRole('checkbox').check();
  await confirm(page, 'Commit and continue to management');
}

async function recommend(page, category = 'Decompression alone') {
  await page.getByRole('radio', { name: category }).check();
  await page.fill('#n3-summary', `My ${category} plan`);
  await setConfidence(page, 'n3-conf');
  await confirm(page, 'Commit recommendation');
}

async function operativeDay(page) {
  await page.getByRole('button', { name: 'I understand. Continue with the predefined course' }).click();
  await page.getByRole('button', { name: 'Continue the procedure' }).click();
  await page.fill('#n4-immediate', 'My intraoperative proposal');
  await confirm(page, 'Commit proposal');
  await page.getByRole('button', { name: "Show the team's action" }).click();
  await page.getByRole('button', { name: 'Advance to postoperative day 1' }).click();
  await page.getByRole('button', { name: 'Advance to postoperative day 3' }).click();
}

async function postopToSelection(page, studies = ['Lumbar MRI (postoperative)']) {
  await page.fill('#pod3-pr', 'Postoperative problem');
  await page.fill('#pod3-dd-0', 'Explanation one');
  await page.fill('#pod3-prio', 'Priorities');
  await setConfidence(page, 'pod3-conf');
  await confirm(page, 'Commit reassessment');
  for (const s of studies) await study(page, s);
  await page.getByRole('button', { name: 'I am ready to commit a management plan' }).click();
  await page.fill('#postop-plan', 'My postoperative plan');
  await setConfidence(page, 'postop-conf');
  await confirm(page, 'Commit plan');
}

async function chooseAction(page, label) {
  await page.getByRole('radio', { name: label }).check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm action' }).click();
}

async function secondDecision(page, label) {
  await page.fill('#second-plan', 'My revised plan');
  await setConfidence(page, 'second-conf');
  await chooseAction(page, label);
}

const state = (page) => page.evaluate(() => window.__edt.controller.state);
const log = (page) => page.evaluate(() => window.__edt.controller.log);

const FORBIDDEN_EARLY = ['pseudomeningocele', 'durotomy', 'dural', 'Valsalva', 'stenosis', 'spondylolisthesis', 'decompression', 'fusion', '58 mm', '4.5 mm', '900 m', 'leak', 'lumbar drain', 're-exploration', 'CSF'];

test('AT01/AT21 landing, N1 and N2 DOM (text, attributes, titles) contain no future facts', async () => {
  const { page, errors } = await open();
  const scan = async (where) => {
    const html = (await page.content()).replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
    const title = await page.title();
    for (const term of FORBIDDEN_EARLY) {
      assert.ok(!html.toLowerCase().includes(term.toLowerCase()), `${where} DOM contains "${term}"`);
      assert.ok(!title.toLowerCase().includes(term.toLowerCase()), `${where} title contains "${term}"`);
    }
  };
  await scan('S00');
  await page.screenshot({ path: `${SHOTS}01-start.png` });
  await page.getByRole('button', { name: 'Start patient encounter' }).click();
  await scan('S00 consent');
  assert.equal(await page.getByRole('button', { name: 'I agree to take part. Start the session' }).isDisabled(), true, 'cannot start without consent');
  await page.screenshot({ path: `${SHOTS}01b-consent.png`, fullPage: true });
  await consent(page);
  assert.match(await page.locator('.chart-id').innerText(), /Elena Marsh/);
  await scan('S01');
  await page.screenshot({ path: `${SHOTS}02-initial-assessment.png` });
  await initialAssessment(page);
  await scan('S02');
  await page.screenshot({ path: `${SHOTS}03-workup-catalogue.png` });
  assert.deepEqual(errors, []);
});

test('Reference B1 walkthrough through UI, export verified against the on-screen trace (AT15, AT25, AT29)', async () => {
  const { page, errors } = await open();
  await start(page);
  await initialAssessment(page);
  await page.getByRole('button', { name: 'Request Lumbar MRI', exact: true }).click();
  await page.fill('#drawer-rationale', 'Rationale only');
  await page.screenshot({ path: `${SHOTS}04-request-drawer.png` });
  await page.getByRole('button', { name: 'Cancel' }).click();
  await study(page, 'Lumbar MRI', { stopAfterInterpretation: true });
  await page.screenshot({ path: `${SHOTS}06-report-after-interpretation.png` });
  const form = page.locator('.task-block', { hasText: 'Update your working model' });
  await form.getByRole('radio', { name: 'Weakens' }).check();
  await form.getByRole('radio', { name: 'Revise it (saved as a new version)' }).check();
  await page.fill('[id^="rev-pr-"]', 'Revised representation');
  await form.getByRole('radio', { name: 'Unsure' }).check();
  await confirm(page, 'Commit model update');
  await page.getByRole('button', { name: 'Back to investigations' }).click();
  await study(page, 'Flexion and extension lateral radiographs');
  await study(page, 'EMG and nerve conduction studies');
  await concludeWorkup(page);
  await page.screenshot({ path: `${SHOTS}07-management.png` });
  await recommend(page, 'Decompression alone');
  await page.screenshot({ path: `${SHOTS}08-canonical-ack.png` });
  await page.getByRole('button', { name: 'I understand. Continue with the predefined course' }).click();
  await page.getByRole('button', { name: 'Continue the procedure' }).click();
  await page.screenshot({ path: `${SHOTS}09-intraop-checkpoint.png` });
  assert.equal(await page.getByText('primary suture repair').count(), 0, 'team action hidden before proposal');
  await page.fill('#n4-immediate', 'My intraoperative proposal');
  await confirm(page, 'Commit proposal');
  await page.getByRole('button', { name: "Show the team's action" }).click();
  await page.getByRole('button', { name: 'Advance to postoperative day 1' }).click();
  await page.getByRole('button', { name: 'Advance to postoperative day 3' }).click();
  await page.screenshot({ path: `${SHOTS}10-new-postop-findings.png` });
  const pod3Html = await page.locator('#center').innerHTML();
  assert.ok(!/pseudomeningocele|CSF leak/i.test(pod3Html), 'POD3 screen not prelabelled');
  await postopToSelection(page, ['Postoperative laboratory studies', 'Lumbar MRI (postoperative)']);
  await page.screenshot({ path: `${SHOTS}11-action-selection.png` });
  await chooseAction(page, 'Lumbar CSF drainage');
  await page.getByRole('button', { name: 'Advance through the prescribed drainage period' }).click();
  await page.screenshot({ path: `${SHOTS}12-b1-resolved.png` });
  const text = await page.locator('#center').innerText();
  assert.match(text, /No re-exploration was performed/);
  assert.ok(!/clamp|recurr/i.test(text));
  await page.getByRole('button', { name: 'Continue to follow-up' }).click();
  for (const v of ['900 m', '3/10', '2/10', '24%', '5/5']) assert.ok((await page.locator('.outcome-table').innerText()).includes(v), v);
  await page.screenshot({ path: `${SHOTS}13-six-week-follow-up.png` });
  await study(page, 'Standing lumbar AP and lateral radiographs (follow-up)');
  await page.getByRole('button', { name: 'Continue to the debrief' }).click();
  await page.screenshot({ path: `${SHOTS}14-debrief.png` });
  await page.getByRole('tab', { name: /Postoperative course/ }).click();
  assert.ok(await page.getByRole('heading', { name: 'Experienced course' }).isVisible());
  assert.equal(await page.getByRole('heading', { name: 'Reference course comparison' }).count(), 0, 'B1 is itself the reference');
  await page.getByRole('tab', { name: /Metrics and reflection/ }).click();
  await page.fill('#refl-r1', 'Reflection text');
  await page.getByRole('button', { name: 'Commit reflection' }).click();
  await page.getByRole('button', { name: 'Finish session' }).click();
  await page.screenshot({ path: `${SHOTS}15-debrief-metrics.png` });
  const debriefText = await page.locator('#center').innerText();
  assert.ok(!/\b(correct|incorrect|score|pass|fail|competen)/i.test(debriefText.replace(/No score|no score/g, '')), 'no grading language');

  // Export verified against the on-screen trace
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const json = JSON.parse(await page.locator('#export-json').inputValue());
  const sLog = await log(page);
  assert.equal(json.events.length, sLog.length);
  assert.deepEqual(json.events.map((e) => e.sequence), sLog.map((_, i) => i + 1));
  const timelineScreen = await page.evaluate(() => window.__edt.controller.state.timeline.map((t) => t.text));
  const chartTimeline = await page.locator('.timeline li').allInnerTexts();
  assert.equal(chartTimeline.length, timelineScreen.length);
  assert.equal(json.session.completion_status, 'clinical_pathway_completed');
  writeFileSync(new URL('../../docs/reference-path-session-ui.json', import.meta.url), JSON.stringify(json, null, 2));
  assert.deepEqual(errors, []);
});

test('Fusion recommendation stays distinct from the disclosed canonical continuation (AT11, AT12)', async () => {
  const { page } = await open();
  await start(page);
  await initialAssessment(page);
  await concludeWorkup(page);
  await recommend(page, 'Decompression with fusion');
  const ack = await page.locator('#center').innerText();
  assert.match(ack, /For this first prototype, your recommendation has been saved/);
  assert.match(ack, /Decompression with fusion/);
  assert.equal((await state(page)).stage, 'N3.canonical_ack');
  await page.getByRole('button', { name: 'I understand. Continue with the predefined course' }).click();
  const s = await state(page);
  assert.equal(s.recommendation.recommendation.category, 'decompression_fusion');
});

test('B2 rescue walkthrough (AT16)', async () => {
  const { page } = await open();
  await start(page);
  await initialAssessment(page);
  await concludeWorkup(page);
  await recommend(page);
  await operativeDay(page);
  await postopToSelection(page);
  await chooseAction(page, 'Short monitored period of recumbency and wound observation');
  await page.getByRole('button', { name: 'Advance to reassessment' }).click();
  assert.match(await page.locator('#center').innerText(), /persist/);
  assert.equal(await page.getByRole('button', { name: /Advance through/ }).count(), 0);
  await secondDecision(page, 'Lumbar CSF drainage');
  await page.getByRole('button', { name: 'Advance through the prescribed drainage period' }).click();
  assert.match(await page.locator('#center').innerText(), /modestly prolonged/);
  await page.getByRole('button', { name: 'Continue to follow-up' }).click();
  assert.equal(await page.locator('.outcome-table').count(), 0, 'no inherited six-week numbers');
  await page.getByRole('button', { name: 'Continue to the debrief' }).click();
  await page.getByRole('tab', { name: /Postoperative course/ }).click();
  assert.ok(await page.getByRole('heading', { name: 'Reference course comparison' }).isVisible());
  const s = await state(page);
  assert.equal(s.plans.length, 2);
  assert.equal(s.plans[1].predecessor_id, s.plans[0].plan_version_id);
});

test('B3 walkthrough (AT17)', async () => {
  const { page } = await open();
  await start(page);
  await initialAssessment(page);
  await concludeWorkup(page);
  await recommend(page);
  await operativeDay(page);
  await postopToSelection(page);
  await chooseAction(page, 'Early operative re-exploration and reinforced repair');
  await page.getByRole('button', { name: 'Advance to reassessment' }).click();
  assert.match(await page.locator('#center').innerText(), /additional operation/);
  await page.getByRole('button', { name: 'Continue to follow-up' }).click();
  assert.equal(await page.locator('.outcome-table').count(), 0);
});

test('B4 then drainage resolves through the authored continuation (D5)', async () => {
  const { page } = await open();
  await start(page);
  await initialAssessment(page);
  await concludeWorkup(page);
  await recommend(page);
  await operativeDay(page);
  await postopToSelection(page);
  await chooseAction(page, 'Defer targeted treatment for now');
  await page.getByRole('button', { name: 'Advance to reassessment' }).click();
  await secondDecision(page, 'Lumbar CSF drainage');
  await page.getByRole('button', { name: 'Advance through the prescribed drainage period' }).click();
  const t = await page.locator('#center').innerText();
  assert.match(t, /The hospital stay was prolonged/);
  assert.ok(!/reference course/i.test(t));
  await page.getByRole('button', { name: 'Continue to follow-up' }).click();
  assert.equal(await page.locator('.outcome-table').count(), 0);
  assert.equal((await state(page)).followUp.course, 'B4_drain');
});

test('B4 review-pause walkthrough (AT18) and safe pause content (AT19)', async () => {
  const { page } = await open();
  await start(page);
  await initialAssessment(page);
  await concludeWorkup(page);
  await recommend(page);
  await operativeDay(page);
  await postopToSelection(page);
  await chooseAction(page, 'Defer targeted treatment for now');
  await page.getByRole('button', { name: 'Advance to reassessment' }).click();
  await secondDecision(page, 'Defer targeted treatment for now');
  await page.screenshot({ path: `${SHOTS}16-expert-review.png` });
  const t = await page.locator('#center').innerText();
  assert.match(t, /does not contain an expert-authored consequence/);
  assert.match(t, /My revised plan/);
  assert.equal((await state(page)).status, 'paused_for_review');
  await page.getByRole('button', { name: 'Open the debrief of your recorded reasoning' }).click();
  await page.getByRole('tab', { name: /Postoperative course/ }).click();
  assert.match(await page.locator('#center').innerText(), /Clinical follow-up is unavailable for this path/);
});

test('Unsupported postoperative action pauses for review (AT19)', async () => {
  const { page } = await open();
  await start(page);
  await initialAssessment(page);
  await concludeWorkup(page);
  await recommend(page);
  await operativeDay(page);
  await postopToSelection(page);
  await page.getByRole('radio', { name: 'None of these describes my plan' }).check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Change selection' }).click();
  assert.equal((await state(page)).stage, 'N4.branch_selection', 'uncommitted choice can be edited');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm action' }).click();
  const s = await state(page);
  assert.equal(s.stage, 'REVIEW.pause');
  assert.equal(s.branchSteps.length, 0);
});

test('Unsupported study, repeat request and placeholder images are explicit (AT08, AT09, AT22)', async () => {
  const { page } = await open();
  await start(page);
  await initialAssessment(page);
  await page.getByRole('button', { name: 'Describe request' }).click();
  await page.fill('#drawer-name', 'Upright MRI');
  await page.fill('#drawer-rationale', 'Loaded imaging');
  await page.fill('#drawer-expectation', 'Slip increases');
  await page.getByRole('button', { name: 'Commit request', exact: true }).click();
  assert.match(await page.locator('.drawer').innerText(), /not available in this case catalogue/);
  await page.getByRole('button', { name: 'Return to the work-up' }).click();
  await study(page, 'Lumbar CT', { stopAfterInterpretation: true });
  await page.getByRole('tab', { name: 'Images' }).click();
  assert.match(await page.locator('.viewer').innerText(), /SYNTHETIC · PLACEHOLDER/);
  await page.getByRole('button', { name: 'Back to investigations' }).click();
  await page.getByRole('button', { name: 'Open Lumbar CT' }).click();
  await page.getByRole('button', { name: 'Record a repeat request' }).click();
  await page.fill('#drawer-rationale', 'Again');
  await page.fill('#drawer-expectation', 'Change');
  await page.getByRole('button', { name: 'Commit request', exact: true }).click();
  assert.match(await page.locator('.drawer').innerText(), /No repeat Lumbar CT result is authored/);
  const s = await state(page);
  assert.equal(s.unsupportedRequests[0].name, 'Upright MRI');
  assert.equal(s.investigations.lumbar_ct.reopenCount, 1);
  assert.ok(s.assetNotices.some((n) => n.kind === 'placeholder_displayed'));
});

test('Text-only route is explicit in UI and export (AT22)', async () => {
  const { page } = await open();
  await start(page, 'text');
  await initialAssessment(page);
  await page.getByRole('button', { name: 'Request Lumbar MRI', exact: true }).click();
  await page.fill('#drawer-rationale', 'r');
  await page.fill('#drawer-expectation', 'e');
  await page.getByRole('button', { name: 'Commit request and reveal' }).click();
  assert.match(await page.locator('.study-panel').innerText(), /Text-only route/);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const json = JSON.parse(await page.locator('#export-json').inputValue());
  assert.equal(json.session.imaging_route, 'text_only');
  assert.equal(json.released_content.investigations[0].route_encountered, 'text_only');
});

test('Refresh after interpretation restores gates, versions and drafts (AT23)', async () => {
  const { page } = await open();
  await start(page);
  await initialAssessment(page);
  await study(page, 'Lumbar MRI', { stopAfterInterpretation: true });
  await page.getByRole('button', { name: 'Back to investigations' }).click();
  await page.getByRole('button', { name: 'Request Lumbar CT', exact: true }).click();
  await page.fill('#drawer-rationale', 'r');
  await page.fill('#drawer-expectation', 'e');
  await page.getByRole('button', { name: 'Commit request and reveal' }).click();
  await page.fill('#interp-lumbar_ct', 'Half-written draft');
  const before = await log(page);
  await page.reload();
  const s = await state(page);
  assert.equal(s.stage, 'N2.workup');
  assert.ok(s.investigations.lumbar_mri.report, 'MRI report remains released');
  assert.equal(s.investigations.lumbar_ct.report, null, 'CT report remains locked');
  const after = await log(page);
  assert.deepEqual(after.slice(0, before.length).map((e) => e.event_id), before.map((e) => e.event_id));
  await page.getByRole('button', { name: 'Open Lumbar CT' }).click();
  assert.equal(await page.locator('#interp-lumbar_ct').inputValue(), 'Half-written draft');
});

test('Persistence failure prevents an unrecorded reveal (AT24)', async () => {
  const { page } = await open();
  await start(page);
  await initialAssessment(page);
  await page.getByRole('button', { name: 'Help' }).click();
  await page.getByText('Developer review tools').click();
  await page.getByRole('button', { name: 'Simulate a storage failure on the next save' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Request Lumbar MRI', exact: true }).click();
  await page.fill('#drawer-rationale', 'r');
  await page.fill('#drawer-expectation', 'e');
  await page.getByRole('button', { name: 'Commit request and reveal' }).click();
  assert.match(await page.locator('.drawer').innerText(), /could not be saved, so nothing was released/);
  assert.equal((await state(page)).investigations.lumbar_mri, undefined);
  await page.getByRole('button', { name: 'Commit request and reveal' }).click();
  assert.ok((await state(page)).investigations.lumbar_mri.series);
});

test('Restart creates a distinct session and preserves the prior record (AT27)', async () => {
  const { page } = await open();
  await start(page);
  await initialAssessment(page);
  const first = (await state(page)).sessionId;
  await page.getByRole('button', { name: 'Exit' }).click();
  await page.getByRole('button', { name: 'Leave encounter' }).click();
  await start(page);
  const second = (await state(page)).sessionId;
  assert.notEqual(first, second);
  await page.getByRole('button', { name: 'Exit' }).click();
  await page.getByRole('button', { name: 'Leave encounter' }).click();
  assert.equal(await page.locator('table.sessions tbody tr').count(), 2);
});

test('Demonstration session is separate and labelled', async () => {
  const { page } = await open();
  await page.getByRole('button', { name: 'Open demonstration session' }).click();
  assert.match(await page.locator('.banner-demo').innerText(), /Demonstration session/);
  const s = await state(page);
  assert.equal(s.sessionKind, 'demonstration');
  assert.equal(s.stage, 'N5.debrief');
});

for (const vp of [
  { name: 'desktop 1280', width: 1280, height: 800 },
  { name: 'tablet landscape 1024', width: 1024, height: 768 },
]) {
  test(`AT31 keyboard-only start, assessment, request and interpretation at ${vp.name}`, async () => {
    const { page, errors } = await open({ width: vp.width, height: vp.height });
    const tabTo = async (predicate, max = 80) => {
      for (let i = 0; i < max; i++) {
        await page.keyboard.press('Tab');
        if (await page.evaluate(predicate)) return;
      }
      throw new Error('focus target not reached by Tab');
    };
    await tabTo(() => document.activeElement?.textContent === 'Start patient encounter');
    await page.keyboard.press('Enter');
    for (let i = 0; i < 8; i++) {
      await tabTo(() => document.activeElement?.type === 'checkbox' && !document.activeElement.checked, 6);
      await page.keyboard.press('Space');
    }
    await tabTo(() => document.activeElement?.type === 'radio', 6);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await tabTo(() => document.activeElement?.textContent === 'I agree to take part. Start the session', 6);
    await page.keyboard.press('Enter');
    await tabTo(() => document.activeElement?.id === 'n1-pr');
    await page.keyboard.type('Keyboard problem representation');
    await tabTo(() => document.activeElement?.id === 'n1-h-0');
    await page.keyboard.type('Keyboard hypothesis');
    await tabTo(() => document.activeElement?.id === 'n1-prio');
    await page.keyboard.type('Keyboard priorities');
    await tabTo(() => document.activeElement?.id === 'n1-conf');
    await page.keyboard.press('ArrowRight');
    await tabTo(() => document.activeElement?.textContent === 'Commit initial assessment');
    await page.keyboard.press('Enter');
    await tabTo(() => document.activeElement?.textContent === 'Confirm and commit', 5);
    await page.keyboard.press('Enter');
    await tabTo(() => document.activeElement?.getAttribute('aria-label') === 'Request EMG and nerve conduction studies');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'drawer-rationale', 'focus moves into the drawer');
    await page.keyboard.type('Keyboard rationale');
    await page.keyboard.press('Tab');
    await page.keyboard.type('Keyboard expectation');
    await tabTo(() => document.activeElement?.textContent === 'Commit request and reveal', 10);
    await page.keyboard.press('Enter');
    await tabTo(() => document.activeElement?.id === 'interp-emg_ncs');
    await page.keyboard.type('Keyboard interpretation');
    await tabTo(() => document.activeElement?.textContent === 'Commit interpretation', 10);
    await page.keyboard.press('Enter');
    const s = await state(page);
    assert.equal(s.investigations.emg_ncs.interpretations[0].text, 'Keyboard interpretation');
    if (vp.width === 1024) await page.screenshot({ path: `${SHOTS}17-tablet-1024.png` });
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'study-emg_ncs-title', 'focus returns to the study after commit');
    // focus is visible on keyboard-focused controls
    await page.keyboard.press('Tab');
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
    assert.notEqual(outline, 'none');
    assert.deepEqual(errors, []);
  });
}

test('Image viewer keyboard navigation and full workflow at 1440', async () => {
  const { page } = await open();
  await start(page);
  await initialAssessment(page);
  await page.getByRole('button', { name: 'Request Lumbar MRI', exact: true }).click();
  await page.fill('#drawer-rationale', 'r');
  await page.fill('#drawer-expectation', 'e');
  await page.getByRole('button', { name: 'Commit request and reveal' }).click();
  await page.locator('.viewer-stage').first().focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('+');
  assert.match(await page.locator('.viewer-overlay.tr').first().innerText(), /Frame 3\/14/);
  await page.selectOption('#viewer-series', { label: 'Axial T2, L4-L5' });
  assert.match(await page.locator('.viewer-overlay.tr').first().innerText(), /Frame 1\/18/);
  await page.screenshot({ path: `${SHOTS}05-image-viewer-locked-report.png` });
  // Report tab is locked before interpretation
  await page.getByRole('tab', { name: /Report/ }).click({ force: true });
  assert.match(await page.locator('.locked-note').innerText(), /opens after you commit your own interpretation/);
  const html = await page.locator('#center').innerHTML();
  assert.ok(!/58 mm|stenosis|spondylolisthesis/i.test(html), 'no hidden report text or aria labels before interpretation');
});
