import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/* Lint what this repo tracks, not what git ignores. envs/ holds a copy of every product it
 * evaluates (envs/<env>/app), each harness's node_modules, browser profiles and build output,
 * and the .gitignore files that exclude them are nested inside envs/. Linting the tree without
 * them reported 21,055 errors, every one of them in a gitignored file. git lists the ignored
 * paths itself, so the nested .gitignore files stay the one definition. */
const ROOT = dirname(fileURLToPath(import.meta.url));
let gitIgnored = [];
try {
  gitIgnored = execFileSync("git", ["ls-files", "--others", "--ignored", "--exclude-standard", "--directory"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
    .split("\n")
    .filter(Boolean)
    .map((p) => p.replace(/[*?[\]{}()!]/g, "\\$&"))
    .map((p) => (p.endsWith("/") ? `${p}**` : p));
} catch {
  // Not a git checkout: the fixed list below still covers the build output.
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Build output from opennextjs-cloudflare and wrangler, and any dist bundle.
    ".open-next/**",
    ".wrangler/**",
    "dist/**",
    ".venv/**",
    ...gitIgnored,
  ]),
]);

export default eslintConfig;
