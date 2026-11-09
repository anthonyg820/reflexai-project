// Preloaded with `node --require ./dist/otel.js` so instrumentation patches
// http/express/pg/pino before the app imports them.
import { startTelemetry } from "@rehearse/telemetry";

startTelemetry({ serviceName: "rehearse-api" });
