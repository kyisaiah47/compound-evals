import Link from 'next/link';
import type { ReactNode } from 'react';
import { getEnvironment, getEnvironments, modelRows, scoreLines, scoredCount, toScore, totals, type Environment, type Task } from '@/lib/data';
import { SimpleHeader, SimpleFooter } from './SimpleChrome';
import Disclosure from './Disclosure';
import EnvPicker from './EnvPicker';

/* EVALBENCH'S SIMPLE PAGES. Server components: every count, score and sentence is read off
 * src/data/environments.json, which scripts/build-data.mjs compiles from envs/*\/results.json.
 * The picker and the disclosures are the client parts. */

function Chrome({ children }: { children: ReactNode }) {
  return (
    <>
      <SimpleHeader />
      <main className="sv-main">
        <div className="sv-in">{children}</div>
      </main>
      <SimpleFooter />
    </>
  );
}

function Intro({ label, title, id, children }: { label: string; title: string; id?: string; children: ReactNode }) {
  return (
    <div className="sv-section-intro">
      <div>
        <span className="sv-label">{label}</span>
        <h2 id={id}>{title}</h2>
      </div>
      <p>{children}</p>
    </div>
  );
}

function Head({ label, title, intro }: { label: string; title: string; intro: ReactNode }) {
  return (
    <div className="sv-page-head">
      <div>
        <span className="sv-label">{label}</span>
        <h1>{title}</h1>
      </div>
      <p>{intro}</p>
    </div>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/* A task's state in words. Unrun is never printed as a zero. */
function taskState(task: Task): { tone: 'held' | 'caught' | 'unrun'; text: string } {
  const entries = Object.entries(task.scores || {});
  if (!entries.length) return { tone: 'unrun', text: 'Unrun. No model has been driven through this task.' };
  const held = entries.filter(([, s]) => toScore(s) >= 1).map(([m]) => m);
  const caught = entries.filter(([, s]) => toScore(s) < 1).map(([m]) => m);
  if (!caught.length) return { tone: 'held', text: `Held for ${held.join(', ')}. Every guard passed on the rows the model left.` };
  return { tone: 'caught', text: `Caught for ${caught.join(', ')}. A guard refused the rows the model left.` };
}

function TaskDetail({ task }: { task: Task }) {
  return (
    <>
      <p>Driven through <code>{task.route}</code> by {task.driven}. It writes {task.writes.join(', ') || 'no table'}.</p>
      <ul className="sv-guards">
        {task.guards.map((g) => (
          <li key={g.id}><code>{g.id}</code><p>It checks that {g.checks.replace(/^that /, "")}.</p></li>
        ))}
      </ul>
      {task.cheats.length ? (
        <>
          <p><strong>The cheats these guards refuse</strong></p>
          <ul className="sv-guards">
            {task.cheats.map((c) => (
              <li key={c.id}><code>{c.id}</code><p>The model {c.fakes}. The guard <code>{c.caught_by}</code> refuses it.</p></li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}

const STEPS = [
  { t: 'Reset', d: 'The environment is restored to its seeded state, so two runs start identical.' },
  { t: 'Drive', d: 'The model works through the product’s own browser surface or API route.' },
  { t: 'Grade', d: 'Each guard queries the rows the product wrote and holds or refuses.' },
  { t: 'Record', d: 'The score is written beside the task it came from. Nothing is averaged away.' },
];

/* ── HOME ─────────────────────────────────────────────────────────────────────────────────── */
export function SimpleHome() {
  const envs = getEnvironments();
  const all = totals(envs);
  const models = modelRows(envs);
  const lines = scoreLines(envs);
  const caught = lines.find((l) => l.score < 1);
  const ex = caught ?? lines[0];
  const exEnv = ex ? getEnvironment(ex.product) : undefined;
  return (
    <Chrome>
      <section className="sv-hero">
        <div className="sv-pitch">
          <span className="sv-label">AGENT EVALS, GRADED ON THE DATABASE</span>
          <h1>See what a model actually left in the database.</h1>
          <p>
            Each score came from driving one model through one product task and then reading the rows the product wrote.
            A guard holds when the state is what the task asked for. It refuses when the state looks right on screen and
            is wrong underneath.
          </p>
          <p className="sv-qualifier">
            {all.scored === all.tasks
              ? <>Every one of the {all.tasks} tasks carries a recorded score.</>
              : <>{all.scored} of {all.tasks} tasks carry a recorded score. The other {all.tasks - all.scored} have never been run, and no figure is printed for them.</>}
          </p>
        </div>

        <div className="sv-card sv-action" id="start">
          <div className="sv-step"><span>01 / PICK AN ENVIRONMENT</span><span>FREE TO READ</span></div>
          <h2>Open one product&rsquo;s tasks and scores.</h2>
          <p>Each environment is a real product with seeded state, named work, and guards that read the database.</p>
          <EnvPicker options={envs.map((e) => ({ value: e.product, label: `${e.product}: ${plural(e.tasks.length, 'task', 'tasks')}` }))} />
          <p className="sv-terms">No account. The environments and their graders are MIT licensed on GitHub.</p>
        </div>
      </section>

      {ex && exEnv ? (
        <section className="sv-section" aria-labelledby="sv-example">
          <Intro label="02 / WHAT A SCORE SAYS" title="A verdict you can check." id="sv-example">
            Every score names the task, the model and the guards that decided it. Open the guards when you want the detail.
          </Intro>
          <div className="sv-card sv-result">
            <div className="sv-step"><span>EXAMPLE RESULT</span><span>{exEnv.title}</span></div>
            <h3>
              On the task &ldquo;{ex.task.id}&rdquo;, {ex.model}{' '}
              <span className="sv-verdict" data-tone={ex.score >= 1 ? 'held' : 'caught'}>{ex.score >= 1 ? 'held' : 'was caught'}</span>.
            </h3>
            <p>{ex.task.description}</p>
            <Disclosure title={`See the ${plural(ex.task.guards.length, 'guard', 'guards')} and ${plural(ex.task.cheats.length, 'cheat', 'cheats')}`}>
              <TaskDetail task={ex.task} />
            </Disclosure>
            <p className="sv-note">This is one recorded score from the suite, scored {ex.score.toFixed(2)}. <Link href={`/${ex.product}`}>Open its environment</Link>.</p>
          </div>
        </section>
      ) : null}

      <section className="sv-section" id="how" aria-labelledby="sv-how">
        <Intro label="03 / HOW A SCORE IS MADE" title="Reset, drive, grade, record." id="sv-how">
          {plural(models.length, 'model has', 'models have')} been run so far. A model with no recorded run has no row.
        </Intro>
        <ol className="sv-steps4">
          {STEPS.map((s, i) => (
            <li className="sv-card" key={s.t}>
              <span className="sv-step-n">{i + 1}</span>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="sv-section" aria-labelledby="sv-cost">
        <Intro label="04 / COST" title="Free to read and free to run." id="sv-cost">
          Nothing on this site is for sale. The environments, graders and results are in a public repository under the MIT licence.
        </Intro>
        <Disclosure title="What do the three states mean?">
          <ul className="sv-plain">
            <li><strong>Held.</strong> The guard passed on the state the model left.</li>
            <li><strong>Caught.</strong> The guard refused it, and names what it found.</li>
            <li><strong>Unrun.</strong> No model has been driven through this task.</li>
          </ul>
        </Disclosure>
        <Disclosure title="Why grade the database and not the page?">
          <p>A web app returns 200 and paints a success message whether or not the write landed. A grader that reads the page cannot tell a completed task from a convincing failure, so every guard here reads rows.</p>
        </Disclosure>
      </section>

      <nav className="sv-next" aria-label="Next steps">
        <Link href="/environments">Every environment <span aria-hidden="true">{'↗'}</span></Link>
        {ex ? <Link href={`/${ex.product}`}>The example&rsquo;s environment <span aria-hidden="true">{'↗'}</span></Link> : null}
        <a href="https://github.com/kyisaiah47/evalbench" rel="noreferrer">Read the source <span aria-hidden="true">{'↗'}</span></a>
      </nav>
    </Chrome>
  );
}

/* ── /environments ────────────────────────────────────────────────────────────────────────── */
function EnvRow({ env }: { env: Environment }) {
  const scored = scoredCount(env);
  return (
    <Link href={`/${env.product}`}>
      <span className="sv-envrow">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/marks/${env.product}.svg`} alt="" width={20} height={20} />
        <span>
          <strong>{env.title}</strong><br />
          <span>{plural(env.tasks.length, 'task', 'tasks')}, {plural(env.counts.guards, 'guard', 'guards')}, {plural(env.counts.cheats, 'named cheat', 'named cheats')}.</span>
        </span>
        <em className="sv-verdict" data-tone={scored ? 'held' : 'unrun'}>{scored ? `${scored} of ${env.tasks.length} scored` : 'Unrun'}</em>
      </span>
    </Link>
  );
}

export function SimpleEnvironments() {
  const envs = getEnvironments();
  const all = totals(envs);
  return (
    <Chrome>
      <Head
        label="EVERY ENVIRONMENT"
        title="Every environment."
        intro={`${all.environments} environments are resettable and gradable. Each one is a real product with seeded state, named work, and guards that read the database rather than the transcript.`}
      />
      <section className="sv-section" aria-labelledby="sv-envs">
        <Intro label="THE LIST" title="Pick one to read its tasks." id="sv-envs">The figure beside an environment is its tasks. Where a run exists it reads scored over total.</Intro>
        <ul className="sv-rows">
          {envs.map((env) => <li key={env.product}><EnvRow env={env} /></li>)}
        </ul>
      </section>
    </Chrome>
  );
}

/* ── /[product] ───────────────────────────────────────────────────────────────────────────── */
export function SimpleEnvironment({ product }: { product: string }) {
  const env = getEnvironment(product)!;
  const scored = scoredCount(env);
  const open = env.defects.filter((d) => !d.fixed);
  return (
    <Chrome>
      <Head
        label={env.product.toUpperCase()}
        title={`${env.title}.`}
        intro={<>{plural(env.tasks.length, 'task', 'tasks')} against <a href={env.product_url} rel="noreferrer">{env.product_url.replace(/^https?:\/\//, '')}</a>. {scored ? `${scored} of them carry a recorded score.` : 'No model has been driven through it yet.'} Its adversarial suite held {env.suite.expectations_held} of {env.suite.expectations_total} expectations on {env.suite.last_run}.</>}
      />
      <section className="sv-section" aria-labelledby="sv-tasks">
        <Intro label="THE TASK BOOK" title="Each task and its verdict." id="sv-tasks">Open a task to read the guards that grade it and the cheats they refuse.</Intro>
        {env.tasks.map((t) => {
          const s = taskState(t);
          return (
            <div className="sv-card sv-result sv-task" key={t.id}>
              <div className="sv-step"><span>{t.id}</span><span>{t.driven}</span></div>
              <h3>{t.description}</h3>
              <p><span className="sv-verdict" data-tone={s.tone}>{s.text}</span></p>
              <Disclosure title={`See the ${plural(t.guards.length, 'guard', 'guards')} and ${plural(t.cheats.length, 'cheat', 'cheats')}`}>
                <TaskDetail task={t} />
              </Disclosure>
            </div>
          );
        })}
      </section>
      {env.not_gradable.length || open.length ? (
        <section className="sv-section" aria-labelledby="sv-limits">
          <Intro label="LIMITS" title="What this environment does not grade." id="sv-limits">Stated beside the tasks rather than left out.</Intro>
          {env.not_gradable.map((n) => <Disclosure key={n.what} title={n.what}><p>{n.why}</p></Disclosure>)}
          {open.map((d) => <Disclosure key={d.summary} title={`Open finding: ${d.summary}`}><p>{d.where}. Severity {d.severity}.</p></Disclosure>)}
        </section>
      ) : null}
      <nav className="sv-next" aria-label="Next steps">
        <Link href="/environments">Every environment <span aria-hidden="true">{'↗'}</span></Link>
        <a href={env.product_url} rel="noreferrer">Open the product <span aria-hidden="true">{'↗'}</span></a>
        <Link href="/">The scorecard <span aria-hidden="true">{'↗'}</span></Link>
      </nav>
    </Chrome>
  );
}

/* ── 404 ──────────────────────────────────────────────────────────────────────────────────── */
export function SimpleNotFound() {
  return (
    <Chrome>
      <Head label="NOT FOUND" title="Not an environment." intro="This address is not a page on EvalBench. Every environment is listed on one page." />
      <nav className="sv-next" aria-label="Next steps">
        <Link href="/environments">Every environment <span aria-hidden="true">{'↗'}</span></Link>
        <Link href="/">The scorecard <span aria-hidden="true">{'↗'}</span></Link>
        <a href="https://github.com/kyisaiah47/evalbench" rel="noreferrer">Read the source <span aria-hidden="true">{'↗'}</span></a>
      </nav>
    </Chrome>
  );
}
