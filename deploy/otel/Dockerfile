# Collector sidecar image: upstream contrib distribution + our config.
# Built once and promoted by digest like the app images.
FROM otel/opentelemetry-collector-contrib:0.164.0
COPY collector.yaml /etc/otelcol-contrib/config.yaml
