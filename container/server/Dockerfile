FROM docker.io/library/node:24-slim AS builder
RUN npm install -g pnpm@12.15.0
WORKDIR /workspace
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter server build
RUN pnpm --filter server deploy --prod --ignore-scripts /out
RUN find /out/node_modules -path "*/@full-stack-example/*/src" -type d -prune -exec rm -rf {} +
RUN cp -R packages/db/src/migrations /out/migrations

FROM docker.io/library/node:24-slim AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder --chown=node:node /out /app
USER node
EXPOSE 3000
CMD ["node", "dist/index.mjs"]
