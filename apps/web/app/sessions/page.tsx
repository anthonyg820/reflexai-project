import type { Stats } from "@rehearse/types";
import Link from "next/link";
import { Avatar, ButtonLink, PageTitle, ScoreBadge, formatDate } from "@/components/ui";
import { api } from "@/lib/api";

export default async function SessionsPage() {
  const stats = await api<Stats>("/stats");
  return (
    <>
      <PageTitle title="Sessions" subtitle="The most recent practice sessions in this organization." action={<ButtonLink href="/scenarios">Start practice</ButtonLink>} />
      {stats.recent.length === 0 ? (
        <p className="rounded-[14px] border border-line bg-card px-5 py-8 text-center text-muted">No sessions yet.</p>
      ) : (
        <ul className="divide-y divide-line-soft rounded-[14px] border border-line bg-card">
          {stats.recent.map((s) => (
            <li key={s.id}>
              <Link href={`/sessions/${s.id}`} className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-sunken">
                <Avatar name={s.persona} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{s.scenarioTitle}</span>
                  <span className="block text-xs text-muted">
                    {s.persona} · {formatDate(s.createdAt)}
                  </span>
                </span>
                {s.status === "active" ? (
                  <span className="text-xs text-muted">in progress</span>
                ) : (
                  <ScoreBadge score={s.score} passed={s.passed} />
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
