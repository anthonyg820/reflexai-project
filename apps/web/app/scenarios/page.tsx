import type { Scenario } from "@rehearse/types";
import Link from "next/link";
import { ButtonLink, PageTitle } from "@/components/ui";
import { api } from "@/lib/api";

export default async function ScenariosPage() {
  const scenarios = await api<Scenario[]>("/scenarios");
  return (
    <>
      <PageTitle
        title="Scenarios"
        subtitle="Roleplays your trainees can practice."
        action={<ButtonLink href="/scenarios/new">New scenario</ButtonLink>}
      />
      <div className="grid gap-4 md:grid-cols-2">
        {scenarios.map((s) => (
          <Link
            key={s.id}
            href={`/scenarios/${s.id}`}
            className="rounded-xl border border-line bg-card p-5 transition hover:border-accent"
          >
            <div className="text-xs uppercase tracking-wide text-muted">{s.persona}</div>
            <h2 className="mt-1 font-serif text-xl">{s.title}</h2>
            <p className="mt-2 line-clamp-2 text-sm text-muted">{s.description}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
