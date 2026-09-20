# PMTool production image. One build, two runtime targets: `api` and `web`.
#   docker build --target api -t pmtool-api .
#   docker build --target web -t pmtool-web --build-arg NEXT_PUBLIC_API_URL="" .
# NEXT_PUBLIC_API_URL is baked into the web bundle at build time: leave it empty when the
# API is served from the same origin (the Caddy setup in infra/), or set the API's public origin.

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

FROM build AS api
ENV NODE_ENV=production PORT=3001
EXPOSE 3001
# Apply pending migrations (never `migrate dev`), then start. Back up first — see docs/van-hanh.md.
CMD ["sh", "-c", "pnpm --filter api exec prisma migrate deploy && node apps/api/dist/main"]

FROM build AS web
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["pnpm", "--filter", "web", "exec", "next", "start", "-p", "3000"]
