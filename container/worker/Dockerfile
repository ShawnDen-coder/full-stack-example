FROM docker.io/library/node:24-slim AS builder
RUN npm install -g pnpm@12.15.0
WORKDIR /workspace
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter worker build
RUN pnpm --filter worker deploy --prod --ignore-scripts /out
RUN find /out/node_modules -path "*/@full-stack-example/*/src" -type d -prune -exec rm -rf {} +

FROM docker.io/library/node:24-slim AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder --chown=node:node /out /app
USER node
CMD ["node", "dist/index.mjs"]
