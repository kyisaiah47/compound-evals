# Compound Evals: Simple view review

Built on `main` on 2026-10-01 for the Simple view rollout, batch 11. Follows
`compound-ops/standards/SIMPLE-VIEW-BLUEPRINT.md` and `simple-view-ref/AGENT-BRIEF.md`. Not
deployed by this work.

## Truth map (blueprint 2.A)

Sources read: `src/lib/data.ts`, `src/data/environments.json` (compiled by
`scripts/build-data.mjs` from `envs/*/results.json`), `src/components/Shell.tsx`, the three routes,
`README.md`, `LICENSE`.

| Field | Value | Source |
| --- | --- | --- |
| Primary user | Someone judging whether an AI agent completes real product tasks | `README.md`, ViewHead copy |
| Problem | A grader that reads the page cannot tell a completed task from a convincing failure | `README.md`, "The one idea" |
| Input | No form. The reader picks an environment | `[product]/page.tsx` |
| Action | Open one environment's task book and scores | new `EnvPicker`, a themed listbox |
| Output | Per task: held, caught or unrun, with the guards and the cheats they refuse | `Task`, `toScore` |
| Free / paid | Free to read. MIT licensed. Nothing is for sale | `LICENSE` |
| Limits | `not_gradable` and open `defects` per environment | `Environment` |
| Failure states | Unrun is never printed as a zero; caught names the refusing guard | `taskState()` |
| Recovery | 404 with links (new `not-found.tsx`, both views) | |
| Shared state | The picked environment is a shared in-memory draft | `EnvPicker.tsx` |

How it differs from CiteRank: there is no request, no result to wait for and no checkout. The
action card holds a themed environment picker. The example is a real recorded score (the first
caught one, else the first held one) with its guards and cheats behind a disclosure.

## Route inventory (blueprint 2.E)

| Route | Class | Simple surface |
| --- | --- | --- |
| `/` | curated home | `SimpleHome`: hero, picker card, a recorded score as the example, the four steps, cost and questions |
| `/environments` | curated readable | `SimpleEnvironments`: every environment as a readable row with its state in words |
| `/[product]` | curated result | `SimpleEnvironment`: each task as a card with its verdict sentence, guards and cheats behind a disclosure, limits |
| 404 | recovery | new `not-found.tsx` with a Console and a Simple composition |

The Console differs only by the footer view controls, plus the new 404 inside its own Shell.

## State

- `compound-evals:view` and `compound-evals:welcome-off` in localStorage, every access in try/catch.
  Valid `?view=` wins, then the saved view, then Console. `?welcome=0` skips one automatic welcome.
- No middleware or crawl guard exists in this tree.

## Verification receipt, 2026-10-01

- `npx tsc --noEmit`: clean. `npm run build`: passes.
- `node scripts/verify-simple-view.mjs http://localhost:3303 <shots>` at 1440: 33 held, 0 refused.
  Welcome behaviour, view precedence, parameter preservation, one header/main/footer, no native
  select, disclosure semantics, the picked environment surviving a switch both ways, and the
  picker opening that environment.
- `node scripts/mobile-gate.mjs`: 5 held, 0 refused at 390.
- `compound-ops/tools/gates/contrast.mjs` on Simple `/` and `/agentwire` at 1440: 0 findings.
- Mocked: nothing. The site has no API routes and writes nothing.
- Not verified: Safari rendering.

Screens: `compound-ops/standards/simple-view-ref/review/compound-evals-*.png`.
