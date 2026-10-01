#!/usr/bin/env node
/* PHONE OVERFLOW GATE for the Simple view. Measures only: it takes no screenshot at any width.
 *
 *   node scripts/mobile-gate.mjs [base]
 *
 * Fails when a Simple route scrolls sideways at 390, or when the welcome dialog does not fit the
 * viewport and scroll inside itself. */
import { createRequire } from 'node:module';
import { guardPlaywrightPage } from '/Users/admin/CompoundLabs/compound-ops/tools/lib/safe-chrome.mjs';
import CONFIG from './simple-view.config.mjs';

const require = createRequire('/Users/admin/CompoundLabs/compound-ops/package.json');
const { chromium } = require('playwright');

const BASE = process.argv[2] || CONFIG.base;
const fails = [];
const oks = [];
const check = (ok, what) => (ok ? oks : fails).push(what);

const browser = await chromium.launch({ args: ['--mute-audio'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await guardPlaywrightPage(await ctx.newPage());
const withq = (r, q) => `${r}${r.includes('?') ? '&' : '?'}${q}`;
for (const r of ['/', ...CONFIG.routes]) {
  await page.goto(`${BASE}${withq(r, 'view=simple&welcome=0')}`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(500);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(over <= 0, `Simple ${r} does not overflow at 390 (${over}px)`);
}
await page.goto(`${BASE}/?view=console`, { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForTimeout(600);
const fits = await page.locator('dialog.sv-welcome').evaluate((d) => d.open && d.getBoundingClientRect().height <= window.innerHeight && d.scrollWidth <= d.clientWidth + 1);
check(fits, 'the welcome fits the phone viewport and scrolls inside it');
await browser.close();
for (const o of oks) process.stdout.write(`  ok    ${o}\n`);
for (const f of fails) process.stdout.write(`  FAIL  ${f}\n`);
process.stdout.write(`\n${oks.length} held, ${fails.length} refused\n`);
process.exit(fails.length ? 1 : 0);
