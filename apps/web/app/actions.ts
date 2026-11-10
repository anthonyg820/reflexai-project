"use server";
import { DIFFICULTIES, type CreateScenarioRequest, type Difficulty, type Scenario, type SessionDetail } from "@rehearse/types";
import { redirect } from "next/navigation";
import { api } from "@/lib/api";

export async function createScenario(formData: FormData) {
  const body: CreateScenarioRequest = {
    title: String(formData.get("title") ?? ""),
    persona: String(formData.get("persona") ?? ""),
    description: String(formData.get("description") ?? ""),
    personaLines: String(formData.get("personaLines") ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
  };
  const difficulty = String(formData.get("difficulty") ?? "");
  if ((DIFFICULTIES as readonly string[]).includes(difficulty)) body.difficulty = difficulty as Difficulty;
  const channel = String(formData.get("channel") ?? "").trim();
  if (channel) body.channel = channel;
  const skills = String(formData.get("skills") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
  if (skills.length) body.skills = skills;
  const minutes = Number(formData.get("minutes"));
  if (Number.isInteger(minutes) && minutes > 0) body.minutes = minutes;
  const scenario = await api<Scenario>("/scenarios", { method: "POST", body: JSON.stringify(body) });
  redirect(`/scenarios/${scenario.id}`);
}

export async function startSession(scenarioId: string) {
  const session = await api<SessionDetail>("/sessions", { method: "POST", body: JSON.stringify({ scenarioId }) });
  redirect(`/sessions/${session.id}`);
}
