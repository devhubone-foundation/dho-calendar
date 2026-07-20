import { PrismaClient } from "../generated/client/index.js";

export * from "../generated/client/index.js";

let client: PrismaClient | undefined;

/**
 * Returns a process-wide singleton PrismaClient. Nest's PrismaService wraps
 * this rather than each consumer constructing its own client/connection pool.
 */
export function getPrismaClient(): PrismaClient {
  if (!client) {
    client = new PrismaClient();
  }
  return client;
}
