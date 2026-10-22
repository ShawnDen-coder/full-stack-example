FROM node:24-slim AS builder
RUN npm install -g pnpm@11
WORKDIR /app
COPY . .
RUN --mount=type=cache,target=/pnpm-store pnpm install --frozen-lockfile --store-dir /pnpm-store
RUN pnpm --filter worker build

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app /app
WORKDIR /app/apps/worker
CMD ["node", "dist/index.mjs"]
