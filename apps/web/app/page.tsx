import type { Stats } from "@rehearse/types";
import Link from "next/link";
import { Card, PageTitle, ScoreBadge, Stat, formatDate } from "@/components/ui";
import { api } from "@/lib/api";

export default async function DashboardPage() {
  const stats = await api<Stats>("/stats");
  const { totals, rubric } = stats;

  return (
    <>
      <PageTitle title="Dashboard" subtitle={`Scored with ${rubric.name} · passing score ${rubric.passingScore}`} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Scenarios" value={totals.scenarios} />
        <Stat label="Sessions" value={totals.sessions} />
        <Stat label="Completed" value={totals.completed} />
        <Stat label="Average score" value={totals.averageScore ?? "—"} />
      </div>

      <section className="mt-10">
        <h2 className="mb-3 font-serif text-xl">By scenario</h2>
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th className="px-5 py-3 font-normal">Scenario</th>
                <th className="px-5 py-3 text-right font-normal">Sessions</th>
                <th className="px-5 py-3 text-right font-normal">Completed</th>
                <th className="px-5 py-3 text-right font-normal">Avg score</th>
              </tr>
            </thead>
            <tbody>
              {stats.byScenario.map((s) => (
                <tr key={s.scenarioId} className="border-b border-line last:border-0">
                  <td className="px-5 py-3">
                    <Link href={`/scenarios/${s.scenarioId}`} className="hover:text-accent">
                      {s.title}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">{s.sessions}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{s.completed}</td>
                  <td className="px-5 py-3 text-right">
                    <ScoreBadge score={s.averageScore} passing={rubric.passingScore} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 font-serif text-xl">Recent sessions</h2>
        {stats.recent.length === 0 ? (
          <p className="text-muted">
            No sessions yet. <Link href="/scenarios" className="text-accent underline">Pick a scenario</Link> to start one.
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {stats.recent.map((s) => (
              <li key={s.id}>
                <Link href={`/sessions/${s.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-accent-soft">
                  <span className="flex-1">{s.scenarioTitle}</span>
                  <span className="text-sm text-muted">{formatDate(s.createdAt)}</span>
                  {s.status === "active" ? (
                    <span className="text-sm text-muted">in progress</span>
                  ) : (
                    <ScoreBadge score={s.score} passing={rubric.passingScore} />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
