FROM node:24-slim AS builder
RUN npm install -g pnpm@12.15.0
WORKDIR /workspace
COPY . .
RUN pnpm install --frozen-lockfile
ARG VITE_SERVER_URL
ENV VITE_SERVER_URL=${VITE_SERVER_URL}
ENV NODE_ENV=production
RUN pnpm --filter web build

FROM nginx:alpine AS runner
COPY --from=builder /workspace/apps/web/dist /usr/share/nginx/html
COPY container/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
