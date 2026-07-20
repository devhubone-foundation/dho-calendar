import type { Request } from "express";
import type { AuthenticatedUser } from "@dho/contracts";

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
