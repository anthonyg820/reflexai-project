/**
 * Rules-based coaching: per-criterion scores (0-5), tips for the next reply,
 * and key moments for the scorecard. Pure functions over the trainee's
 * messages, independent of the environment's scoring rubric (which still
 * decides the official score and pass/fail, and stays the Scenario A switch).
 */
import type { Coaching, CriterionScore, KeyMoment, SessionFeedback } from "@rehearse/types";
import { EMPATHY, REFLECTIONS } from "./rubrics";

/** Curly apostrophes (phones type “I’m”) never match phrases like "what i'm hearing". */
const normalise = (text: string) => text.replace(/[\u2018\u2019]/g, "'");

const OPEN_STARTS = ["what", "how", "which", "tell me", "can you tell", "could you tell", "would you", "when did", "where"];

const words = (m: string) => m.trim().split(/\s+/).filter(Boolean).length;
const has = (m: string, phrases: string[]) => phrases.some((p) => normalise(m.toLowerCase()).includes(p));
const isOpenQuestion = (m: string) => {
  const lower = normalise(m.toLowerCase());
  return lower.includes("?") && lower.split(/[.!?]\s*/).some((s: string) => OPEN_STARTS.some((w) => s.trim().startsWith(w)));
};
const clamp5 = (n: number) => Math.max(0, Math.min(5, Math.round(n)));
const firstName = (persona: string) => persona.split(",")[0]!.trim();
const shorten = (m: string, max = 90) => (m.length > max ? `${m.slice(0, max - 1).trimEnd()}…` : m);

interface Signals {
  n: number;
  empathyHits: number;
  openQuestions: number;
  reflections: number;
  short: number;
  stacked: number;
  long: number;
}

function signals(messages: string[]): Signals {
  const lower = messages.map((m) => normalise(m.toLowerCase()));
  return {
    n: messages.length,
    empathyHits: EMPATHY.filter((p) => lower.some((m) => m.includes(p))).length,
    openQuestions: messages.filter(isOpenQuestion).length,
    reflections: lower.filter((m) => REFLECTIONS.some((p) => m.includes(p))).length,
    short: messages.filter((m) => words(m) < 4).length,
    stacked: messages.filter((m) => (m.match(/\?/g) ?? []).length > 1).length,
    long: messages.filter((m) => words(m) > 60).length,
  };
}

export function criteria(messages: string[]): CriterionScore[] {
  const s = signals(messages);
  if (s.n === 0) {
    return [
      { id: "empathy", name: "Empathy", score: 0, note: "No replies yet." },
      { id: "open-questions", name: "Open questions", score: 0, note: "No replies yet." },
      { id: "reflection", name: "Reflective listening", score: 0, note: "No replies yet." },
      { id: "pacing", name: "Pacing", score: 0, note: "No replies yet." },
    ];
  }
  const empathy = clamp5(1 + s.empathyHits * 1.5);
  const open = clamp5((5 * s.openQuestions) / Math.max(1, Math.ceil(s.n / 2)));
  const reflection = clamp5(s.reflections === 0 ? 1 : 1 + s.reflections * 2);
  const pacing = clamp5(5 - s.short - s.stacked - s.long);
  return [
    {
      id: "empathy",
      name: "Empathy",
      score: empathy,
      note:
        empathy >= 4
          ? "You named the feeling and acknowledged it before moving on."
          : empathy >= 2
            ? "Some warmth came through. Name the feeling more directly (“that sounds exhausting”)."
            : "Acknowledge how they feel before problem-solving.",
    },
    {
      id: "open-questions",
      name: "Open questions",
      score: open,
      note:
        s.openQuestions > 0
          ? `${s.openQuestions} of ${s.n} replies invited them to say more.${open < 4 ? " Ask a few more “what” or “how” questions." : ""}`
          : "Try a “what” or “how” question so they can tell you more in their own words.",
    },
    {
      id: "reflection",
      name: "Reflective listening",
      score: reflection,
      note:
        s.reflections > 0
          ? `You reflected their words back ${s.reflections === 1 ? "once" : `${s.reflections} times`}.${reflection < 4 ? " Do it earlier, before asking the next question." : ""}`
          : "Mirror what you heard before responding (“it sounds like…”).",
    },
    {
      id: "pacing",
      name: "Pacing",
      score: pacing,
      note:
        pacing >= 5
          ? "One idea per reply, at a comfortable length."
          : [
              s.short ? `${s.short} very short ${s.short === 1 ? "reply" : "replies"}` : "",
              s.stacked ? `${s.stacked} ${s.stacked === 1 ? "reply" : "replies"} with stacked questions` : "",
              s.long ? `${s.long} long ${s.long === 1 ? "reply" : "replies"}` : "",
            ]
              .filter(Boolean)
              .join(", ")
              .replace(/^./, (c) => c.toUpperCase()) + ". Ask one thing at a time.",
    },
  ];
}

/** Live coaching after each reply. */
export function coach(messages: string[], persona: string, lastPersonaLine?: string): Coaching {
  const c = criteria(messages);
  if (messages.length === 0) {
    return {
      criteria: c,
      tips: [{ kind: "try", text: `Start by making ${firstName(persona)} feel heard: thank them for reaching out and ask what’s going on.` }],
    };
  }
  const weakest = [...c].sort((a, b) => a.score - b.score)[0]!;
  const strongest = [...c].sort((a, b) => b.score - a.score)[0]!;
  const who = firstName(persona);
  const echo = lastPersonaLine ? `${who} just said: “${shorten(lastPersonaLine, 70)}” ` : "";
  const tryNext: Record<CriterionScore["id"], string> = {
    empathy: `${echo}Name the feeling before anything else. Try “that sounds really hard.”`,
    "open-questions": `Ask an open question so ${who} can say more: “What’s been the hardest part?”`,
    reflection: `${echo}Reflect back what you heard before offering anything. Try “It sounds like…”`,
    pacing: "Keep the next reply to one idea and one question.",
  };
  const tips: Coaching["tips"] = [{ kind: "try", text: tryNext[weakest.id] }];
  if (strongest.score >= 3 && strongest.id !== weakest.id) {
    const good: Record<CriterionScore["id"], string> = {
      empathy: "Good: you acknowledged the feeling instead of jumping to solutions.",
      "open-questions": "Good: your questions leave room for a real answer.",
      reflection: "Good: reflecting their words back shows you’re listening.",
      pacing: "Good: your replies are focused and easy to answer.",
    };
    tips.push({ kind: "good", text: good[strongest.id] });
  }
  return { criteria: c, tips };
}

/** Scorecard: summary, criteria and up to three key moments. */
export function feedback(messages: string[], persona: string): SessionFeedback {
  const c = criteria(messages);
  const who = firstName(persona);
  const moments: KeyMoment[] = [];
  const strong = messages.filter((m) => has(m, REFLECTIONS) || (has(m, EMPATHY) && words(m) >= 6) || isOpenQuestion(m));
  const missed = messages.filter((m) => words(m) < 4 || (!has(m, EMPATHY) && !has(m, REFLECTIONS) && !m.includes("?")));
  const strongFeedback = (m: string) =>
    has(m, REFLECTIONS)
      ? `Reflects ${who}’s words back, so they know they were heard.`
      : isOpenQuestion(m)
        ? `Open and focused: it lets ${who} choose where to go next.`
        : "Acknowledges the feeling without rushing to fix it.";
  const missedFeedback = (m: string) =>
    words(m) < 4
      ? "Very short. A sentence of acknowledgement first would keep the conversation going."
      : "No acknowledgement or question here. Name what you heard, then invite them to say more.";
  if (strong[0]) moments.push({ kind: "strong", quote: shorten(strong[0], 160), feedback: strongFeedback(strong[0]) });
  if (missed[0]) moments.push({ kind: "missed", quote: shorten(missed[0], 160), feedback: missedFeedback(missed[0]) });
  if (strong[1]) moments.push({ kind: "strong", quote: shorten(strong[1], 160), feedback: strongFeedback(strong[1]) });

  const sorted = [...c].sort((a, b) => b.score - a.score);
  const summary =
    messages.length === 0
      ? "The session ended before any replies."
      : `Strongest: ${sorted[0]!.name.toLowerCase()} (${sorted[0]!.score}/5). The biggest gain is in ${sorted.at(-1)!.name.toLowerCase()} (${sorted.at(-1)!.score}/5).`;
  return { summary, criteria: c, moments };
}
