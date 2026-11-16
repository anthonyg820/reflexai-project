/**
 * Scoring rubrics. Each rubric is data: a starting score, a passing score and
 * a list of signals worth points. One small engine scores them all, so adding
 * a rubric (Empathy, Optimism, Sales persistence...) is a data change here
 * plus its id in KNOWN_RUBRICS in @rehearse/config (enforced by scoring.test.ts).
 *
 * Scenarios pick their rubric. SCORING_RUBRIC (runtime config) is the
 * environment's default, used by scenarios without one.
 */
import type { RubricRule } from "@rehearse/types";

export interface Transcript {
  traineeMessages: string[];
}

export type SignalKind =
  /** points × distinct phrases used anywhere in the transcript */
  | "distinct-phrases"
  /** points × phrase matches, counted per reply */
  | "phrase-hits"
  /** points × replies that contain any of the phrases */
  | "replies-with-phrase"
  /** points × replies containing a question mark */
  | "questions"
  /** points × replies */
  | "replies"
  /** points × replies under 4 words */
  | "short-replies"
  /** points × replies over 60 words */
  | "long-replies";

export interface Signal {
  kind: SignalKind;
  points: number;
  label: string;
  phrases?: string[];
}

export interface RubricDefinition {
  id: string;
  name: string;
  description: string;
  base: number;
  passingScore: number;
  signals: Signal[];
  score(t: Transcript): number;
}

export const EMPATHY = ["understand", "sorry", "hear you", "that sounds", "makes sense", "feel", "thank you for"];
export const REFLECTIONS = ["it sounds like", "what i'm hearing", "so you're saying", "you feel", "you're feeling"];

// Phones and some keyboards type curly apostrophes ("I’m"), which never matched
// phrases like "what i'm hearing". Normalise them before matching.
const normalise = (text: string) => text.replace(/[\u2018\u2019]/g, "'");
const countHits = (text: string, phrases: string[]) => phrases.filter((p) => text.includes(p)).length;
const words = (m: string) => m.trim().split(/\s+/).filter(Boolean).length;
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function count(signal: Signal, lower: string[]): number {
  const phrases = signal.phrases ?? [];
  switch (signal.kind) {
    case "distinct-phrases":
      return countHits(lower.join(" "), phrases);
    case "phrase-hits":
      return lower.reduce((n, m) => n + countHits(m, phrases), 0);
    case "replies-with-phrase":
      return lower.filter((m) => countHits(m, phrases) > 0).length;
    case "questions":
      return lower.filter((m) => m.includes("?")).length;
    case "replies":
      return lower.length;
    case "short-replies":
      return lower.filter((m) => words(m) < 4).length;
    case "long-replies":
      return lower.filter((m) => words(m) > 60).length;
  }
}

export function scoreWith(rubric: Pick<RubricDefinition, "base" | "signals">, { traineeMessages }: Transcript): number {
  if (traineeMessages.length === 0) return 0;
  const lower = traineeMessages.map((m) => normalise(m.toLowerCase()));
  return clamp(rubric.signals.reduce((total, s) => total + s.points * count(s, lower), rubric.base));
}

/** The scoring rules as shown on the Rubrics page. */
export function describeRules(rubric: RubricDefinition): RubricRule[] {
  const sign = (n: number) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);
  return [{ label: "Starting score", points: String(rubric.base) }, ...rubric.signals.map((s) => ({ label: s.label, points: sign(s.points) }))];
}

type Def = Omit<RubricDefinition, "score">;
const define = (d: Def): RubricDefinition => ({ ...d, score: (t) => scoreWith(d, t) });

const DEFINITIONS: Def[] = [
  {
    id: "rubric-a",
    name: "Empathy basics",
    description: "Rewards warmth: naming feelings and acknowledging what the other person is going through.",
    base: 40,
    passingScore: 70,
    signals: [
      { kind: "distinct-phrases", points: 10, label: "Each empathy phrase used (“I understand”, “that sounds…”, counted once each)", phrases: EMPATHY },
      { kind: "replies", points: 5, label: "Each reply" },
    ],
  },
  {
    id: "rubric-b",
    name: "Active listening",
    description: "Rewards listening skills: asking questions and reflecting the other person's words back.",
    base: 30,
    passingScore: 75,
    signals: [
      { kind: "questions", points: 12, label: "Each reply containing a question" },
      { kind: "phrase-hits", points: 15, label: "Each reflection (“it sounds like…”, “so you’re saying…”)", phrases: REFLECTIONS },
      { kind: "replies", points: 4, label: "Each reply" },
      { kind: "short-replies", points: -8, label: "Each reply under 4 words" },
    ],
  },
  {
    id: "optimism",
    name: "Optimism",
    description: "Rewards hopeful, forward-looking language that highlights progress and next steps, without dismissing the problem.",
    base: 35,
    passingScore: 70,
    signals: [
      {
        kind: "distinct-phrases",
        points: 8,
        label: "Each hopeful phrase used (“next step”, “progress”, “you’ve already…”)",
        phrases: ["next step", "progress", "you've already", "you have already", "we can", "you can", "good news", "on the bright side", "hopeful", "improving", "better", "glad"],
      },
      {
        kind: "replies-with-phrase",
        points: -10,
        label: "Each defeatist reply (“nothing we can do”, “unfortunately”, “impossible”)",
        phrases: ["nothing we can do", "nothing i can do", "unfortunately", "impossible", "no way", "there's no point", "can't help"],
      },
      { kind: "replies", points: 4, label: "Each reply" },
    ],
  },
  {
    id: "sales-persistence",
    name: "Sales persistence",
    description: "Rewards discovery, clear value, handling objections and asking for a next step, instead of giving up at the first no.",
    base: 25,
    passingScore: 70,
    signals: [
      { kind: "questions", points: 8, label: "Each discovery question" },
      {
        kind: "distinct-phrases",
        points: 7,
        label: "Each value point (“save”, “benefit”, “worth it”)",
        phrases: ["save", "benefit", "value", "worth it", "lower rate", "no fees", "earn", "flexib"],
      },
      {
        kind: "replies-with-phrase",
        points: 10,
        label: "Each objection handled (“that’s fair”, “what if…”, “many customers…”)",
        phrases: ["that's fair", "i understand your concern", "what if", "many customers", "compared to", "fair question"],
      },
      {
        kind: "distinct-phrases",
        points: 12,
        label: "Each next step asked for (“schedule”, “follow up”, “get started”)",
        phrases: ["schedule", "follow up", "follow-up", "get started", "set up a time", "next week", "send you"],
      },
      { kind: "short-replies", points: -6, label: "Each reply under 4 words" },
    ],
  },
  {
    id: "de-escalation",
    name: "De-escalation",
    description: "Rewards calm validation and collaborative language; penalizes blame, policy-speak and telling people to calm down.",
    base: 35,
    passingScore: 70,
    signals: [
      {
        kind: "distinct-phrases",
        points: 8,
        label: "Each calming phrase used (“I hear you”, “that makes sense”, “let’s…”)",
        phrases: ["i hear you", "that makes sense", "i understand", "you're right", "let's", "i'm here", "take your time", "i'd be upset too"],
      },
      {
        kind: "replies-with-phrase",
        points: -12,
        label: "Each reply that blames or dismisses (“calm down”, “policy”, “you need to”)",
        phrases: ["calm down", "policy", "not my fault", "you need to", "that's not true", "relax"],
      },
      { kind: "replies", points: 4, label: "Each reply" },
      { kind: "long-replies", points: -5, label: "Each reply over 60 words" },
    ],
  },
  {
    id: "clear-explanation",
    name: "Clear explanation",
    description: "Rewards plain language and checking understanding (teach-back); penalizes jargon and walls of text.",
    base: 40,
    passingScore: 70,
    signals: [
      {
        kind: "distinct-phrases",
        points: 10,
        label: "Each understanding check (“does that make sense?”, “to recap…”)",
        phrases: ["does that make sense", "tell me back", "any questions", "what questions", "to recap", "in other words", "in plain terms"],
      },
      {
        kind: "replies-with-phrase",
        points: -6,
        label: "Each reply with jargon (“contraindicated”, “adjudicated”, “amortization”…)",
        phrases: ["contraindicated", "titrat", "adjudicat", "pursuant", "amortization", "escrow disbursement", "deductible accumulator"],
      },
      { kind: "replies", points: 4, label: "Each reply" },
      { kind: "long-replies", points: -8, label: "Each reply over 60 words" },
    ],
  },
  {
    id: "service-recovery",
    name: "Service recovery",
    description: "Rewards apologizing, taking ownership and committing to a concrete next step with a timeline.",
    base: 30,
    passingScore: 70,
    signals: [
      { kind: "distinct-phrases", points: 8, label: "Apologizing (“sorry”, “I apologize”)", phrases: ["sorry", "apologize"] },
      {
        kind: "distinct-phrases",
        points: 10,
        label: "Each ownership phrase (“I’ll”, “let me”, “I’m going to”)",
        phrases: ["i'll", "i will", "let me", "i'm going to", "i can"],
      },
      {
        kind: "distinct-phrases",
        points: 10,
        label: "Each concrete commitment (“today”, “within 24 hours”, “case number”)",
        phrases: ["today", "tomorrow", "within", "hours", "case number", "reference number", "call you back"],
      },
      {
        kind: "replies-with-phrase",
        points: -10,
        label: "Each deflecting reply (“not our fault”, “you should have”)",
        phrases: ["not our fault", "nothing i can do", "you should have", "policy", "not my department"],
      },
      { kind: "replies", points: 3, label: "Each reply" },
    ],
  },
  {
    id: "crisis-safety",
    name: "Crisis safety",
    description: "Rewards asking directly about safety and building a plan together; penalizes minimizing. Pass mark is higher.",
    base: 25,
    passingScore: 75,
    signals: [
      {
        kind: "distinct-phrases",
        points: 15,
        label: "Each direct safety question (“are you safe right now?”)",
        phrases: ["are you safe", "thinking about suicide", "thoughts of suicide", "hurt yourself", "thoughts of ending", "right now"],
      },
      {
        kind: "distinct-phrases",
        points: 10,
        label: "Each step toward a plan (“someone you trust”, “stay with you”, “988”)",
        phrases: ["someone you trust", "stay with you", "plan", "988", "emergency", "who can you", "reach out to"],
      },
      { kind: "distinct-phrases", points: 5, label: "Each empathy phrase used", phrases: EMPATHY },
      {
        kind: "replies-with-phrase",
        points: -12,
        label: "Each minimizing reply (“cheer up”, “it’s not that bad”)",
        phrases: ["cheer up", "not that bad", "you'll be fine", "don't think like that", "others have it worse"],
      },
    ],
  },
];

export const RUBRICS: Record<string, RubricDefinition> = Object.fromEntries(DEFINITIONS.map((d) => [d.id, define(d)]));

/** Throws on an unknown rubric — this is the code path that 500s in Scenario A. */
export function getRubric(id: string): RubricDefinition {
  const rubric = RUBRICS[id];
  if (!rubric) throw new Error(`Unknown scoring rubric "${id}"`);
  return rubric;
}
