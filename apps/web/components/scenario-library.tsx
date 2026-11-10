"use client";
import { DIFFICULTIES, type Difficulty, type Scenario } from "@rehearse/types";
import Link from "next/link";
import { useMemo, useState } from "react";
import { startSession } from "@/app/actions";
import { Avatar, DifficultyBadge, difficultyLabel, outlineAccentButtonClass } from "./ui";

export function ScenarioLibrary({ scenarios, rubrics }: { scenarios: Scenario[]; rubrics: { id: string; name: string }[] }) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<Difficulty | "all">("all");
  const [rubric, setRubric] = useState("all");
  // Only offer rubrics that some scenario here uses.
  const usedRubrics = rubrics.filter((r) => scenarios.some((s) => s.rubricId === r.id));

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scenarios.filter(
      (s) =>
        (level === "all" || s.difficulty === level) &&
        (rubric === "all" || s.rubricId === rubric) &&
        (!q || [s.title, s.persona, s.description, s.rubricName, ...s.skills].some((f) => f.toLowerCase().includes(q))),
    );
  }, [scenarios, query, level, rubric]);

  const pill = (active: boolean) =>
    `min-h-11 rounded-full border px-4 text-sm ${
      active ? "border-accent bg-accent-soft font-semibold text-accent-strong" : "border-line-strong bg-card text-ink-soft hover:bg-sunken"
    }`;

  return (
    <>
      <div role="search" className="mb-6 flex flex-wrap items-center gap-2.5">
        <label className="flex min-w-[260px] flex-1">
          <span className="sr-only">Search scenarios</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, persona or skill"
            className="h-11 flex-1 rounded-[10px] border border-line-strong bg-card px-3.5 text-ink outline-none placeholder:text-muted focus:border-accent"
          />
        </label>
        <label className="flex">
          <span className="sr-only">Rubric</span>
          <select
            value={rubric}
            onChange={(e) => setRubric(e.target.value)}
            className="h-11 rounded-[10px] border border-line-strong bg-card px-3 text-ink outline-none focus:border-accent"
          >
            <option value="all">All rubrics</option>
            {usedRubrics.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <div role="group" aria-label="Difficulty" className="flex flex-wrap gap-1.5">
          <button type="button" aria-pressed={level === "all"} onClick={() => setLevel("all")} className={pill(level === "all")}>
            All
          </button>
          {DIFFICULTIES.map((d) => (
            <button key={d} type="button" aria-pressed={level === d} onClick={() => setLevel(d)} className={pill(level === d)}>
              {difficultyLabel(d)}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-[14px] border border-line bg-card px-5 py-8 text-center text-muted">No scenarios match.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((s) => (
            <article key={s.id} className="flex flex-col gap-3.5 rounded-[14px] border border-line bg-card p-5">
              <div className="flex items-center gap-3">
                <Avatar name={s.persona} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{s.persona}</div>
                  {s.channel && <div className="text-xs text-muted">{s.channel}</div>}
                </div>
                <DifficultyBadge difficulty={s.difficulty} />
              </div>
              <div>
                <h2 className="text-lg leading-snug font-semibold">
                  <Link href={`/scenarios/${s.id}`} className="hover:text-accent">
                    {s.title}
                  </Link>
                </h2>
                <p className="mt-1.5 line-clamp-3 leading-relaxed text-muted">{s.description}</p>
              </div>
              {s.skills.length > 0 && (
                <ul className="flex flex-wrap gap-1.5" aria-label="Skills">
                  {s.skills.map((k) => (
                    <li key={k} className="rounded-full bg-sunken px-2.5 py-[3px] text-xs text-ink-soft">
                      {k}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-auto flex items-center justify-between gap-2.5 border-t border-line-soft pt-3.5">
                <span className="text-xs text-muted">
                  Rubric:{" "}
                  <Link href={`/rubrics#${s.rubricId}`} className="font-medium text-ink hover:text-accent">
                    {s.rubricName}
                  </Link>{" "}
                  · ~{s.minutes} min
                </span>
                <form action={startSession.bind(null, s.id)}>
                  <button type="submit" className={outlineAccentButtonClass}>
                    Practice
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
