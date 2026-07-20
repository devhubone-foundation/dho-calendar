import { SetMetadata } from "@nestjs/common";

export const ALLOW_WHILE_PASSWORD_CHANGE_REQUIRED_KEY = "allowWhilePasswordChangeRequired";

export const AllowWhilePasswordChangeRequired = (): ReturnType<typeof SetMetadata> =>
  SetMetadata(ALLOW_WHILE_PASSWORD_CHANGE_REQUIRED_KEY, true);
