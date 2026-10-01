import Link from "next/link";
import { Shell, ViewHead } from "@/components/Shell";
import { getEnvironments } from "@/lib/data";
import PageViews from "@/components/site-view/PageViews";
import { SimpleNotFound } from "@/components/site-view/SimplePages";

/* THE 404, in both views. The Console keeps its own shell and points at the two surfaces. */
export default function NotFound() {
  const envs = getEnvironments();
  return (
    <PageViews
      simpleView={<SimpleNotFound />}
      consoleView={
        <Shell active="" envs={envs} claim={<>This address is not a page on Compound Evals.</>} rail={null}>
          <ViewHead kick="Not found" icon="circle-dashed" title="Not an environment">
            Every environment is listed on <Link href="/environments">one page</Link>, and the scores are on the{" "}
            <Link href="/">scorecard</Link>.
          </ViewHead>
        </Shell>
      }
    />
  );
}
