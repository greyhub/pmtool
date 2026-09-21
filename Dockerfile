# PMTool production images. One file, two runtime targets: `api` and `web`.
#   docker build --target api -t pmtool-api .
#   docker build --target web -t pmtool-web --build-arg NEXT_PUBLIC_API_URL="" .
# NEXT_PUBLIC_API_URL is baked into the web bundle at build time: leave it empty when the
# API is served from the same origin (the Caddy setup in infra/), or set the API's public origin.
#
# Multi-stage: everything needed to BUILD (compilers' worth of dev dependencies, sources, the build cache) stays in the
# `build` stage. The runtime images only receive what they run — production dependencies and compiled output — so they are
# a fraction of the size, start faster to pull, and carry far less code an attacker could use. Both run as the unprivileged
# `node` user.

FROM node:20.18-slim AS build
WORKDIR /app
# pnpm 12's native launcher segfaults inside this image; pnpm 10 reads the same v9 lockfile.
# Stop pnpm from fetching the version named in package.json's "packageManager" field.
ENV npm_config_manage_package_manager_versions=false
RUN npm install -g pnpm@10 && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages ./packages
RUN pnpm install --frozen-lockfile
COPY apps ./apps
ARG NEXT_PUBLIC_API_URL=""
ARG NEXT_PUBLIC_OPERATOR_NAME=""
ARG NEXT_PUBLIC_CONTACT_EMAIL=""
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_OPERATOR_NAME=$NEXT_PUBLIC_OPERATOR_NAME \
    NEXT_PUBLIC_CONTACT_EMAIL=$NEXT_PUBLIC_CONTACT_EMAIL \
    NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter api run prisma:generate \
 && pnpm exec turbo run build --filter=@pmtool/api --filter=@pmtool/web

# The API with production dependencies only, in a self-contained folder (workspace packages included).
FROM build AS api-prod
RUN pnpm --filter @pmtool/api deploy --prod --legacy /out/api \
 && cd /out/api && node_modules/.bin/prisma generate

FROM node:20.18-slim AS api
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production PORT=3001
COPY --from=api-prod --chown=node:node /out/api ./
USER node
EXPOSE 3001
# Apply pending migrations (never `migrate dev`), then start. Back up first — see docs/van-hanh.md.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main"]

# The web app as Next's standalone server: only the traced files, plus the static assets it serves.
FROM node:20.18-slim AS web
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
