import { appMeter } from "@rehearse/telemetry";

const meter = appMeter();

export const sessionsStarted = meter.createCounter("rehearse.sessions.started", {
  description: "Roleplay sessions started",
});
export const sessionsCompleted = meter.createCounter("rehearse.sessions.completed", {
  description: "Roleplay sessions completed and scored",
});
export const sessionScore = meter.createHistogram("rehearse.session.score", {
  description: "Session score (0-100)",
  unit: "1",
  advice: { explicitBucketBoundaries: [0, 20, 40, 50, 60, 70, 75, 80, 90, 100] },
});
