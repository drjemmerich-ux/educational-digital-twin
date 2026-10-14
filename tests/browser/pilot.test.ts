// Pilot (server) mode in a real browser: facilitator creates a personal link, the participant
// completes the reference B1 course through the UI with every command executed by the server
// handler, reloads mid-session, and the facilitator exports the record.
// Runs against dist-web built with EDT_API_URL=/api and the local dev server (same handler as the
// Supabase Edge Function, in-memory store).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium, type Browser, type Page } from 'playwright';
import { startDevServer } from '../../scripts/dev-server.ts';
import type { MemoryStore } from '../../src/server/memoryStore.ts';

const SHOTS = new URL('../../docs/screenshots/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
let browser: Browser;
let base = '';
let store: MemoryStore;
let facKey = '';
let close: () => void = () => undefined;

before(async () => {
  const s = await startDevServer(0);
  base = s.url;
  store = s.store;
  facKey = s.facilitatorKey;
  close = () => s.server.close();
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  close();
});

async function open(url: string) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(url);
  return { page, context, errors };
}

const confirm = async (page: Page, label: string) => {
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.getByRole('button', { name: 'Confirm and commit' }).click();
};
const setConfidence = async (page: Page, id: string) => {
  await page.locator(`#${id}`).focus();
  await page.keyboard.press('ArrowRight');
};

async function facilitatorLink(label: string): Promise<{ link: string; code: string }> {
  const { page, context } = await open(`${base}/facilitator.html`);
  await page.fill('#fac-key', facKey);
  await page.getByRole('button', { name: 'Open facilitator view' }).click();
  await page.fill('#fac-label', label);
  await page.getByRole('button', { name: 'Create link' }).click();
  const link = await page.locator('.link-field').inputValue();
  const code = (await page.locator('.created-link .code-chip').innerText()).trim();
  await context.close();
  return { link, code };
}

async function study(page: Page, title: string) {
  await page.getByRole('button', { name: `Request ${title}`, exact: true }).click();
  await page.fill('#drawer-rationale', `Why ${title}`);
  await page.fill('#drawer-expectation', `Expect ${title}`);
  await page.getByRole('button', { name: 'Commit request and reveal' }).click();
  const id = await page.locator('.study-panel textarea[id^="interp-"]').first().getAttribute('id');
  const imaging = await page.getByRole('tab', { name: /Images/ }).count();
  await page.fill(`#${id}`, `My interpretation of ${title}`);
  await page.getByRole('button', { name: imaging ? 'Commit interpretation and open report' : 'Commit interpretation' }).click();
  const form = page.locator('.task-block', { hasText: 'Update your working model' });
  await form.getByRole('radio', { name: 'Supports' }).check();
  await form.getByRole('radio', { name: 'Maintain my current working model' }).check();
  await form.getByRole('radio', { name: 'No' }).check();
  await confirm(page, 'Commit model update');
  await page.getByRole('button', { name: 'Back to investigations' }).click();
}

test('PIL01 without a personal link the page explains how to enter; a bad link is refused', async () => {
  const a = await open(`${base}/`);
  await a.page.getByRole('heading', { name: 'Personal link required' }).waitFor();
  const b = await open(`${base}/#t=${'x'.repeat(43)}`);
  await b.page.getByRole('heading', { name: 'This link cannot be opened' }).waitFor();
  assert.match(await b.page.locator('main').innerText(), /not valid or has been disabled/);
  await a.context.close();
  await b.context.close();
});

test('PIL02 the participant bundle served by the pilot contains no hidden case content', async () => {
  const html = await (await fetch(`${base}/`)).text();
  for (const t of ['pseudomeningocele', 'Elena Marsh', '48 mm transverse', '900 m', 'No re-exploration was performed', '118 HU']) {
    assert.ok(!html.includes(t), `served page contains "${t}"`);
  }
  const src = readFileSync(new URL('../../dist-web/index.html', import.meta.url), 'utf8');
  assert.equal(src, html);
});

test('PIL03 reference B1 through the server: link, consent, reload mid-session, completion, facilitator export', async () => {
  const { link, code } = await facilitatorLink('Fellow 01');
  assert.match(link, /#t=[A-Za-z0-9_-]{40,}$/);
  const { page, context, errors } = await open(link);
  await page.getByRole('button', { name: 'Start patient encounter' }).click();
  assert.match(await page.locator('main').innerText(), new RegExp(`Your participant code is\\s*${code}`));
  const boxes = page.locator('.consent-list input[type="checkbox"]');
  for (let i = 0; i < (await boxes.count()); i++) await boxes.nth(i).check();
  await page.getByRole('radio', { name: 'Fellow' }).check();
  await page.getByRole('button', { name: 'I agree to take part. Start the session' }).click();
  await page.locator('.chart-id').waitFor();
  assert.match(await page.locator('.chart-id').innerText(), /Elena Marsh/);
  await page.getByText('Saved on the study server').waitFor();
  await page.screenshot({ path: `${SHOTS}P1-pilot-initial-assessment.png` });

  await page.fill('#n1-pr', 'Learner problem representation');
  await page.fill('#n1-h-0', 'Learner hypothesis one');
  await page.fill('#n1-prio', 'Learner priorities');
  await setConfidence(page, 'n1-conf');
  await confirm(page, 'Commit initial assessment');
  await study(page, 'Lumbar MRI');

  // Reload mid-session: the record comes back from the server.
  const before = await page.evaluate(() => (window as unknown as { __edt: { gateway: { log: unknown[] } } }).__edt.gateway.log.length);
  await page.reload();
  await page.getByRole('button', { name: 'Continue encounter' }).click();
  await page.getByRole('button', { name: 'Request Flexion and extension lateral radiographs', exact: true }).waitFor();
  const after = await page.evaluate(() => (window as unknown as { __edt: { gateway: { log: unknown[]; state: { investigations: Record<string, unknown> } } } }).__edt.gateway.log.length);
  assert.equal(after, before, 'reloading reads the record back from the server without adding events');

  await study(page, 'Flexion and extension lateral radiographs');
  await page.getByRole('button', { name: 'I have enough information to formulate a management plan' }).click();
  await page.fill('#n2-integrated', 'Integrated model');
  await setConfidence(page, 'n2-conf');
  await page.getByRole('checkbox').check();
  await confirm(page, 'Commit and continue to management');
  await page.getByRole('radio', { name: 'Decompression alone' }).check();
  await page.fill('#n3-summary', 'My plan');
  await setConfidence(page, 'n3-conf');
  await confirm(page, 'Commit recommendation');
  await page.getByRole('button', { name: 'I understand. Continue with the predefined course' }).click();
  await page.getByRole('button', { name: 'Continue the procedure' }).click();
  await page.fill('#n4-immediate', 'My intraoperative proposal');
  await confirm(page, 'Commit proposal');
  await page.getByRole('button', { name: "Show the team's action" }).click();
  await page.getByRole('button', { name: 'Advance to postoperative day 1' }).click();
  await page.getByRole('button', { name: 'Advance to postoperative day 3' }).click();
  await page.fill('#pod3-pr', 'Postoperative problem');
  await page.fill('#pod3-dd-0', 'Explanation one');
  await page.fill('#pod3-prio', 'Priorities');
  await setConfidence(page, 'pod3-conf');
  await confirm(page, 'Commit reassessment');
  await study(page, 'Lumbar MRI (postoperative)');
  await page.getByRole('button', { name: 'I am ready to commit a management plan' }).click();
  await page.fill('#postop-plan', 'My postoperative plan');
  await setConfidence(page, 'postop-conf');
  await confirm(page, 'Commit plan');
  await page.getByRole('radio', { name: 'Lumbar CSF drainage' }).check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm action' }).click();
  await page.getByRole('button', { name: 'Advance through the prescribed drainage period' }).click();
  await page.getByRole('button', { name: 'Continue to follow-up' }).click();
  for (const v of ['900 m', '3/10', '2/10', '24%', '5/5']) assert.ok((await page.locator('.outcome-table').innerText()).includes(v), v);
  await page.getByRole('button', { name: 'Continue to the debrief' }).click();
  await page.getByRole('tab', { name: /Metrics and reflection/ }).click();
  await page.fill('#refl-r1', 'Reflection text');
  await page.getByRole('button', { name: 'Commit reflection' }).click();
  await page.getByRole('button', { name: 'Finish session' }).click();
  await page.screenshot({ path: `${SHOTS}P2-pilot-debrief.png` });

  const gw = await page.evaluate(() => {
    const g = (window as unknown as { __edt: { gateway: { log: { sequence: number }[]; state: { status: string; stage: string } } } }).__edt.gateway;
    return { n: g.log.length, status: g.state.status, stage: g.state.stage };
  });
  assert.equal(gw.status, 'completed');
  const stored = [...store.sessions.values()].find((s) => s.participant_code === code)!;
  assert.equal(stored.status, 'completed');
  assert.equal(store.events.get(stored.session_id)!.length, gw.n, 'server record equals the participant trace');
  assert.equal(stored.training_level, 'fellow');
  assert.deepEqual(errors, []);
  await context.close();

  // Facilitator sees the completed encounter and downloads the record.
  const fac = await open(`${base}/facilitator.html`);
  await fac.page.fill('#fac-key', facKey);
  await fac.page.getByRole('button', { name: 'Open facilitator view' }).click();
  const row = fac.page.locator('tr', { hasText: code }).last();
  await row.getByText('Completed').waitFor();
  await fac.page.screenshot({ path: `${SHOTS}P3-facilitator.png`, fullPage: true });
  const [download] = await Promise.all([fac.page.waitForEvent('download'), row.getByRole('button', { name: 'Download JSON' }).click()]);
  const exported = JSON.parse(readFileSync((await download.path())!, 'utf8'));
  assert.equal(exported.events.length, gw.n);
  assert.equal(exported.session.completion_status, 'clinical_pathway_completed');
  assert.equal(exported.session.participant_code, code);
  await fac.context.close();
});

test('PIL04 a disabled link stops access; the participant sees a clear message', async () => {
  const { link } = await facilitatorLink('Fellow 02');
  const fac = await open(`${base}/facilitator.html`);
  await fac.page.fill('#fac-key', facKey);
  await fac.page.getByRole('button', { name: 'Open facilitator view' }).click();
  await fac.page.locator('tr', { hasText: 'Fellow 02' }).getByRole('button', { name: 'Disable link' }).click();
  await fac.page.locator('tr', { hasText: 'Fellow 02' }).getByRole('button', { name: 'Enable link' }).waitFor();
  const p = await open(link);
  await p.page.getByRole('heading', { name: 'This link cannot be opened' }).waitFor();
  await fac.context.close();
  await p.context.close();
});

test('PIL05 a wrong facilitator key is refused and nothing is listed', async () => {
  const { page, context } = await open(`${base}/facilitator.html`);
  await page.fill('#fac-key', 'fk_wrong');
  await page.getByRole('button', { name: 'Open facilitator view' }).click();
  await page.getByText('The facilitator key is not valid.').waitFor();
  assert.equal(await page.locator('table').count(), 0);
  await context.close();
});
