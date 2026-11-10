"use client";
import type { Coaching, Message, PostMessageResponse, SessionDetail, SessionSummary } from "@rehearse/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { clientApi } from "@/lib/client-api";
import { CoachPanel } from "./coach-panel";
import { Avatar, Icon, buttonClass, secondaryButtonClass } from "./ui";

function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const secs = now === null ? 0 : Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  const label = secs >= 3600 ? `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m` : `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-sunken px-3 text-[13px] text-ink-soft tabular-nums">
      <Icon name="clock" size={14} />
      <span aria-label="Time in session">{now === null ? "--:--" : label}</span>
    </span>
  );
}

export function Chat({ initial }: { initial: SessionDetail }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initial.messages);
  const [coach, setCoach] = useState<Coaching>(initial.coach);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLLIElement>(null);

  useEffect(() => end.current?.scrollIntoView({ block: "nearest" }), [messages.length]);

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
      const res = await clientApi<PostMessageResponse>(`/sessions/${initial.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      setMessages((m) => [...m, res.trainee, ...(res.persona ? [res.persona] : [])]);
      setCoach(res.coach);
      setDraft("");
    });

  const finish = () =>
    run(async () => {
      await clientApi<SessionSummary>(`/sessions/${initial.id}/end`, { method: "POST" });
      router.refresh();
    });

  return (
    <div className="-mx-4 -my-8 sm:-mx-10">
      <header className="flex flex-wrap items-center gap-4 border-b border-line bg-card px-4 py-3.5 sm:px-8">
        <Link
          href="/scenarios"
          aria-label="Back to scenarios"
          className="flex size-11 items-center justify-center rounded-[10px] border border-line text-ink-soft hover:bg-sunken"
        >
          <Icon name="back" />
        </Link>
        <Avatar name={initial.persona} />
        <div className="min-w-[200px] flex-1">
          <h1 className="text-xl font-semibold">{initial.scenarioTitle}</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            Talking with {initial.persona}
            {initial.channel && ` · ${initial.channel}`}
            {initial.rubricName && ` · ${initial.rubricName} rubric`}
          </p>
        </div>
        <Elapsed since={initial.createdAt} />
        <button type="button" onClick={() => void finish()} disabled={busy} className={secondaryButtonClass}>
          End &amp; score
        </button>
      </header>

      <div className="flex flex-wrap items-stretch gap-6 px-4 py-6 sm:px-8">
        <section aria-label="Conversation" className="flex min-w-0 flex-[999_1_560px] flex-col rounded-2xl border border-line bg-card">
          <ol aria-live="polite" className="flex flex-1 flex-col gap-3.5 p-6">
            {messages.map((m) => (
              <li key={m.id} className={`flex ${m.role === "trainee" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-3 leading-relaxed ${
                    m.role === "trainee" ? "rounded-br-md bg-accent text-accent-ink" : "rounded-bl-md bg-sunken text-ink"
                  }`}
                >
                  <span className="sr-only">{m.role === "trainee" ? "You: " : `${initial.persona}: `}</span>
                  {m.content}
                </div>
              </li>
            ))}
            {busy && (
              <li className="flex justify-start" aria-label={`${initial.persona} is typing`}>
                <div className="flex gap-1.5 rounded-2xl bg-sunken px-4 py-3.5">
                  <span className="size-[7px] animate-pulse rounded-full bg-muted" />
                  <span className="size-[7px] animate-pulse rounded-full bg-muted [animation-delay:150ms]" />
                  <span className="size-[7px] animate-pulse rounded-full bg-muted [animation-delay:300ms]" />
                </div>
              </li>
            )}
            <li ref={end} aria-hidden="true" />
          </ol>

          {error && <p className="mx-4 mb-2 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{error}</p>}

          <form
            className="flex items-end gap-2.5 border-t border-line p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <label className="flex flex-1">
              <span className="sr-only">Your response</span>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={2}
                maxLength={2000}
                placeholder="Type your response…"
                className="flex-1 resize-none rounded-xl border border-line-strong bg-card px-3.5 py-3 leading-relaxed text-ink outline-none placeholder:text-muted focus:border-accent"
              />
            </label>
            <button type="submit" disabled={busy || !draft.trim()} className={`${buttonClass} min-h-12 rounded-xl px-5`}>
              Send
            </button>
          </form>
        </section>

        <CoachPanel coach={coach} />
      </div>
    </div>
  );
}
