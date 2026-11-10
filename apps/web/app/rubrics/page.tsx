import type { Rubrics } from "@rehearse/types";
import Link from "next/link";
import { RubricPlayground } from "@/components/rubric-playground";
import { Bar, PageTitle } from "@/components/ui";
import { api } from "@/lib/api";

export default async function RubricsPage() {
  const data = await api<Rubrics>("/rubrics");
  return (
    <>
      <PageTitle
        title="Rubrics"
        subtitle={
          <>
            Each scenario is scored with its own rubric. Scenarios without one use the environment&apos;s default, set by{" "}
            <code className="rounded bg-sunken px-1.5 py-0.5 text-[13px]">SCORING_RUBRIC</code> in its runtime config.
          </>
        }
      />

      {!data.configuredKnown && (
        <p role="alert" className="mb-6 rounded-[14px] border border-warn bg-warn-soft px-5 py-4 text-warn">
          This environment&apos;s default rubric is configured as <strong>{data.configured}</strong>, which this release doesn&apos;t know. Scenarios
          without their own rubric can&apos;t be scored, and the dashboard can&apos;t load, until the config or the release is fixed.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {data.rubrics.map((r) => (
          <article id={r.id} key={r.id} className="flex scroll-mt-6 flex-col gap-4 rounded-[18px] border border-line bg-card p-6 target:border-accent">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{r.name}</h2>
                <p className="mt-0.5 font-mono text-xs text-muted">{r.id}</p>
              </div>
              {r.isDefault && <span className="rounded-full bg-accent-soft px-3 py-1 text-[13px] font-semibold text-accent-strong">Environment default</span>}
            </div>
            <p className="leading-relaxed text-ink-soft">{r.description}</p>

            <div className="overflow-hidden rounded-xl border border-line-soft">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">How {r.name} scores</caption>
                <tbody>
                  {r.rules.map((rule) => (
                    <tr key={rule.label} className="border-b border-line-soft last:border-0">
                      <td className="px-4 py-2.5">{rule.label}</td>
                      <td className="px-4 py-2.5 text-right font-semibold whitespace-nowrap tabular-nums">{rule.points}</td>
                    </tr>
                  ))}
                  <tr className="bg-paper">
                    <td className="px-4 py-2.5 text-muted">Score is capped to 0–100. Passing score</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{r.passingScore}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <h3 className="text-sm font-semibold">Scenarios using it</h3>
              {r.scenarios.length === 0 ? (
                <p className="mt-1 text-sm text-muted">None in this organization yet.</p>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {r.scenarios.map((s) => (
                    <li key={s.id}>
                      <Link href={`/scenarios/${s.id}`} className="inline-block rounded-full bg-sunken px-2.5 py-1 text-xs text-ink-soft hover:text-accent">
                        {s.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <dl className="mt-auto grid grid-cols-3 gap-3 border-t border-line-soft pt-4">
              <div>
                <dt className="text-xs text-muted">Sessions scored</dt>
                <dd className="font-display text-2xl font-semibold tabular-nums">{r.sessions}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Average score</dt>
                <dd className="font-display text-2xl font-semibold tabular-nums">{r.averageScore ?? "—"}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-xs text-muted">Pass rate</dt>
                <dd className="font-display text-2xl font-semibold tabular-nums">{r.passRate === null ? "—" : `${r.passRate}%`}</dd>
                {r.passRate !== null && <Bar value={r.passRate} good={r.passRate >= 50} height={6} />}
              </div>
            </dl>
          </article>
        ))}
      </div>

      <section aria-labelledby="criteria" className="mt-6 rounded-[18px] border border-line bg-card p-6">
        <h2 id="criteria" className="text-lg font-semibold">
          Coaching criteria
        </h2>
        <p className="mt-1 text-muted">
          The live coach and the scorecard rate every session on these four skills, from 0 to 5. They guide practice but don&apos;t change the rubric score.
        </p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.criteria.map((c) => (
            <div key={c.id} className="rounded-xl bg-paper p-4">
              <dt className="font-semibold">{c.name}</dt>
              <dd className="mt-1 leading-relaxed text-ink-soft">{c.description}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-6">
        <RubricPlayground />
      </div>
    </>
  );
}
