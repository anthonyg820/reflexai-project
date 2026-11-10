import type { Coaching } from "@rehearse/types";
import { Bar } from "./ui";

export function CoachPanel({ coach }: { coach: Coaching }) {
  return (
    <aside aria-label="Live coach" className="flex min-w-0 flex-[1_1_340px] flex-col gap-4">
      <section className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-semibold">Live coach</h2>
          <span className="text-xs text-muted">updates after each reply</span>
        </div>
        {coach.criteria.map((c) => (
          <div key={c.id} className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[13px]">
              <span className="font-medium">{c.name}</span>
              <span className="text-ink-soft tabular-nums">{c.score} / 5</span>
            </div>
            <div className="flex">
              <Bar value={c.score} max={5} good={c.score >= 3} />
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-5" aria-live="polite">
        <h2 className="text-[17px] font-semibold">Try next</h2>
        {coach.tips.map((t, i) => (
          <p
            key={i}
            className={`rounded-xl px-4 py-3.5 leading-relaxed ${t.kind === "try" ? "bg-warn-soft text-warn-ink" : "bg-accent-soft text-accent-strong"}`}
          >
            {t.text}
          </p>
        ))}
      </section>

      <p className="text-xs leading-relaxed text-muted">
        Coaching is calculated from your replies so far. Your score comes from this scenario’s rubric when you end the session.
      </p>
    </aside>
  );
}
