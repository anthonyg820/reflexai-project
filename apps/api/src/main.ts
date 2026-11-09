import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigError, loadApiConfig } from "@rehearse/config";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { createPool } from "./db/db.module";
import { migrate } from "./db/migrate";

async function bootstrap() {
  // 1. Validate config BEFORE listening. With CONFIG_VALIDATION=startup an
  //    image that doesn't understand its config exits here, the platform's
  //    startup probe fails, and the old revision keeps serving.
  let config;
  try {
    config = loadApiConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(JSON.stringify({ level: "fatal", msg: err.message, issues: err.issues }));
      process.exit(1);
    }
    throw err;
  }

  // 2. Migrations (expand-only) under an advisory lock.
  if (config.MIGRATE_ON_START) {
    const pool = createPool(config);
    try {
      await migrate(pool);
    } finally {
      await pool.end();
    }
  }

  // 3. Serve.
  const app = await NestFactory.create(AppModule.forRoot(config), { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix("api", { exclude: ["healthz"] });
  app.enableShutdownHooks();
  await app.listen(config.PORT, "0.0.0.0");
  app
    .get(Logger)
    .log(
      `rehearse-api ${config.SERVICE_VERSION} listening on :${config.PORT} (${config.CLOUD_PROVIDER}/${config.DEPLOY_ENV}, rubric=${config.SCORING_RUBRIC}, validation=${config.CONFIG_VALIDATION})`,
    );
}

void bootstrap();
