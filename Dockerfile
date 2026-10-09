# NoorAI Tracks on the school's own server (deploy/README: docs/DEPLOY-R730.md).
# One image: the built app plus the tools that update the database on start (drizzle-kit, tsx),
# so the server needs nothing but Docker. Built and run by deploy/docker-compose.yml.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 NPM_CONFIG_UPDATE_NOTIFIER=false PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
# /api/health checks the app and its database (200 = fine).
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "scripts/docker-start.sh"]
