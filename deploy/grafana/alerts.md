# Alert: API 5xx ratio

Provisioned as code from `alerting/rehearse-alerts.json` by `scripts/grafana-import.mjs`
(`make grafana-import` locally, `bootstrap/6-grafana-dashboard.cmd` for Grafana Cloud with an Admin
token) into the **Rehearse** folder, evaluated every 30s. The query:

```promql
sum by (cloud_provider, deployment_environment_name) (
  rate(http_server_request_duration_seconds_count{job=~".*rehearse-api", http_response_status_code=~"5.."}[2m])
)
/
sum by (cloud_provider, deployment_environment_name) (
  rate(http_server_request_duration_seconds_count{job=~".*rehearse-api"}[2m])
)
```

- Condition: `IS ABOVE 0.02` for `1m`
- Labels: `severity=page`, `service=rehearse-api`
- Contact point: whatever the default notification policy uses. Add a Slack webhook or email
  contact point in Grafana to get paged; the rule shows Firing in Alerting either way.

In Scenario A this fires about 2 minutes after the bad revision takes traffic, before any customer
reports it. The deploy annotation on the dashboard shows which release caused it.

Add a synthetic check too (Testing & synthetics → Synthetics → Add check → HTTP) on
`<web url>/health` for each cloud's prod, every 1 minute, from 2 probes.
