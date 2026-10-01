#!/usr/bin/env node
/* SIMPLE VIEW CHECK at 1440. Drives the running dev server with bundled Chromium and fails
 * closed. Phone overflow is scripts/mobile-gate.mjs, which measures and never photographs.
 *
 *   node scripts/verify-simple-view.mjs [base] [shotDir]
 *
 * Every page carries the safe-chrome click guard, so an anchor to mail never hands off to another
 * app. Requests that would write anywhere (CONFIG.mocks) are answered by a fixture and never
 * leave the browser. */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { guardPlaywrightPage } from '/Users/admin/CompoundLabs/compound-ops/tools/lib/safe-chrome.mjs';
import CONFIG from './simple-view.config.mjs';

const require = createRequire('/Users/admin/CompoundLabs/compound-ops/package.json');
const { chromium } = require('playwright');

const BASE = process.argv[2] || CONFIG.base;
const SHOTS = process.argv[3] || '';
const fails = [];
const oks = [];
const check = (ok, what) => (ok ? oks : fails).push(what);

const browser = await chromium.launch({ args: ['--mute-audio'] });
const open = async (ctx) => {
  const page = await guardPlaywrightPage(await ctx.newPage());
  for (const m of CONFIG.mocks || []) {
    await page.route(m.match, (route) => route.fulfill({ status: m.status || 200, contentType: m.contentType || 'application/json', body: m.raw ?? JSON.stringify(m.body) }));
  }
  return page;
};
const shot = async (page, name, opts = {}) => {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${CONFIG.product}-${name}.png`), fullPage: true, ...opts });
};
const settle = (page) => page.waitForTimeout(600);
const isOpen = (page) => page.locator('dialog.sv-welcome').evaluate((d) => d.open);
const DESKTOP = { width: 1440, height: 900 };
const go = (page, url) => page.goto(`${BASE}${url}`, { waitUntil: 'networkidle', timeout: 90000 });
const withq = (r, q) => `${r}${r.includes('?') ? '&' : '?'}${q}`;
const counts = (page) => page.evaluate(() => [
  document.querySelectorAll('header:not(dialog header)').length,
  document.querySelectorAll('main').length,
  document.querySelectorAll('footer:not(dialog footer)').length,
].join());

/* 1. A clean visitor: Console, welcome open on `/`. */
{
  const ctx = await browser.newContext({ viewport: DESKTOP });
  const page = await open(ctx);
  await go(page, '/');
  await settle(page);
  check(await page.locator('[data-view="console"]').count() === 1, 'clean visitor gets Console');
  check(await isOpen(page), 'welcome opens by itself on /');
  check((await page.locator('dialog.sv-welcome').textContent()).includes('ILLUSTRATION'), 'welcome carries a labelled illustration');
  await shot(page, 'welcome-1440', { fullPage: false });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  check(!(await isOpen(page)), 'Escape closes the welcome');
  check(await page.locator('[data-view="console"]').count() === 1, 'closing does not change the view');
  check(await page.locator('.sv-tools').count() === 1, 'Console footer carries the view controls');
  await shot(page, 'console-1440');

  await page.locator('.sv-tools button', { hasText: 'Start here' }).click();
  await page.waitForTimeout(400);
  check(await isOpen(page), 'Start here reopens the welcome');
  await page.mouse.click(8, 8);
  await page.waitForTimeout(400);
  check(!(await isOpen(page)), 'backdrop click closes the welcome');

  await page.locator('.sv-tools button', { hasText: 'Start here' }).click();
  await page.waitForTimeout(400);
  await page.locator('.sv-welcome-foot input').check();
  await page.locator('.sv-choices button', { hasText: 'Simple' }).click();
  await page.waitForTimeout(400);
  check(await page.locator('[data-view="simple"]').count() === 1, 'choosing Simple switches the page');
  await page.reload({ waitUntil: 'networkidle' });
  await settle(page);
  check(!(await isOpen(page)), 'suppression survives a reload');
  check(await page.locator('[data-view="simple"]').count() === 1, 'saved Simple survives a reload');
  const second = CONFIG.routes[0];
  await go(page, withq(second, 'x=1'));
  await settle(page);
  check(await page.locator('[data-view="simple"]').count() === 1, `saved Simple survives route navigation to ${second}`);
  await go(page, withq(second, 'view=console&x=1'));
  await settle(page);
  check(await page.locator('[data-view="console"]').count() === 1, 'URL view overrides the saved view');
  await page.locator('.sv-tools button', { hasText: 'Simple' }).click();
  await settle(page);
  const u = new URL(page.url());
  check(u.searchParams.get('view') === 'simple' && u.searchParams.get('x') === '1', 'switching rewrites view in place and keeps other params');
  check(await counts(page) === '1,1,1', `one header, main and footer on Simple ${second} (${await counts(page)})`);
  await ctx.close();
}

/* 2. The Simple home, its action, its example and every adapted route. */
{
  const ctx = await browser.newContext({ viewport: DESKTOP });
  const page = await open(ctx);
  await go(page, '/?view=simple&welcome=0');
  await settle(page);
  check(!(await isOpen(page)), 'welcome=0 skips the automatic welcome');
  check(await counts(page) === '1,1,1', `one header, main and footer on Simple / (${await counts(page)})`);
  const h1 = await page.locator('h1').first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  check(h1 >= 40, `Simple h1 is ${h1}px`);
  const box = await page.locator('#start').boundingBox();
  check(box && box.y < 900, 'the action card starts in the first screen');
  const field = page.locator('#start input:not([type=hidden]):not([tabindex="-1"]):not([type=checkbox]), #start .sv-command').first();
  if (await field.count()) {
    const px = await field.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    check(px >= 16, `action field is ${px}px`);
  }
  await shot(page, 'simple-1440');

  const dis = page.locator('.sv-result .sv-disclosure > button').first();
  await dis.click();
  await page.waitForTimeout(450);
  check(await dis.getAttribute('aria-expanded') === 'true', 'disclosure exposes aria-expanded');
  const ctl = await dis.getAttribute('aria-controls');
  const body = page.locator(`[id="${ctl}"]`);
  check(!(await body.evaluate((e) => e.inert)), 'an open disclosure body is not inert');
  check(await body.evaluate((e) => getComputedStyle(e).opacity) === '1', 'open body is painted at full opacity');
  await shot(page, 'simple-example-open-1440');
  const closed = page.locator('.sv-disclosure > button[aria-expanded="false"]').first();
  if (await closed.count()) {
    const cid = await closed.getAttribute('aria-controls');
    check(await page.locator(`[id="${cid}"]`).evaluate((e) => e.inert), 'a closed disclosure body is inert');
  }
  check(await page.locator('select').count() === 0, 'no native select on Simple /');

  if (CONFIG.action) await CONFIG.action({ page, check, shot, go, settle });

  for (const r of CONFIG.routes) {
    await go(page, withq(r, 'view=simple'));
    await settle(page);
    const c = await counts(page);
    check(await page.locator('.sv-nav').count() === 1 && c === '1,1,1', `Simple ${r} has Simple chrome only (${c})`);
    check(await page.locator('select').count() === 0, `no native select on Simple ${r}`);
    const name = r.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/-+$/, '');
    await shot(page, `simple-${name}-1440`);
  }
  await go(page, '/no-such-page-here?view=simple');
  await settle(page);
  check(await page.locator('.sv-nav').count() === 1, 'Simple 404 has Simple chrome');
  await shot(page, 'simple-404-1440');
  await ctx.close();
}

await browser.close();
for (const o of oks) process.stdout.write(`  ok    ${o}\n`);
for (const f of fails) process.stdout.write(`  FAIL  ${f}\n`);
process.stdout.write(`\n${oks.length} held, ${fails.length} refused\n`);
process.exit(fails.length ? 1 : 0);
