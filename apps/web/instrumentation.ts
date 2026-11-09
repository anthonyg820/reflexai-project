import { registerOTel } from "@vercel/otel";

/**
 * Next.js calls register() once per server process. @vercel/otel exports
 * OTLP/HTTP to OTEL_EXPORTER_OTLP_ENDPOINT (the Collector sidecar) and
 * propagates W3C trace context on outgoing fetch() calls, so a browser
 * request → web → api shows up as one trace.
 */
export function register() {
  if (process.env.OTEL_SDK_DISABLED === "true") return;
  registerOTel({
    serviceName: "rehearse-web",
    attributes: {
      "service.version": process.env.SERVICE_VERSION ?? "dev",
      "deployment.environment.name": process.env.DEPLOY_ENV ?? "local",
      "cloud.provider": process.env.CLOUD_PROVIDER ?? "local",
    },
  });
}
