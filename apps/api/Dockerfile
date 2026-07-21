# Build context is the repository root (see compose.yml).
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile

FROM deps AS build
# Workspace deps must be built (not just Prisma-generated) before @dho/api's
# tsc build, since it type-checks against their compiled `dist` output.
RUN pnpm --filter @dho/config --filter @dho/contracts --filter @dho/database build
RUN pnpm --filter @dho/api build

FROM node:22-alpine AS runtime
RUN corepack enable
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo ./
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
