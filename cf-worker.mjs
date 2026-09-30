// Worker entry: the OpenNext handler behind the edge cache in edge-cache.mjs.
import { default as handler } from "./.open-next/worker.js";
import { withEdgeCache } from "./edge-cache.mjs";

export default { ...handler, fetch: withEdgeCache(handler.fetch) };

export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";
