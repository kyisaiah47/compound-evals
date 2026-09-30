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
    if (
      !version ||
      typeof caches === "undefined" ||
      request.method !== "GET" ||
      url.search ||
      url.pathname.startsWith("/api/") ||
      BYPASS_HEADERS.some((h) => request.headers.has(h))
    ) {
      return fetchHandler(request, env, ctx);
    }

    const key = new Request(`${url.origin}${url.pathname}?__edge=${version}`, { method: "GET" });
    const cache = caches.default;
    const hit = await cache.match(key);
    if (hit) return hit;

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
