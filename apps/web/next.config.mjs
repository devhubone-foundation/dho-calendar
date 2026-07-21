import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Render deployment (Dockerfile.render, GitHub issue #6): a self-contained
  // server bundle keeps the free-tier (512 MB RAM) runtime image lean.
  output: "standalone",
  // Required for correct dependency tracing from a pnpm workspace app that
  // isn't at the monorepo root (Next.js standalone-output docs).
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
