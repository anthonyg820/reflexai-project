import { TENANTS, type Stats } from "@rehearse/types";
import Link from "next/link";
import { Avatar, Bar, ButtonLink, DifficultyBadge, Icon, PageTitle, ScoreBadge, SectionCard, Stat, timeAgo } from "@/components/ui";
import { api, currentTenant } from "@/lib/api";

export default async function DashboardPage() {
  const [stats, tenant] = await Promise.all([api<Stats>("/stats"), currentTenant()]);
  const { totals, rubric, weakestSkill } = stats;
  const tenantName = TENANTS.find((t) => t.id === tenant)?.name ?? tenant;
  const now = Date.now();

  return (
    <>
      <PageTitle
        eyebrow={`${tenantName} · scored with ${rubric.name}`}
        title="Dashboard"
        action={
          <>
            <ButtonLink href="/scenarios/new" secondary>
              New scenario
            </ButtonLink>
            <ButtonLink href="/scenarios">
              <Icon name="play" size={16} />
              Start practice
            </ButtonLink>
          </>
        }
      />

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Sessions completed" value={totals.completed} hint={`${totals.sessions} started`} />
        <Stat label="Average score" value={totals.averageScore ?? "—"} hint={`Passing score ${rubric.passingScore}`} />
        <Stat label="Pass rate" value={totals.passRate === null ? "—" : `${totals.passRate}%`}>
          <Bar value={totals.passRate ?? 0} good={(totals.passRate ?? 0) >= 50} height={6} />
        </Stat>
        <Stat
          label="Weakest skill"
          value={<span className="block pt-1.5 text-2xl leading-snug">{weakestSkill?.name ?? "—"}</span>}
          hint={weakestSkill ? <span className="text-warn">Avg {weakestSkill.average} / 100 on this criterion</span> : "No completed sessions yet"}
        />
      </section>

      <div className="mt-7 flex flex-wrap items-start gap-5">
        <SectionCard
          title="By scenario"
          className="flex-[999_1_520px]"
          action={
            <Link href="/scenarios" className="text-[13px] font-medium text-accent hover:text-accent-strong">
              All scenarios
            </Link>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Scenario</th>
                  <th className="px-3 py-3 font-medium">Difficulty</th>
                  <th className="px-3 py-3 text-right font-medium">Sessions</th>
                  <th className="w-[34%] px-5 py-3 font-medium">Pass rate</th>
                </tr>
              </thead>
              <tbody>
                {stats.byScenario.map((s) => (
                  <tr key={s.scenarioId} className="border-t border-line-soft">
                    <td className="px-5 py-3.5">
                      <Link href={`/scenarios/${s.scenarioId}`} className="font-medium hover:text-accent">
                        {s.title}
                      </Link>
                      <div className="mt-0.5 text-xs text-muted">{s.persona}</div>
                    </td>
                    <td className="px-3 py-3.5">
                      <DifficultyBadge difficulty={s.difficulty} />
                    </td>
                    <td className="px-3 py-3.5 text-right tabular-nums">{s.sessions}</td>
                    <td className="px-5 py-3.5">
                      {s.passRate === null ? (
                        <span className="text-muted">No completed sessions</span>
                      ) : (
                        <div className="flex items-center gap-2.5">
                          <div className="flex-1">
                            <Bar value={s.passRate} good={s.passRate >= 70} />
                          </div>
                          <span className="w-10 text-right font-medium tabular-nums">{s.passRate}%</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Recent sessions" className="flex-[1_1_320px]">
          {stats.recent.length === 0 ? (
            <p className="px-5 py-6 text-muted">
              No sessions yet.{" "}
              <Link href="/scenarios" className="font-medium text-accent underline">
                Pick a scenario
              </Link>{" "}
              to start one.
            </p>
          ) : (
            <ul className="py-1.5">
              {stats.recent.slice(0, 6).map((s) => (
                <li key={s.id}>
                  <Link href={`/sessions/${s.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-sunken">
                    <Avatar name={s.persona} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{s.scenarioTitle}</span>
                      <span className="block text-xs text-muted">
                        {s.persona} · {timeAgo(s.createdAt, now)}
                      </span>
                    </span>
                    {s.status === "active" ? (
                      <span className="text-xs text-muted">in progress</span>
                    ) : (
                      <ScoreBadge score={s.score} passing={rubric.passingScore} />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </>
  );
}
