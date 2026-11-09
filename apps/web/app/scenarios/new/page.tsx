import { createScenario } from "@/app/actions";
import { Card, PageTitle, buttonClass } from "@/components/ui";

const input = "mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent";

export default function NewScenarioPage() {
  return (
    <>
      <PageTitle title="New scenario" subtitle="Write the persona's side of the conversation, one line per turn." />
      <Card className="max-w-2xl">
        <form action={createScenario} className="space-y-5">
          <label className="block text-sm">
            Title
            <input name="title" required minLength={3} maxLength={120} className={input} />
          </label>
          <label className="block text-sm">
            Persona
            <input name="persona" required placeholder="e.g. Jordan, 24" maxLength={80} className={input} />
          </label>
          <label className="block text-sm">
            Description
            <textarea name="description" required rows={2} maxLength={1000} className={input} />
          </label>
          <label className="block text-sm">
            Persona lines
            <textarea
              name="personaLines"
              required
              rows={6}
              placeholder={"Hi, I'm not sure I should be calling...\nIt's been a hard week."}
              className={`${input} font-mono text-sm`}
            />
          </label>
          <button type="submit" className={buttonClass}>
            Create scenario
          </button>
        </form>
      </Card>
    </>
  );
}
