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
RUN pnpm --filter @dho/database db:generate
RUN pnpm --filter @dho/api build

FROM node:22-alpine AS runtime
RUN corepack enable
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo ./
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
