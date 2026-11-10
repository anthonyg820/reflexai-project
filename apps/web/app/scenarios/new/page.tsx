import { DIFFICULTIES } from "@rehearse/types";
import { createScenario } from "@/app/actions";
import { Card, PageTitle, buttonClass, difficultyLabel } from "@/components/ui";

const input = "mt-1.5 w-full rounded-[10px] border border-line-strong bg-paper px-3.5 py-2.5 text-ink outline-none focus:border-accent";

export default function NewScenarioPage() {
  return (
    <>
      <PageTitle title="New scenario" subtitle="Write the persona's side of the conversation, one line per turn." />
      <Card className="max-w-2xl p-6">
        <form action={createScenario} className="space-y-5">
          <label className="block font-medium">
            Title
            <input name="title" required minLength={3} maxLength={120} className={input} />
          </label>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block font-medium">
              Persona
              <input name="persona" required placeholder="e.g. Jordan, 24" maxLength={80} className={input} />
            </label>
            <label className="block font-medium">
              Channel
              <input name="channel" placeholder="e.g. Phone · returning caller" maxLength={60} className={input} />
            </label>
            <label className="block font-medium">
              Difficulty
              <select name="difficulty" defaultValue="core" className={input}>
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {difficultyLabel(d)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block font-medium">
              Length (minutes)
              <input name="minutes" type="number" min={1} max={60} defaultValue={10} className={input} />
            </label>
          </div>
          <label className="block font-medium">
            Skills <span className="font-normal text-muted">(comma separated, up to 6)</span>
            <input name="skills" placeholder="e.g. Rapport, Open questions" className={input} />
          </label>
          <label className="block font-medium">
            Description
            <textarea name="description" required rows={2} maxLength={1000} className={input} />
          </label>
          <label className="block font-medium">
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
