"use client";
import type { Message, PostMessageResponse, SessionDetail, SessionSummary } from "@rehearse/types";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { clientApi } from "@/lib/client-api";
import { ScoreBadge, buttonClass, secondaryButtonClass } from "./ui";

export function Chat({ initial }: { initial: SessionDetail }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initial.messages);
  const [summary, setSummary] = useState<SessionSummary>(initial);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = summary.status === "completed";

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const send = () =>
    run(async () => {
      const content = draft.trim();
      if (!content) return;
      const res = await clientApi<PostMessageResponse>(`/sessions/${summary.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      setMessages((m) => [...m, res.trainee, ...(res.persona ? [res.persona] : [])]);
      setDraft("");
    });

  const end = () =>
    run(async () => {
      setSummary(await clientApi<SessionSummary>(`/sessions/${summary.id}/end`, { method: "POST" }));
      router.refresh();
    });

  return (
    <div className="max-w-2xl">
      <ol className="space-y-3" aria-live="polite">
        {messages.map((m) => (
          <li key={m.id} className={`flex ${m.role === "trainee" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                m.role === "trainee" ? "bg-accent text-accent-ink" : "border border-line bg-card"
              }`}
            >
              {m.content}
            </div>
          </li>
        ))}
      </ol>

      {error && <p className="mt-4 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{error}</p>}

      {done ? (
        <div className="mt-8 flex items-center gap-3 rounded-xl border border-line bg-card p-5">
          <span className="text-muted">Session complete · score</span>
          <ScoreBadge score={summary.score} />
          <span className="text-sm text-muted">({summary.rubric})</span>
        </div>
      ) : (
        <form
          className="mt-8 flex flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type your response…"
            maxLength={2000}
            className="flex-1 rounded-lg border border-line bg-card px-3 py-2 outline-none focus:border-accent"
            aria-label="Your response"
          />
          <button type="submit" disabled={busy || !draft.trim()} className={buttonClass}>
            Send
          </button>
          <button type="button" onClick={() => void end()} disabled={busy} className={secondaryButtonClass}>
            End &amp; score
          </button>
        </form>
      )}
    </div>
  );
}
