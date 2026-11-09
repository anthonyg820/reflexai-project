"use server";
import type { CreateScenarioRequest, Scenario, SessionDetail } from "@rehearse/types";
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
  const scenario = await api<Scenario>("/scenarios", { method: "POST", body: JSON.stringify(body) });
  redirect(`/scenarios/${scenario.id}`);
}

export async function startSession(scenarioId: string) {
  const session = await api<SessionDetail>("/sessions", { method: "POST", body: JSON.stringify({ scenarioId }) });
  redirect(`/sessions/${session.id}`);
}
