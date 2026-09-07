# syntax=docker/dockerfile:1

FROM node@sha256:4caaaf42195bcd6f6f3559a413b20cb8f8ad089e231ee874cf7701643966689f AS build
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@11.24.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/logging/package.json packages/logging/package.json
COPY packages/system/package.json packages/system/package.json
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm -r run build
RUN pnpm --filter @full-stack-example/api --prod deploy --legacy /output/app
RUN cp -R apps/web/dist /output/app/public

FROM node@sha256:4caaaf42195bcd6f6f3559a413b20cb8f8ad089e231ee874cf7701643966689f AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /output/app/ ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=6 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then((response)=>{if(!response.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
