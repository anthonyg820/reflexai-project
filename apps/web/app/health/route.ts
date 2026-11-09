import { runtimeInfo } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export function GET() {
  const { environment, cloud, version } = runtimeInfo();
  return Response.json({ status: "ok", service: "rehearse-web", version, environment, cloud });
}
