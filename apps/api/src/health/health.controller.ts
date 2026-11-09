import { Controller, Get, Inject } from "@nestjs/common";
import type { Health } from "@rehearse/types";
import { CONFIG, type ApiConfig } from "../config";

/**
 * Liveness/startup probe at /health. Not /healthz: Cloud Run's front end reserves
 * paths ending in "z" and answers them with its own 404, so /healthz never reaches us.
 *
 * Liveness/startup probe. Served outside the /api prefix. Because config is
 * validated before the server listens, a revision with bad config never
 * passes this probe and never receives traffic.
 */
@Controller()
export class HealthController {
  constructor(@Inject(CONFIG) private readonly config: ApiConfig) {}

  @Get("health")
  health(): Health {
    return {
      status: "ok",
      service: "rehearse-api",
      version: this.config.SERVICE_VERSION,
      environment: this.config.DEPLOY_ENV,
      cloud: this.config.CLOUD_PROVIDER,
      rubric: this.config.SCORING_RUBRIC,
    };
  }
}
