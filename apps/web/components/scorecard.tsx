import type { SessionDetail } from "@rehearse/types";
import Link from "next/link";
import { startSession } from "@/app/actions";
import { Bar, Icon, buttonClass, secondaryButtonClass } from "./ui";

function ScoreRing({ score, passed }: { score: number; passed: boolean }) {
  const r = 62;
  const c = 2 * Math.PI * r;
  return (
    <div role="img" aria-label={`Score ${score} out of 100, ${passed ? "passed" : "not passed"}`} className="relative size-[148px] shrink-0">
      <svg aria-hidden="true" width="148" height="148" viewBox="0 0 148 148">
        <circle cx="74" cy="74" r={r} fill="none" className="stroke-line-soft" strokeWidth="14" />
        <circle
          cx="74"
          cy="74"
          r={r}
          fill="none"
          className={passed ? "stroke-accent" : "stroke-warn-bar"}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${(c * score) / 100} ${c}`}
          transform="rotate(-90 74 74)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[40px] leading-none font-semibold tabular-nums">{score}</span>
        <span className="mt-1 text-xs text-muted">of 100</span>
      </div>
    </div>
  );
}

const duration = (from: string, to: string | null) => {
  const secs = Math.max(0, Math.round(((to ? new Date(to).getTime() : Date.now()) - new Date(from).getTime()) / 1000));
  return secs >= 60 ? `${Math.floor(secs / 60)} min ${secs % 60} s` : `${secs} s`;
};

export function Scorecard({ session }: { session: SessionDetail }) {
  const score = session.score ?? 0;
  const passing = session.passingScore;
  const passed = passing === null || score >= passing;
  const replies = session.messages.filter((m) => m.role === "trainee").length;
  const fb = session.feedback;
  const history = session.history;

  return (
    <div className="mx-auto flex max-w-[1120px] flex-col gap-6">
      <Link href="/" className="inline-flex min-h-11 items-center gap-1.5 self-start font-medium text-accent hover:text-accent-strong">
        <Icon name="back" size={16} />
        Back to dashboard
      </Link>

      <section className="flex flex-wrap items-center gap-8 rounded-[18px] border border-line bg-card p-7">
        <ScoreRing score={score} passed={passed} />
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-[13px] font-semibold ${passed ? "bg-accent-soft text-accent-strong" : "bg-warn-soft text-warn"}`}>
              {passed ? "Passed" : "Not passed"}
              {passing !== null && ` · needs ${passing}`}
            </span>
            <span className="text-[13px] text-muted">
              {session.rubricName ?? session.rubric} · {replies} {replies === 1 ? "reply" : "replies"} · {duration(session.createdAt, session.endedAt)}
            </span>
          </div>
          <h1 className="text-[28px] leading-tight font-semibold">{session.scenarioTitle}</h1>
          {fb && <p className="max-w-[640px] leading-relaxed text-ink-soft">{fb.summary}</p>}
        </div>
        <div className="flex shrink-0 flex-col gap-2.5">
          <form action={startSession.bind(null, session.scenarioId)}>
            <button type="submit" className={`${buttonClass} w-full`}>
              Try again
            </button>
          </form>
          <Link href="/scenarios" className={secondaryButtonClass}>
            Next scenario
          </Link>
        </div>
      </section>

      {fb && (
        <div className="flex flex-wrap items-start gap-6">
          <section aria-labelledby="crit" className="flex min-w-0 flex-[1_1_400px] flex-col gap-4 rounded-[18px] border border-line bg-card p-6">
            <h2 id="crit" className="text-lg font-semibold">
              By criterion
            </h2>
            {fb.criteria.map((c) => (
              <div key={c.id} className="flex flex-col gap-2 border-b border-line-soft pb-4 last:border-0 last:pb-0">
                <div className="flex justify-between gap-3">
                  <span className="font-semibold">{c.name}</span>
                  <span className="font-semibold tabular-nums">{c.score} / 5</span>
                </div>
                <div className="flex">
                  <Bar value={c.score} max={5} good={c.score >= 3} />
                </div>
                <p className="leading-relaxed text-ink-soft">{c.note}</p>
              </div>
            ))}
          </section>

          <section aria-labelledby="moments" className="flex min-w-0 flex-[1_1_440px] flex-col gap-4 rounded-[18px] border border-line bg-card p-6">
            <h2 id="moments" className="text-lg font-semibold">
              Key moments
            </h2>
            {fb.moments.length === 0 ? (
              <p className="text-muted">Not enough replies to pick out moments.</p>
            ) : (
              fb.moments.map((m, i) => (
                <article key={i} className="flex flex-col gap-2 rounded-xl border border-line-soft bg-paper p-4">
                  <span
                    className={`self-start rounded-full px-2.5 py-[3px] text-xs font-semibold ${
                      m.kind === "strong" ? "bg-accent-soft text-accent-strong" : "bg-warn-soft text-warn"
                    }`}
                  >
                    {m.kind === "strong" ? "Strong" : "Missed chance"}
                  </span>
                  <blockquote className="leading-relaxed italic">“{m.quote}”</blockquote>
                  <p className="leading-relaxed text-ink-soft">{m.feedback}</p>
                </article>
              ))
            )}
          </section>
        </div>
      )}

      {history.length > 1 && (
        <section aria-labelledby="trend" className="flex flex-col gap-4 rounded-[18px] border border-line bg-card p-6">
          <div className="flex flex-wrap justify-between gap-2">
            <h2 id="trend" className="text-lg font-semibold">
              Recent attempts at this scenario
            </h2>
            {passing !== null && <span className="text-[13px] text-muted">Dashed line: passing score</span>}
          </div>
          <div
            role="img"
            aria-label={`Scores over the last ${history.length} attempts: ${history.map((h) => h.score).join(", ")}`}
            className="relative flex h-[184px] items-end gap-6 border-b border-line px-2"
          >
            {passing !== null && (
              <div aria-hidden="true" className="absolute inset-x-0 border-t-2 border-dashed border-muted" style={{ bottom: passing * 1.6 }} />
            )}
            {history.map((h) => (
              <div key={h.id} aria-hidden="true" className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-xs text-ink-soft tabular-nums">{h.score}</span>
                <div
                  className={`w-full max-w-16 rounded-t-lg ${h.id === session.id ? "bg-accent" : "bg-line-strong"}`}
                  style={{ height: Math.max(4, h.score * 1.6) }}
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
