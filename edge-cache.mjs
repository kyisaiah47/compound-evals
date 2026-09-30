// Answers repeat page requests from Cloudflare's edge cache before the Next.js handler starts.
// A cache hit costs about 1 ms of Worker CPU; a full OpenNext request costs 50 to 155 ms
// (measured 2026-09-30 across the account), and Workers Paid bills CPU over 30M ms a month.
//
// Canonical copy: compound-ops/lib/edge-cache.mjs. Each product repo carries a byte copy,
// because wrangler bundles from the repo and a deploy must not depend on a sibling checkout.
//
// Only a response the site already marked public is stored: a 200 to a plain GET with no query
// string, no cookie, no auth header and no Next.js navigation header, carrying s-maxage and no
// Set-Cookie. The key carries the deployed version id, so a deploy never serves a page that
// points at the previous build's chunks. With no version binding nothing is cached.

const BYPASS_HEADERS = [
  "cookie",
  "authorization",
  "rsc",
  "next-router-prefetch",
  "next-router-state-tree",
  "next-router-segment-prefetch",
  "next-action",
  "next-url",
];

const MAX_TTL = 86400;

// The $5 ceiling (Isaiah, 2026-09-30: "5 is fine but dont go higher"). costs/cloudflare-budget.mjs
// writes "1" to the BUDGET KV key "shed" when the month is on pace to pass the Workers Paid
// allowance. While it reads "1", a third-party crawler that misses the cache gets a 503 instead
// of a full render. Search engines, link-preview fetchers and people are never shed.
const CRAWLER = /bot|crawl|spider|slurp|scrapy|python-requests|go-http-client|httpclient|ahrefs|semrush|mj12|petal|bytespider|gptbot|claude|perplexity|ccbot|amazonbot|meta-external/i;
const ALWAYS_SERVED = /googlebot|google-inspectiontool|bingbot|duckduckbot|applebot|yandexbot|twitterbot|facebookexternalhit|linkedinbot|slackbot|discordbot|telegrambot|whatsapp|pinterest|redditbot|embedly|iframely/i;

// Stage "2" also sheds headless browsers and HTTP libraries, which is the estate's own sweeps.
const ROBOT = /headlesschrome|curl\/|node-fetch|undici|playwright|puppeteer|wget/i;

async function shed(request, env) {
  const ua = request.headers.get("user-agent") || "";
  if (!env?.BUDGET || ALWAYS_SERVED.test(ua)) return false;
  const crawler = CRAWLER.test(ua);
  const robot = ROBOT.test(ua) || !ua;
  if (!crawler && !robot) return false;
  try {
    const level = await env.BUDGET.get("shed", { cacheTtl: 300 });
    return (level === "1" && crawler) || level === "2";
  } catch {
    return false;
  }
}

const SHED_RESPONSE = () =>
  new Response("503: crawl paused, retry later\n", {
    status: 503,
    headers: { "retry-after": "3600", "content-type": "text/plain", "cache-control": "no-store" },
  });

function ttlOf(res) {
  if (res.status !== 200 || res.headers.has("set-cookie")) return 0;
  const cc = (res.headers.get("cache-control") || "").toLowerCase();
  if (/(^|,)\s*(private|no-store|no-cache)/.test(cc)) return 0;
  const m = cc.match(/s-maxage=(\d+)/);
  return m ? Math.min(Number(m[1]), MAX_TTL) : 0;
}

export function withEdgeCache(fetchHandler) {
  return async function fetch(request, env, ctx) {
    const version = env?.CF_VERSION_METADATA?.id;
    const url = new URL(request.url);
    const isPageGet = request.method === "GET" && !url.pathname.startsWith("/api/");
    if (
      !version ||
      typeof caches === "undefined" ||
      !isPageGet ||
      url.search ||
      BYPASS_HEADERS.some((h) => request.headers.has(h))
    ) {
      if (isPageGet && (await shed(request, env))) return SHED_RESPONSE();
      return fetchHandler(request, env, ctx);
    }

    const key = new Request(`${url.origin}${url.pathname}?__edge=${version}`, { method: "GET" });
    const cache = caches.default;
    const hit = await cache.match(key);
    if (hit) return hit;
    if (await shed(request, env)) return SHED_RESPONSE();

    const res = await fetchHandler(request, env, ctx);
    const ttl = ttlOf(res);
    if (ttl > 0) {
      const stored = new Response(res.clone().body, res);
      stored.headers.set("cache-control", `public, max-age=0, s-maxage=${ttl}`);
      ctx.waitUntil(cache.put(key, stored).catch(() => {}));
    }
    return res;
  };
}
