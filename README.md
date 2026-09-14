# PMTool

Ứng dụng quản lý dự án chuẩn PMP, multi-tenant SaaS. Xem kế hoạch triển khai đầy đủ tại `/Users/grey/.claude/plans/vectorized-orbiting-tome.md` (Phase 1: nền tảng + core PM).

## Kiến trúc

- `apps/web` — Next.js 14 (App Router), TypeScript, Tailwind, next-intl (vi/en), next-themes.
- `apps/api` — NestJS 10, REST API `/api/v1`, Prisma + PostgreSQL, JWT auth, multi-tenant scoping.
- `packages/shared-types` — Zod schemas dùng chung cho cả frontend và backend (nguồn chân lý cho API contract).
- `packages/config` — tsconfig/eslint/prettier base dùng chung.
- `infra/` — docker-compose cho Postgres + Redis (dev và test).

## Yêu cầu môi trường

- Node.js >= 20.18 (xem `.nvmrc`)
- pnpm >= 9 (`corepack enable` hoặc cài standalone từ https://pnpm.io/installation)
- Docker + Docker Compose (chạy Postgres/Redis local)

## Bắt đầu

```bash
cp .env.example .env
docker compose -f infra/docker-compose.yml up -d
pnpm install
pnpm --filter @pmtool/api prisma:migrate
pnpm --filter @pmtool/api prisma:seed
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:3001/api/v1 (Swagger docs tại `/api/docs` khi không chạy production)

## Lệnh chung

```bash
pnpm turbo run lint typecheck test   # lint + typecheck + unit test toàn bộ workspace
pnpm --filter @pmtool/api test:integration   # integration test (cần Docker)
pnpm test:e2e                                 # Playwright E2E (cần docker-compose.test.yml)
```
