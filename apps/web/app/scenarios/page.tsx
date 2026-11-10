import type { Scenario, Stats } from "@rehearse/types";
import { ScenarioLibrary } from "@/components/scenario-library";
import { ButtonLink, Icon, PageTitle } from "@/components/ui";
import { api } from "@/lib/api";

export default async function ScenariosPage() {
  const [scenarios, stats] = await Promise.all([api<Scenario[]>("/scenarios"), api<Stats>("/stats")]);
  return (
    <>
      <PageTitle
        title="Scenario library"
        subtitle="Roleplays your team can practice. Each one names the skills it trains."
        action={
          <ButtonLink href="/scenarios/new">
            <Icon name="plus" size={16} />
            New scenario
          </ButtonLink>
        }
      />
      <ScenarioLibrary scenarios={scenarios} rubricName={stats.rubric.name} />
    </>
  );
}
