/**
 * Shared OpenTelemetry bootstrap for Node services.
 *
 * Every signal carries the same resource attributes in every cloud, so one
 * Grafana dashboard can slice by service × environment × cloud × version:
 *   service.name, service.version (git SHA), deployment.environment.name, cloud.provider
 *
 * Exporters speak OTLP/HTTP to OTEL_EXPORTER_OTLP_ENDPOINT, which is the
 * Collector sidecar (localhost:4318) in Cloud Run / ECS, or otel-lgtm locally.
 * Telemetry is disabled when OTEL_SDK_DISABLED=true (e.g. unit tests).
 */
import { metrics } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK, logs, metrics as sdkMetrics, resources } from "@opentelemetry/sdk-node";

export interface TelemetryOptions {
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  cloudProvider?: string;
}

let sdk: NodeSDK | undefined;

export function startTelemetry(opts: TelemetryOptions): NodeSDK | undefined {
  if (sdk || process.env.OTEL_SDK_DISABLED === "true") return sdk;
  // Emit stable HTTP semantic conventions (http.server.request.duration, seconds).
  process.env.OTEL_SEMCONV_STABILITY_OPT_IN ??= "http";

  const resource = resources.resourceFromAttributes({
    "service.name": opts.serviceName,
    "service.version": opts.serviceVersion ?? process.env.SERVICE_VERSION ?? "dev",
    "deployment.environment.name": opts.environment ?? process.env.DEPLOY_ENV ?? "local",
    "cloud.provider": opts.cloudProvider ?? process.env.CLOUD_PROVIDER ?? "local",
  });

  sdk = new NodeSDK({
    resource,
    traceExporter: new OTLPTraceExporter(),
    metricReaders: [
      new sdkMetrics.PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter(),
        exportIntervalMillis: Number(process.env.OTEL_METRIC_EXPORT_INTERVAL ?? 15000),
      }),
    ],
    logRecordProcessors: [new logs.BatchLogRecordProcessor(new OTLPLogExporter())],
    instrumentations: [
      getNodeAutoInstrumentations({
        // Noisy and low value for this app.
        "@opentelemetry/instrumentation-fs": { enabled: false },
        "@opentelemetry/instrumentation-dns": { enabled: false },
        "@opentelemetry/instrumentation-net": { enabled: false },
        "@opentelemetry/instrumentation-http": {
          ignoreIncomingRequestHook: (req) => req.url === "/health",
        },
      }),
    ],
  });
  sdk.start();
  return sdk;
}

/** Flush and stop exporters. Call from the app's shutdown hook. */
export async function shutdownTelemetry(): Promise<void> {
  await sdk?.shutdown();
  sdk = undefined;
}

/** Application meter for custom business metrics. */
export const appMeter = () => metrics.getMeter("rehearse");
