"use client";
import type { RubricPreview } from "@rehearse/types";
import { useEffect, useState } from "react";
import { clientApi } from "@/lib/client-api";
import { Bar } from "./ui";

const SAMPLE = "I'm really glad you called back. That sounds so frustrating.\nIt sounds like you felt nobody was listening. What happened on that call?\nok";

/** Type sample replies and see how every rubric (and the coach) would score them. Nothing is saved. */
export function RubricPlayground() {
  const [text, setText] = useState(SAMPLE);
  const [preview, setPreview] = useState<RubricPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const messages = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 20);
    const t = setTimeout(() => {
      clientApi<RubricPreview>("/rubrics/preview", { method: "POST", body: JSON.stringify({ messages }) })
        .then((p) => {
          setPreview(p);
          setError(null);
        })
        .catch((err: unknown) => setError(err instanceof Error ? err.message : "Preview failed"));
    }, 300);
    return () => clearTimeout(t);
  }, [text]);

  return (
    <section aria-labelledby="try" className="flex flex-wrap gap-6 rounded-[18px] border border-line bg-card p-6">
      <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-3">
        <div>
          <h2 id="try" className="text-lg font-semibold">
            Try it
          </h2>
          <p className="mt-1 text-muted">Type a trainee&apos;s replies, one per line, to see how each rubric scores them. Nothing is saved.</p>
        </div>
        <label className="flex flex-1 flex-col">
          <span className="sr-only">Sample replies, one per line</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            className="min-h-48 flex-1 resize-y rounded-xl border border-line-strong bg-paper px-3.5 py-3 leading-relaxed text-ink outline-none focus:border-accent"
          />
        </label>
        {error && <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{error}</p>}
      </div>

      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-5" aria-live="polite">
        <div className="grid grid-cols-2 gap-3">
          {(preview?.scores ?? []).map((s) => (
            <div key={s.id} className="rounded-xl border border-line-soft bg-paper p-4">
              <div className="text-[13px] text-muted">{s.name}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-3xl font-semibold tabular-nums">{s.score}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.passed ? "bg-accent-soft text-accent-strong" : "bg-warn-soft text-warn"}`}>
                  {s.passed ? "pass" : "fail"} · {s.passingScore}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Coaching criteria</h3>
          {(preview?.criteria ?? []).map((c) => (
            <div key={c.id} className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[13px]">
                <span className="font-medium">{c.name}</span>
                <span className="text-ink-soft tabular-nums">{c.score} / 5</span>
              </div>
              <Bar value={c.score} max={5} good={c.score >= 3} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
