import "server-only";
import pino from "pino";

/**
 * Structured server-side logger. The OpenTelemetry pino instrumentation adds
 * trace_id/span_id to each line and forwards records to the OTLP logs exporter.
 */
export const logger = pino({
  name: "rehearse-web",
  level: process.env.LOG_LEVEL ?? "info",
  formatters: { level: (label) => ({ level: label }) },
});
