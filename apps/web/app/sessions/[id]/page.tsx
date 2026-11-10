import type { SessionDetail } from "@rehearse/types";
import { notFound } from "next/navigation";
import { Chat } from "@/components/chat";
import { Scorecard } from "@/components/scorecard";
import { ApiError, api } from "@/lib/api";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let session: SessionDetail;
  try {
    session = await api<SessionDetail>(`/sessions/${id}`);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) notFound();
    throw err;
  }
  return session.status === "completed" ? <Scorecard session={session} /> : <Chat initial={session} />;
}
