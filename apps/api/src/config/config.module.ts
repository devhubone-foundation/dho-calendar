import { Global, Module } from "@nestjs/common";
import { parseApiEnv } from "@dho/config";

import { APP_ENV } from "./config.tokens";

@Global()
@Module({
  providers: [
    {
      provide: APP_ENV,
      useFactory: () => parseApiEnv(),
    },
  ],
  exports: [APP_ENV],
})
export class ConfigModule {}
