import { scoreLines } from '@/lib/data';
import type { WelcomeCopy } from './Welcome';

/* THE WELCOME'S WORDS, built on the server and handed to the client dialog as props. The
 * illustration is one recorded score and its first guard, labelled, never an invented one. */
export function welcomeCopy(): WelcomeCopy {
  const line = scoreLines().find((l) => l.score >= 1) ?? scoreLines()[0];
  const guard = line?.task.guards[0];
  return {
    intro: (
      <>
        <h2 id="sv-welcome-title">Did the AI agent really do the task, or only make it look done?</h2>
        <p>
          Compound Evals drives a model through a real product, then reads the rows the product wrote.
          A task counts only when the database holds what the task asked for.
        </p>
      </>
    ),
    illustration: line ? (
      <>
        <div className="sv-illustration-top">
          <span>ILLUSTRATION</span>
          <span>A RECORDED SCORE FROM {line.product.toUpperCase()}</span>
        </div>
        <p className="sv-illustration-plan">{line.task.description}</p>
        <p className="sv-illustration-found">
          <span>{line.score >= 1 ? 'Held.' : 'Caught.'} Every guard read the database after the run.</span>
          {guard ? <span>One guard checks that {guard.checks.replace(/^that /, "")}.</span> : null}
        </p>
      </>
    ) : null,
    consoleLine: 'Every environment, task, guard and score on one dense screen.',
  };
}
