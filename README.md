# PMTool

Ứng dụng quản lý dự án chuẩn PMP — multi-tenant SaaS, thiết kế tối giản/hiện đại (chủ đạo vàng, phụ xám), sáng/tối, song ngữ Việt/Anh.

Đã hoàn thành **Phase 1** (nền tảng + quản lý dự án cốt lõi), **Phase 2** (gamification + AI) và **Phase 3** (tích hợp Telegram). Google Calendar/Drive và các hạng mục thương mại hoá (billing, SSO, ...) thuộc các phase sau — xem [Lộ trình](#lộ-trình) bên dưới.

Tài liệu này dành cho phát triển/vận hành. Hướng dẫn sử dụng cho người dùng cuối (mô tả tính năng, cách thao tác) nằm ở [docs/huong-dan-su-dung.md](docs/huong-dan-su-dung.md); kiến trúc nghiệp vụ/hệ thống, tech stack và luồng dữ liệu chi tiết (kèm sơ đồ) nằm ở [docs/kien-truc.md](docs/kien-truc.md).

## Kiến trúc

| Lớp | Công nghệ |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, next-intl (vi/en), next-themes, TanStack Query |
| Backend | NestJS 10, REST API `/api/v1`, Swagger docs (non-prod) |
| ORM/DB | Prisma + PostgreSQL 16 |
| Auth | JWT access token + rotating refresh token (httpOnly cookie), argon2id |
| Kanban | `@dnd-kit` (hand-built) |
| Gantt | `@svar-ui/react-gantt` (MIT) |
| Kiểm thử | Vitest (unit), Testcontainers + Supertest (integration), Playwright (E2E) |
| CI | GitHub Actions (`.github/workflows/ci.yml`) |

```
apps/
  web/            Next.js frontend
  api/             NestJS backend
packages/
  shared-types/   Zod schemas dùng chung cho FE/BE (nguồn chân lý cho API contract)
  ui/             Design system (tokens, components, Kanban/Gantt wrappers)
  api-client/     TanStack Query hooks bọc quanh REST API
  config/         tsconfig/eslint/prettier base dùng chung
infra/            docker-compose cho Postgres + Redis (dev)
.github/workflows/ CI pipeline
```

Đa tenant được cách ly ở tầng ứng dụng: mọi bảng tenant-owned có `organizationId`; một Prisma Client Extension (`tenant-scoping.extension.ts`) tự động thêm điều kiện đó vào mọi truy vấn dựa trên `AsyncLocalStorage` request context, nên service không thể vô tình quên scope.

## Chức năng đã có

**Phase 1 — nền tảng + quản lý dự án:**
- Đăng ký/đăng nhập/refresh/logout, mời thành viên vào tổ chức, RBAC 5 vai trò (Owner/Admin/PM/Member/Viewer)
- Dự án, WBS (task phân cấp cha/con), phụ thuộc công việc (FS/SS/FF/SF), bình luận
- Bảng Kanban kéo-thả, biểu đồ Gantt
- Nhật ký Rủi ro & Vấn đề (chấm điểm mức độ nghiêm trọng = khả năng × ảnh hưởng)
- Dashboard tổ chức + dự án (thống kê trạng thái, công việc quá hạn, rủi ro đang mở)
- Nhật ký hoạt động (ActivityLog) — nguồn dữ liệu cho gamification
- Giao diện responsive (sidebar → drawer trên di động), sáng/tối, Việt/Anh

**Phase 2 — gamification + AI:**
- Điểm hoạt động, chuỗi ngày (streak, theo múi giờ UTC+7), 6 huy hiệu, bảng xếp hạng theo tổ chức
- Tóm tắt công việc bằng AI, gợi ý công việc con bằng AI, tạo công việc từ mô tả ngôn ngữ tự nhiên — qua Anthropic Claude API (cần `ANTHROPIC_API_KEY`, xem bên dưới); AI chỉ đề xuất, người dùng luôn xác nhận trước khi tạo công việc thật

**Phase 3 — tích hợp Telegram:**
- Liên kết tài khoản Telegram cá nhân (trang `/settings`, độc lập với tổ chức) qua mã liên kết dùng một lần và bot Telegram dùng chung (cần `TELEGRAM_BOT_TOKEN`, xem bên dưới)
- Thông báo tức thì qua Telegram khi được giao công việc
- Nhắc nhở hằng ngày (8:00 giờ Việt Nam) cho công việc đến hạn trong ngày, qua `@nestjs/schedule`
- Thiếu `TELEGRAM_BOT_TOKEN` thì tính năng tự tắt êm (không lỗi khi khởi động, chỉ ẩn/báo lỗi rõ ràng ở nơi cần bot thật)

## Yêu cầu môi trường

- Node.js >= 20.18 (xem `.nvmrc`)
- pnpm 12.4.1 (`corepack enable`, hoặc cài standalone từ https://pnpm.io/installation)
- Docker + Docker Compose (chạy Postgres/Redis, và cần cho integration test qua Testcontainers)

## Bắt đầu

```bash
# 1. Cài đặt phụ thuộc
pnpm install

# 2. Cấu hình biến môi trường cho API (web dùng giá trị mặc định hợp lý, không bắt buộc)
cp apps/api/.env.example apps/api/.env
# -> sửa JWT_ACCESS_SECRET / JWT_REFRESH_SECRET thành chuỗi ngẫu nhiên >= 32 ký tự
# -> ANTHROPIC_API_KEY là tuỳ chọn: thiếu thì cả app vẫn chạy bình thường,
#    chỉ riêng 3 tính năng AI trả lỗi rõ ràng thay vì hoạt động
# -> TELEGRAM_BOT_TOKEN/TELEGRAM_WEBHOOK_SECRET cũng tuỳ chọn: thiếu thì
#    thông báo Telegram tự tắt êm. Lấy token từ @BotFather trên Telegram.
#    Webhook Telegram cần API_PUBLIC_URL là URL HTTPS truy cập công khai
#    được (vd. qua ngrok khi phát triển local) — localhost sẽ không nhận
#    được webhook thật, nhưng phần liên kết tài khoản vẫn cấu hình được.

# 3. Khởi động Postgres + Redis
docker compose -f infra/docker-compose.yml up -d

# 4. Migrate database
pnpm --filter api run prisma:migrate

# 5. Chạy cả hai app song song
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:3001/api/v1 (Swagger tại `/api/docs` khi `NODE_ENV != production`)

## Lệnh chung

Chạy từ thư mục gốc (Turborepo điều phối qua các package):

| Lệnh | Ý nghĩa |
|---|---|
| `pnpm dev` | Chạy `apps/web` + `apps/api` ở chế độ dev |
| `pnpm build` | Build toàn bộ package/app |
| `pnpm lint` | ESLint toàn workspace |
| `pnpm typecheck` | `tsc --noEmit` toàn workspace |
| `pnpm test` | Unit test (Vitest, Prisma được mock) |
| `pnpm test:integration` | Integration test API qua Testcontainers — cần Docker, không cần Postgres chạy sẵn (container ephemeral tự khởi động) |
| `pnpm test:e2e` | Playwright E2E — cần API + Postgres/Redis đang chạy (`pnpm dev` + `docker compose up`); browser cài qua `pnpm --filter web exec playwright install chromium` |

Kiểm tra toàn bộ trước khi commit (giống CI job `checks`):

```bash
pnpm exec turbo run build lint typecheck test
```

## Kiểm thử

- **Unit** (`apps/*/src/**/*.spec.ts`): business logic với Prisma mock — phát hiện cycle trong WBS/dependency graph, tính điểm rủi ro, AuditLogInterceptor, v.v.
- **Integration** (`apps/api/test/integration`): chạy qua HTTP thật (Supertest) trên một Postgres ephemeral (Testcontainers), xác nhận cách ly đa tenant và RBAC hoạt động đúng qua toàn bộ pipeline guard thật, không phải mock.
- **E2E** (`apps/web/e2e`): Playwright — đăng ký/đăng nhập, tạo tổ chức, tạo dự án, tạo task+subtask+dependency, kéo-thả Kanban (giữ nguyên sau khi reload), chuyển theme (giữ nguyên sau khi reload), chuyển ngôn ngữ (giữ nguyên qua cookie `NEXT_LOCALE`), hoàn thành công việc → điểm hiện trên bảng xếp hạng, trang `/settings` render đúng và báo lỗi êm khi Telegram chưa cấu hình. Không có E2E cho AI hay round-trip Telegram thật (gọi API thật sẽ tốn phí/cần webhook công khai, không ổn định trong CI) — cả hai chỉ kiểm thử đầy đủ ở mức unit + integration (mock/HTTP giả lập).

## CI

`.github/workflows/ci.yml` chạy 3 job tuần tự trên mỗi push/PR vào `main`: `checks` (lint/typecheck/build/unit) → `integration` → `e2e`. Để bắt buộc CI xanh trước khi merge, bật "Require status checks to pass" trong GitHub branch protection cho nhánh `main` (cấu hình phía repo, không nằm trong workflow file).

## Lộ trình

Chưa thiết kế/xây dựng, dự kiến ở các phase sau:

- **Phase 4** — Tích hợp Google Calendar, Google Drive (OAuth2 per-organization, mã hoá credential khi lưu trữ), billing/subscription (Stripe), giới hạn theo gói, SSO (SAML/OIDC), Postgres RLS (defense-in-depth), rate limiting, observability, EVM/cost tracking, resource capacity planning, stakeholder matrices, procurement.
