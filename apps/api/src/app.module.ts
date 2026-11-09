import { Module, type DynamicModule, type OnApplicationShutdown } from "@nestjs/common";
import { shutdownTelemetry } from "@rehearse/telemetry";
import { LoggerModule } from "nestjs-pino";
import { CONFIG, type ApiConfig } from "./config";
import { DbModule } from "./db/db.module";
import { HealthController } from "./health/health.controller";
import { ScenariosController } from "./scenarios/scenarios.controller";
import { ScenariosService } from "./scenarios/scenarios.service";
import { SessionsController } from "./sessions/sessions.controller";
import { SessionsService } from "./sessions/sessions.service";
import { StatsController } from "./stats/stats.controller";
import { StatsService } from "./stats/stats.service";

@Module({})
export class AppModule implements OnApplicationShutdown {
  /** Flush spans/metrics/logs on SIGTERM (Cloud Run and ECS both send it). */
  async onApplicationShutdown() {
    await shutdownTelemetry();
  }

  static forRoot(config: ApiConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        { module: ConfigHolder, global: true, providers: [{ provide: CONFIG, useValue: config }], exports: [CONFIG] },
        LoggerModule.forRoot({
          pinoHttp: {
            level: config.LOG_LEVEL,
            autoLogging: { ignore: (req) => req.url === "/health" },
            // Structured JSON in the cloud; the Collector ships it to Loki.
            ...(config.DEPLOY_ENV === "local" ? {} : { formatters: { level: (label: string) => ({ level: label }) } }),
          },
        }),
        DbModule,
      ],
      controllers: [HealthController, ScenariosController, SessionsController, StatsController],
      providers: [ScenariosService, SessionsService, StatsService],
    };
  }
}

@Module({})
class ConfigHolder {}
