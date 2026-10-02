'use client';

import { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import type { PostHog } from 'posthog-js';

/* POSTHOG IS FETCHED AFTER HYDRATION, NEVER BUNDLED INTO THE CRITICAL PATH.
 *
 * Measured on stacktab 2026-09-20, brotli over the wire: the page cost 427,277 bytes and chunk
 * b468fba8 was 93,453 of them, 291 KB raw, and it was posthog-js. It was a static top level
 * import, so every visitor downloaded and parsed the whole analytics SDK before the page could
 * run, to send a pageview that does not fire until after mount anyway. The same static import
 * was in 48 other repos, this one among them.
 *
 * NOTHING MAY BE DROPPED ON THE WAY. Every Compound site is analytics checked daily and a
 * product that reports no traffic reads as dead rather than as unmeasured, so the import cannot
 * simply be moved behind a flag that races the first pageview. init() returns the one promise
 * every caller awaits. The pageview effect awaits it before capturing, so the first pageview of
 * a visit waits for the fetch instead of racing a flag. capture() awaits it too, so a click
 * during the fetch is sent when the fetch lands.
 *
 * The one real cost: an exception thrown before the SDK arrives is not captured. Error tracking
 * starts at hydration now rather than at parse. */
let posthog: PostHog | null = null;
let ready: Promise<boolean> | null = null;

// House Compound PostHog project (shared across apps; each app self-labels via the `app`
// property/group). Mirrors packages/analytics in compound-os, trimmed for a marketing + checkout
// site (no auth / demo / dashboard).
//
// ⛔ IT TALKS TO us.i.posthog.com DIRECTLY, AND THE /ingest REVERSE PROXY IS NOT COMING BACK.
// This comment described one until 2026-08-22 and the mechanism had been removed that morning:
// rewriting /ingest/* to PostHog made every analytics beacon a Vercel function invocation, a
// Vercel edge request and Vercel origin transfer in both directions: 458 GB of Fast Origin
// Transfer ($13.04) and 11.1M function invocations ($2.75) on one invoice. The proxy exists to
// stop ad blockers dropping first-party analytics; that is worth something, but it was never
// priced against what it costs on this platform. Do not reinstate it without pricing it first.
//
// GENERATED from demos/roster/templates/Analytics.tsx.tmpl by the analytics-coverage step of
// the 05:20 roster sync. Safe to hand-edit afterwards; the step only ever writes this file
// when it is missing, never over an existing one.
const POSTHOG_KEY = 'phc_uHpxqQHE6veLG48Tv45K3myHfUG7ZGx28dRyFKCVtQox';
const POSTHOG_HOST = 'https://us.i.posthog.com';
const POSTHOG_UI_HOST = 'https://us.posthog.com';

// The roster slug this app was built for. Every event carries it as the `app` property, and
// that property is what the estate digest and analytics dashboard group by.
const APP_SLUG = 'compound-evals';

// host -> clean app slug. Only *.thecompound.tech encodes the slug in the subdomain (the former
// studio domain 308s to it at Cloudflare before any app sees a request). For any other host the subdomain is NOT the
// slug (health.civicbinder.org would resolve to "health", which is not a product), so the
// build-time slug is the answer. local/preview -> "dev" (excluded).
// Mirrored by hostEventSlug() in compound-metrics/aeo/targets.mjs; aeo/test-targets.mjs runs
// this function beside that one.
function appSlugFromHost(host: string): string {
  const bare = host.split(':')[0].toLowerCase();
  if (bare === 'localhost' || bare.endsWith('.localhost') || /^[\d.]+$/.test(bare) || bare.endsWith('.vercel.app')) return 'dev';
  if (bare.endsWith('.thecompound.tech')) return bare.replace(/\.thecompound\.tech$/, '').split('.')[0] || APP_SLUG;
  return APP_SLUG;
}

let initialized = false;
let purchaseFired = false;
let checkoutHooked = false;

/** Fetch and start the SDK, once. Every caller awaits this same promise. */
function init(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (ready) return ready;
  ready = import('posthog-js').then(({ default: ph }) => {
    posthog = ph;
    start(ph);
    return true;
  }).catch(() => false);
  return ready;
}

/** Capture an event, awaiting the SDK. An event fired while the SDK is in flight is sent when
 * the fetch lands instead of being dropped. */
function capture(event: string, props?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  void init().then((ok) => {
    if (!ok || !posthog) return;
    try { posthog.capture(event, props); } catch {}
  });
}

function start(posthog: PostHog) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    ui_host: POSTHOG_UI_HOST,
    capture_pageview: false,
    capture_pageleave: false,
    autocapture: false,
    person_profiles: 'identified_only',
    disable_session_recording: true,
    capture_exceptions: true,
    // Error-tracking noise gate. PostHog's weekly digest was 363 exceptions of which 333 were
    // two browser artifacts no code here can fix - Outlook's SafeLink wrapper ("Object Not
    // Found Matching Id:N, MethodName:update") and the benign ResizeObserver loop notice - and
    // the rest were a dev server's compile errors on localhost. All three drown out real
    // crashes, so they are dropped here, before the request leaves the page.
    //
    // *** IT READS THE WHOLE EVENT. `$exception_values` IS NOT A CLIENT PROPERTY. (2026-08-24)
    //
    // This gate shipped 2026-08-17 testing `event.properties.$exception_values`, and it dropped
    // NOTHING in the week everyone believed it was working. posthog-js sends `$exception_list`
    // (plus `$exception_message` and `$exception_type`); `$exception_values` is a column PostHog
    // MATERIALISES SERVER-SIDE out of that list, so client-side it is `undefined`,
    // `JSON.stringify(undefined ?? EMPTY)` is a pair of quotes, and neither regex ever matched.
    // The 2026-08-23 digest carried 243 SafeLink rejections - its highest count ever - straight
    // through a filter nobody doubted. A gate keyed to a property that does not exist yet fails
    // OPEN and still reads as armed, which is why this now matches against the serialised event
    // instead of one hand-picked key.
    //
    // *** AND IT DROPS EXCEPTIONS THROWN BY DECLARED BOTS. Lightpanda - the open-source headless
    // browser AI agents drive - threw 4,860 exceptions across 2026-08-20..22 on blockdex and
    // rulestack: 86% of that week's digest and the whole 1461% spike. They were React #418
    // hydration mismatches and "Illegal invocation", both artifacts of an incomplete web-API
    // surface rather than defects in this code. crawl-guard now 410s that agent on the URL
    // shapes it was enumerating, and it deliberately still reads content pages - being indexed
    // is the point of a directory. What a crawler must not do is author the error digest.
    // The names are spelled out rather than matched on a bare /bot/, which hits real phones
    // (CUBOT), and this list is a deliberate copy: this file is generated standalone into repos
    // that have no src/lib/crawl-guard to import from.
    before_send: (event) => {
      if (!event || event.event !== '$exception') return event;
      try {
        const host = window.location.host.split(':')[0].toLowerCase();
        if (host === 'localhost' || host.endsWith('.localhost') || /^[\d.]+$/.test(host) || host.endsWith('.vercel.app')) return null;
        const ua = navigator.userAgent || '';
        if (navigator.webdriver) return null;
        if (/lightpanda|headlesschrome|phantomjs|puppeteer|playwright|python-requests|node-fetch|scrapy|curl\/|wget\/|googlebot|bingbot|gptbot|oai-searchbot|chatgpt-user|claudebot|claude-user|perplexitybot|bytespider|amazonbot|applebot|ccbot|petalbot|yandexbot|baiduspider|duckduckbot|semrushbot|ahrefsbot|mj12bot|dotbot|slurp|facebookexternalhit|meta-externalagent/i.test(ua)) return null;
        // The serialised event, not one key: `$exception_list` holds the message client-side
        // today and the shape has already moved once. Matching the blob survives the next move.
        const blob = JSON.stringify(event.properties ?? {});
        if (/Object Not Found Matching Id:\d+/.test(blob)) return null;
        if (/ResizeObserver loop/.test(blob)) return null;
      } catch {
        // a noise gate must never be the thing that breaks a page
      }
      return event;
    },
  });
  initialized = true;
  try {
    const slug = appSlugFromHost(window.location.host);
    posthog.register({ app: slug });
    posthog.group('app', slug, { name: slug });
  } catch {
    // a missing app label must never throw
  }
}

/* THE LISTENERS ARE INSTALLED AT MOUNT, NOT INSIDE posthog.init().
 *
 * They used to run inside init(). With the SDK fetched after hydration that would leave them
 * unregistered until the fetch landed, so a click in that window would not be counted. They
 * capture through the queue above, which sends the event when the SDK arrives. */
function hookListeners() {
  if (typeof document === 'undefined') return;
  // Funnel top: any pricing "buy" click ([data-checkout-tier]) -> checkout_started.
  //
  // ⛔ THE SELECTOR IS THE ATTRIBUTE, NOT THE TAG. (widened 2026-08-02)
  //
  // It used to be `a[data-checkout-tier]`, which silently required every checkout control in the
  // estate to be an anchor. Plenty of them cannot be: a checkout that has to POST (to create a
  // run, to price a tier server-side, to attach a scan) is a <button>, and CiteRank shipped one
  // carrying `data-checkout-tier` faithfully while never matching this listener once. So
  // `checkout_started` had NEVER FIRED there, and the estate's funnel-depth report read it as a
  // product nobody had ever tried to pay for. That is not a missing metric, it is a metric that
  // reads as a business fact and is not one.
  //
  // Dropping the `a` makes the data attribute the contract, which is the thing a component
  // author can actually be asked to remember. `closest` still walks up from the click target, so
  // an icon or a <span> inside the control matches too.
  if (!checkoutHooked) {
    checkoutHooked = true;
    document.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement)?.closest?.('[data-checkout-tier]') as HTMLElement | null;
      if (el) {
        try { capture('checkout_started', { tier: el.getAttribute('data-checkout-tier') }); } catch {}
      }
    });
  }
}

function Tracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => { hookListeners(); }, []);

  useEffect(() => {
    if (!pathname) return;
    let cancelled = false;
    /* The pageview AWAITS the SDK rather than testing a flag. With a static import
     * `initialized` was already true by the time this ran. With a fetch it is not, and an
     * early return here would silently drop the first pageview of every visit. */
    void init().then((ok) => {
      if (!ok || cancelled || !posthog) return;

        // First-touch UTM attribution. It rides on every later event (incl. checkout/purchase).
        const utm: Record<string, string> = {};
        for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
          const v = searchParams?.get(k);
          if (v) utm[k] = v;
        }
        if (Object.keys(utm).length) {
          posthog.register_once(utm);
          posthog.setPersonProperties(undefined, utm);
        }

        let url = window.location.origin + pathname;
        const qs = searchParams?.toString();
        if (qs) url += `?${qs}`;
        posthog.capture('$pageview', { $current_url: url, $host: window.location.host });

        /* Purchase: Stripe checkout success returns to /?paid=1 (api/checkout success_url).
         * Fire once per load so a refresh can't double-count.
         *
         * ⛔ `?paid=1` IS A TYPEABLE STRING, SO THIS EVENT IS NOT EVIDENCE ON ITS OWN. (2026-08-20)
         *
         * Anyone who loads `<host>/?paid=1` mints a `purchase_completed` with no Stripe object behind
         * it, and `purchase_completed` is the deepest rung of the estate's funnel-depth report. That
         * is a metric which reads as a business fact and can be authored by a stranger with an address
         * bar: the same class of defect as the `checkout_started` selector that never matched, and
         * the reason that comment above exists.
         *
         * It is NOT fixed by tightening the condition here, because `?paid=1` is what every shipped
         * `api/checkout` success_url currently sends back; requiring anything stronger today would
         * silently zero real revenue across the estate. So the event still fires, and instead it now
         * CARRIES ITS OWN PROVENANCE:
         *
         *   verified: 'session'  a Stripe-generated `cs_...` id came back; it is unguessable, so this is
         *                        evidence a checkout really happened
         *   verified: 'flag'     a bare `?paid=1` is forgeable, and must be treated as a hint
         *
         * Read `purchase_completed` with `verified = 'session'` when the number has to be true. The
         * real close is `success_url` carrying `{CHECKOUT_SESSION_ID}` on every product, then a
         * server-side retrieve before this fires; until every checkout route does that, the property
         * is what keeps the funnel honest instead of confidently wrong. */
        const sessionId = searchParams?.get('session_id') ?? '';
        const paidFlag = searchParams?.get('paid') === '1';
        if (!purchaseFired && (paidFlag || sessionId)) {
          purchaseFired = true;
          posthog.capture('purchase_completed', {
            app: appSlugFromHost(window.location.host),
            verified: /^cs_[A-Za-z0-9_]+$/.test(sessionId) ? 'session' : 'flag',
          });
        }
    });
    return () => { cancelled = true; };
  }, [pathname, searchParams]);

  return null;
}

export default function Analytics() {
  return (
    <Suspense fallback={null}>
      <Tracker />
    </Suspense>
  );
}
