import "dotenv/config";
import "reflect-metadata";
import cookieParser from "cookie-parser";
import { NestFactory } from "@nestjs/core";
import type { ApiEnv } from "@dho/config";

import { AppModule } from "./app.module";
import { APP_ENV } from "./config/config.tokens";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const env = app.get<ApiEnv>(APP_ENV);

  app.use(cookieParser());
  app.enableCors({ origin: env.APP_ORIGIN, credentials: true });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.setGlobalPrefix("api");

  await app.listen(env.PORT);
  // eslint-disable-next-line no-console
  console.log(`dho-calendar API listening on port ${env.PORT}`);
}

bootstrap().catch((error: unknown) => {
  console.error("Failed to start API:", error);
  process.exitCode = 1;
});
