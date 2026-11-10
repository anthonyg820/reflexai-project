import type { Scenario } from "@rehearse/types";
import Link from "next/link";
import { notFound } from "next/navigation";
import { startSession } from "@/app/actions";
import { Avatar, Card, DifficultyBadge, Icon, PageTitle, buttonClass } from "@/components/ui";
import { ApiError, api } from "@/lib/api";

export default async function ScenarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let scenario: Scenario;
  try {
    scenario = await api<Scenario>(`/scenarios/${id}`);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) notFound();
    throw err;
  }

  return (
    <>
      <Link href="/scenarios" className="mb-4 inline-flex min-h-11 items-center gap-1.5 font-medium text-accent hover:text-accent-strong">
        <Icon name="back" size={16} />
        Scenario library
      </Link>
      <PageTitle
        title={scenario.title}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <DifficultyBadge difficulty={scenario.difficulty} />
            {scenario.channel && <span>{scenario.channel}</span>}
            <span>· ~{scenario.minutes} min ·</span>
            <Link href={`/rubrics#${scenario.rubricId}`} className="font-medium text-accent hover:text-accent-strong">
              {scenario.rubricName} rubric
            </Link>
            {!scenario.rubricExplicit && <span>(environment default)</span>}
          </span>
        }
        action={
          <form action={startSession.bind(null, scenario.id)}>
            <button type="submit" className={buttonClass}>
              <Icon name="play" size={16} />
              Start practice
            </button>
          </form>
        }
      />
      <div className="flex flex-wrap items-start gap-5">
        <Card className="min-w-0 flex-[999_1_480px] p-6">
          <div className="flex items-center gap-3">
            <Avatar name={scenario.persona} />
            <div>
              <div className="font-semibold">{scenario.persona}</div>
              <div className="text-xs text-muted">Persona</div>
            </div>
          </div>
          <p className="mt-4 leading-relaxed text-ink-soft">{scenario.description}</p>
          {scenario.skills.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Skills">
              {scenario.skills.map((k) => (
                <li key={k} className="rounded-full bg-sunken px-2.5 py-[3px] text-xs text-ink-soft">
                  {k}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="min-w-0 flex-[1_1_320px] p-6">
          <h2 className="text-base font-semibold">Script ({scenario.personaLines.length} lines)</h2>
          <p className="mt-1 text-xs text-muted">The persona says one line after each of your replies.</p>
          <ol className="mt-4 space-y-2.5">
            {scenario.personaLines.map((line, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed">
                <span className="w-5 shrink-0 text-right text-muted tabular-nums">{i + 1}</span>
                <span>{line}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </>
  );
}
