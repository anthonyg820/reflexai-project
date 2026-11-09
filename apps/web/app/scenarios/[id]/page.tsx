import type { Scenario } from "@rehearse/types";
import { notFound } from "next/navigation";
import { startSession } from "@/app/actions";
import { Card, PageTitle, buttonClass } from "@/components/ui";
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
      <PageTitle
        title={scenario.title}
        subtitle={`Persona: ${scenario.persona}`}
        action={
          <form action={startSession.bind(null, scenario.id)}>
            <button type="submit" className={buttonClass}>
              Start session
            </button>
          </form>
        }
      />
      <Card className="max-w-2xl">
        <p>{scenario.description}</p>
        <h2 className="mt-6 text-sm text-muted">Script ({scenario.personaLines.length} lines)</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          {scenario.personaLines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>
      </Card>
    </>
  );
}
