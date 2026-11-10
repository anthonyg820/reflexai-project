import type { Rubrics, Scenario } from "@rehearse/types";
import { ScenarioLibrary } from "@/components/scenario-library";
import { ButtonLink, Icon, PageTitle } from "@/components/ui";
import { api } from "@/lib/api";

export default async function ScenariosPage() {
  const [scenarios, rubrics] = await Promise.all([api<Scenario[]>("/scenarios"), api<Rubrics>("/rubrics")]);
  return (
    <>
      <PageTitle
        title="Scenario library"
        subtitle="Roleplays your team can practice. Each one names the skills it trains and the rubric it's scored with."
        action={
          <ButtonLink href="/scenarios/new">
            <Icon name="plus" size={16} />
            New scenario
          </ButtonLink>
        }
      />
      <ScenarioLibrary scenarios={scenarios} rubrics={rubrics.rubrics.map((r) => ({ id: r.id, name: r.name }))} />
    </>
  );
}
