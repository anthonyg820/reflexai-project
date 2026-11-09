/**
 * Next.js calls register() once per server process, before it serves requests.
 * The web app uses the same OpenTelemetry bootstrap as the API
 * (@rehearse/telemetry), so it exports all three signals over OTLP/HTTP to
 * OTEL_EXPORTER_OTLP_ENDPOINT (the Collector sidecar, or otel-lgtm locally):
 *   - traces:  incoming requests, Next.js render spans, outgoing fetch() to the API
 *              (W3C trace context is propagated, so browser -> web -> api is one trace)
 *   - metrics: http.server.request.duration etc. (job="rehearse-web")
 *   - logs:    pino logs from lib/logger.ts, correlated with the active trace
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.OTEL_SDK_DISABLED === "true") return;
  const { startTelemetry } = await import("@rehearse/telemetry");
  startTelemetry({ serviceName: "rehearse-web" });
}
