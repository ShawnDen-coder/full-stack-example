FROM node:24-slim AS builder
RUN npm install -g pnpm@11.0.9
WORKDIR /workspace
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter server build
RUN pnpm --filter server deploy --prod --ignore-scripts /out
RUN find /out/node_modules -path "*/@my-better-t-app/*/src" -type d -prune -exec rm -rf {} +
RUN cp -R packages/db/src/migrations /out/migrations

FROM node:24-slim AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder --chown=node:node /out /app
USER node
EXPOSE 3000
CMD ["node", "dist/index.mjs"]
