# Kiến trúc PMTool

Tài liệu này mô tả kiến trúc tổng quan của PMTool ở 4 lớp: kiến trúc nghiệp vụ, kiến trúc hệ thống, tech stack, và các mối liên kết/luồng dữ liệu giữa các thành phần. Đối tượng đọc: kỹ sư tham gia dự án, hoặc người cần đánh giá kiến trúc kỹ thuật. Về cách dùng sản phẩm, xem [huong-dan-su-dung.md](huong-dan-su-dung.md); về cách chạy dự án, xem [README.md](../README.md).

Trạng thái tại thời điểm viết (2026-09-17): Phase 1–3 và Phase 4a (Điều lệ dự án, Các bên liên quan, Danh mục tài liệu) đã triển khai và CI xanh trên nhánh `main`. Tài liệu phản ánh đúng những gì đã build, không phải kế hoạch.

## Mục lục

1. [Kiến trúc nghiệp vụ](#1-kiến-trúc-nghiệp-vụ)
2. [Kiến trúc hệ thống](#2-kiến-trúc-hệ-thống)
3. [Tech stack](#3-tech-stack)
4. [Mối liên kết & luồng dữ liệu](#4-mối-liên-kết--luồng-dữ-liệu)

---

## 1. Kiến trúc nghiệp vụ

### 1.1 Bản đồ năng lực nghiệp vụ (business capabilities)

```mermaid
flowchart TD
    subgraph CORE["Lõi quản lý dự án (Phase 1)"]
        direction TB
        C1["Tổ chức & phân quyền<br/>(Organization · Membership · RBAC 5 vai trò)"]
        C2["Dự án & WBS<br/>(Project · Task phân cấp · Dependency)"]
        C3["Thực thi<br/>(Kanban · Gantt)"]
        C4["Quản trị rủi ro<br/>(Risk · Issue · chấm điểm nghiêm trọng)"]
        C5["Báo cáo<br/>(Dashboard tổ chức/dự án)"]
    end
    subgraph ENGAGE["Thúc đẩy hoạt động (Phase 2)"]
        direction TB
        E1["Gamification<br/>(điểm · streak · huy hiệu · leaderboard)"]
        E2["Trợ lý AI<br/>(tóm tắt · gợi ý subtask · tạo việc bằng NL)"]
    end
    subgraph NOTIFY["Tích hợp thông báo (Phase 3)"]
        direction TB
        N1["Telegram<br/>(liên kết tài khoản · thông báo giao việc · nhắc hạn)"]
    end
    subgraph GOVERN["Quản trị theo PMBOK (Phase 4a)"]
        direction TB
        G1["Điều lệ dự án<br/>(purpose · objectives · scope · approve)"]
        G2["Các bên liên quan<br/>(Power/Interest grid · engagement)"]
        G3["Danh mục tài liệu<br/>(catalog, không lưu file)"]
    end

    C1 --> C2
    C2 --> C3
    C2 --> C4
    C2 & C4 --> C5
    C2 -- "tạo/hoàn thành việc" --> E1
    C2 -- "mô tả việc" --> E2
    C2 -- "giao việc / đến hạn" --> N1
    C2 --> G1
    C2 --> G2
    C2 --> G3
```

Ba nhóm năng lực được xây theo 3 phase, nhưng đều đặt trên cùng một lõi nghiệp vụ: **Tổ chức → Dự án → Công việc**. Gamification, AI và Telegram không phải module độc lập — chúng phản ứng lại các sự kiện xảy ra ở lõi (tạo việc, hoàn thành việc, giao việc), không có nghiệp vụ riêng. Nhóm quản trị PMBOK (Phase 4a) thì ngược lại — là dữ liệu độc lập gắn trực tiếp vào dự án (không phát sinh từ sự kiện công việc), nên chỉ nhận cạnh từ C2 chứ không có cạnh phản hồi ngược lại như E1/E2/N1.

### 1.2 Mô hình miền dữ liệu (domain model)

```mermaid
erDiagram
    ORGANIZATION ||--o{ MEMBERSHIP : "thành viên (role)"
    USER ||--o{ MEMBERSHIP : "tham gia"
    ORGANIZATION ||--o{ PROJECT : "sở hữu"
    PROJECT ||--o{ TASK : "chứa"
    TASK ||--o{ TASK : "công việc con (parentTaskId) · phụ thuộc (TaskDependency)"
    USER }o--o{ TASK : "phụ trách (TaskAssignee)"
    TASK ||--o{ COMMENT : "bình luận"
    PROJECT ||--o{ BOARD_COLUMN : "cột Kanban"
    PROJECT ||--o{ RISK_ISSUE : "rủi ro/vấn đề"
    ORGANIZATION ||--o{ ACTIVITY_LOG : "nhật ký hoạt động"
    ORGANIZATION ||--o{ USER_SCORE : "điểm theo tổ chức"
    USER ||--o{ USER_SCORE : "có điểm"
    USER ||--o{ TELEGRAM_LINK_CODE : "mã liên kết (không có organizationId)"
    PROJECT ||--o| PROJECT_CHARTER : "điều lệ (1 dự án - 1 điều lệ)"
    USER ||--o{ PROJECT_CHARTER : "quản lý / phê duyệt"
    PROJECT ||--o{ STAKEHOLDER : "các bên liên quan"
    USER ||--o{ STAKEHOLDER : "liên kết (tuỳ chọn, có thể là bên ngoài)"
    PROJECT ||--o{ PROJECT_DOCUMENT : "danh mục tài liệu"

    ORGANIZATION { string slug }
    USER { string email "telegramChatId?" }
    PROJECT { string key "WEB, PMT, ..." string status }
    TASK { string humanKey "WEB-1" string status string priority date dueDate }
    RISK_ISSUE { int probability "1-5" int impact "1-5" int severity "= probability × impact" }
    USER_SCORE { int totalPoints int currentStreakDays }
    PROJECT_CHARTER { string status "DRAFT | APPROVED" string sponsorName }
    STAKEHOLDER { string fullName string influence "LOW|MEDIUM|HIGH" string interest "LOW|MEDIUM|HIGH" string currentEngagement string desiredEngagement }
    PROJECT_DOCUMENT { string category string version string status "DRAFT|IN_REVIEW|APPROVED|OBSOLETE" string url }
```

`Task` tự tham chiếu chính nó theo **hai** quan hệ độc lập, gộp chung một cạnh trong sơ đồ trên cho gọn: `parentTaskId` (cây phân cấp WBS) và `TaskDependency` (predecessor/successor FS/SS/FF/SF, có kiểm tra chống vòng lặp khi tạo).

`TelegramLinkCode` là model **duy nhất không có `organizationId`** — nó gắn với `User`, không gắn với tổ chức, vì liên kết Telegram dùng chung cho mọi tổ chức một người dùng tham gia. Mọi model còn lại đều mang `organizationId` và nằm trong tập `TENANT_SCOPED_MODELS` được tự động lọc — xem [2.3](#23-đa-tenant-cách-ly-ở-tầng-ứng-dụng).

`Stakeholder.userId` là FK **tuỳ chọn** tới `User` — PMBOK stakeholder bao gồm cả người ngoài tổ chức (khách hàng, nhà cung cấp) không bao giờ có tài khoản PMTool, nên `fullName`/`role`/`organizationName`/`email`/`phone` luôn là cột dữ liệu thô, không phụ thuộc quan hệ này.

### 1.3 Vòng đời nghiệp vụ chính

```mermaid
flowchart LR
    A["Đăng ký"] --> B["Tạo tổ chức<br/>(role = Owner)"]
    B --> C["Tạo dự án<br/>(role ≥ PM)"]
    C --> D["Tạo công việc"]
    D -->|"+5 điểm"| E["Giao người phụ trách"]
    E -->|"Telegram: giao việc"| F["Thực thi<br/>(Kanban / cập nhật trạng thái)"]
    F --> G{"Hoàn thành?"}
    G -->|"có, +10 điểm"| H["DONE"]
    G -->|"chưa, đến hạn"| I["Telegram: nhắc hạn 8:00 ICT"]
    H --> J["Ghi ActivityLog + cập nhật streak/huy hiệu"]
```

## 2. Kiến trúc hệ thống

### 2.1 Sơ đồ thành phần (component view)

```mermaid
flowchart TB
    subgraph CLIENT["Trình duyệt"]
        WEB["apps/web<br/>Next.js 14 App Router<br/>TanStack Query + next-intl + next-themes"]
    end

    subgraph SERVER["Máy chủ"]
        API["apps/api<br/>NestJS 10 REST /api/v1<br/>Swagger (non-prod)"]
        DB[("PostgreSQL 16<br/>qua Prisma ORM")]
        REDIS[("Redis 7<br/>đã cấp sẵn, chưa dùng<br/>(cache/queue/lock tương lai)")]
    end

    subgraph EXTERNAL["Dịch vụ ngoài (tuỳ chọn)"]
        CLAUDE["Anthropic Claude API"]
        TG["Telegram Bot API"]
    end

    WEB -- "fetch JSON, Bearer JWT<br/>packages/api-client" --> API
    API -- "Prisma Client<br/>+ tenant-scoping extension" --> DB
    API -. "chưa kết nối" .-> REDIS
    API -- "tóm tắt / gợi ý (đồng bộ)" --> CLAUDE
    API -- "sendMessage / setWebhook" --> TG
    TG -- "webhook POST /integrations/telegram/webhook" --> API
```

`Redis` đã có trong `docker-compose` và biến môi trường `REDIS_URL` nhưng **chưa được service nào kết nối tới** — cấp sẵn cho nhu cầu tương lai (cache, hàng đợi, distributed lock cho cron) chứ không phải đang dùng dở dang.

### 2.2 Bố cục monorepo

```mermaid
flowchart TB
    subgraph apps["apps/"]
        WEB2["web — Next.js frontend"]
        API2["api — NestJS backend"]
    end
    subgraph pkgs["packages/"]
        ST["shared-types<br/>Zod schemas — nguồn chân lý cho API contract"]
        UI["ui<br/>design tokens, Card/Button/Table,<br/>Kanban & Gantt wrapper"]
        AC["api-client<br/>TanStack Query hooks bọc REST API"]
        CFG["config<br/>tsconfig / eslint / prettier dùng chung"]
    end

    WEB2 --> UI
    WEB2 --> AC
    AC --> ST
    API2 --> ST
    WEB2 -.-> CFG
    API2 -.-> CFG
```

`packages/shared-types` là hợp đồng API duy nhất: một schema Zod được cả NestJS (DTO validation) và frontend (kiểu dữ liệu cho hook) cùng import — đổi hình dạng dữ liệu thì sửa ở đây trước, không sửa riêng từng phía rồi đồng bộ tay.

### 2.3 Đa tenant: cách ly ở tầng ứng dụng

Không dùng Postgres Row-Level Security (RLS) — cách ly được thực hiện hoàn toàn ở tầng ứng dụng qua một Prisma Client Extension, chạy cho **mọi** truy vấn của **mọi** model nằm trong `TENANT_SCOPED_MODELS`:

```mermaid
sequenceDiagram
    participant C as Client
    participant MW as RequestContextMiddleware
    participant G as JwtAuthGuard
    participant Ctl as Controller<br/>(ZodValidationPipe)
    participant Svc as Service
    participant Ext as Prisma Extension<br/>(tenant-scoping)
    participant DB as PostgreSQL

    C->>MW: HTTP request + Bearer JWT
    MW->>MW: verify JWT, seed userId<br/>vào AsyncLocalStorage
    MW->>G: next()
    G->>G: xác thực lại (nguồn xác thực chính),<br/>bỏ qua nếu @Public()
    G->>Ctl: request đã xác thực
    Ctl->>Ctl: validate body bằng Zod schema
    Ctl->>Svc: gọi service với organizationId (từ route param)
    Svc->>Ext: prisma.db.task.findMany({ where: {...} })
    Ext->>Ext: đọc organizationId từ<br/>AsyncLocalStorage request context,<br/>tự thêm vào where/data
    Ext->>DB: query đã bị khoá theo organizationId
    DB-->>C: kết quả (qua Svc → Ctl)
```

Vì việc thêm điều kiện lọc xảy ra ở tầng Prisma extension chứ không phải ở từng service, một service **không thể vô tình quên scope** — chỉ có nguy cơ duy nhất là quên đăng ký model mới vào `TENANT_SCOPED_MODELS` khi thêm bảng tenant-owned mới.

### 2.4 Đồ thị phụ thuộc module (backend)

```mermaid
flowchart LR
    subgraph DEPS["Có phụ thuộc chéo"]
        direction TB
        Auth --> Users
        Ai --> Tasks
        Tasks --> Gamification
        Tasks --> Telegram
        Risks --> Gamification
    end
    subgraph STANDALONE["Độc lập — không import module nghiệp vụ khác"]
        direction TB
        Projects
        Boards
        Dashboard
        Activity
        Organizations
        Memberships
        Health
        Charter
        Stakeholders
        Documents
    end
```

Quy tắc bất biến: `GamificationModule` và `TelegramModule` **không bao giờ import ngược lại `TasksModule`** dù có lý do hợp lý (vd. "xem việc đã giao") — tránh vòng lặp import. Cả hai chỉ đọc bảng `Task` trực tiếp qua `PrismaService` khi cần, không qua `TasksService`.

### 2.5 Xác thực & phiên đăng nhập

- Mật khẩu băm bằng **argon2id**.
- Đăng nhập trả về **access token** (JWT, 15 phút) + **refresh token** xoay vòng (cookie `httpOnly`, 30 ngày). Refresh token cũ bị đánh dấu revoked ngay khi dùng; tái sử dụng một refresh token đã revoked bị coi là dấu hiệu bị đánh cắp và thu hồi toàn bộ phiên của người dùng đó.
- `RequestContextMiddleware` best-effort giải mã JWT để seed tenant context sớm; `JwtAuthGuard` (global, qua `APP_GUARD`) mới là nơi thật sự từ chối request không hợp lệ — route nào cần bỏ qua thì đánh dấu `@Public()`.

## 3. Tech stack

| Lớp | Công nghệ | Vai trò |
|---|---|---|
| Frontend framework | Next.js 14 (App Router) + TypeScript | SSR/CSR, routing theo `[locale]/[orgSlug]/...` |
| UI state/data | TanStack Query | cache + đồng bộ dữ liệu server, qua `packages/api-client` |
| Design system | Tailwind CSS + `packages/ui` | token màu vàng/xám, glass-morphism, sáng/tối |
| Đa ngôn ngữ | next-intl | vi/en, lưu qua cookie `NEXT_LOCALE` |
| Kanban | `@dnd-kit` | kéo-thả tự viết, không dùng thư viện Kanban trọn gói |
| Gantt | `@svar-ui/react-gantt` (MIT) | biểu đồ tiến độ |
| Backend framework | NestJS 10 | REST API `/api/v1`, versioning qua URI |
| Validation | Zod, per-route qua `ZodValidationPipe` | không có `ValidationPipe` toàn cục — mỗi route tự khai schema |
| ORM/DB | Prisma + PostgreSQL 16 | + Prisma Client Extension cho đa tenant |
| Auth | `@nestjs/jwt`, `@nestjs/passport`, argon2 | JWT + refresh token xoay vòng |
| Cron | `@nestjs/schedule` ^6.1.3 | nhắc hạn Telegram hằng ngày — **ghim ở bản 6.x**: bản 12.x ship dạng ESM-only (`"type": "module"`) và crash với `ERR_REQUIRE_ESM` khi app đã build (CJS) gọi `require()`, dù `tsc`/vitest vẫn pass bình thường |
| AI | Anthropic Claude API (native `fetch`, không SDK) | tóm tắt / gợi ý subtask / tạo việc từ NL |
| Thông báo | Telegram Bot API (native `fetch` + webhook) | liên kết tài khoản, thông báo, nhắc hạn |
| Kiểm thử | Vitest (unit) · Testcontainers + Supertest (integration) · Playwright (E2E) | 3 tầng, mỗi tầng một mục tiêu khác nhau |
| Build orchestration | Turborepo + pnpm workspaces | `turbo run build lint typecheck test` |
| CI | GitHub Actions | 3 job tuần tự: `checks` → `integration` → `e2e` |
| Hạ tầng dev | Docker Compose (Postgres 16 + Redis 7) | Redis cấp sẵn, chưa dùng |

## 4. Mối liên kết & luồng dữ liệu

### 4.1 Giao việc → điểm thưởng + thông báo Telegram

Đây là ví dụ điển hình cho cách các tính năng "vệ tinh" (gamification, Telegram) móc vào lõi nghiệp vụ: **gọi thẳng, đồng bộ, tường minh** — không qua event bus hay queue.

```mermaid
sequenceDiagram
    participant Ctl as TasksController
    participant Svc as TasksService
    participant DB as PostgreSQL
    participant Gam as GamificationService
    participant Tg as TelegramNotificationsService
    participant TgApi as Telegram Bot API

    Ctl->>Svc: create(task, assigneeIds)
    Svc->>DB: transaction: tăng taskSequence,<br/>tạo Task + TaskAssignee
    DB-->>Svc: task đã tạo
    Svc->>Gam: awardPoints(userId, 5, "task_created")
    Gam->>DB: upsert UserScore, cập nhật streak
    Svc->>Tg: notifyTaskAssigned(task, assigneeIds)
    Tg->>DB: lấy telegramChatId của từng assignee
    Tg->>TgApi: sendMessage() cho từng người đã liên kết
    Note over Tg,TgApi: lỗi gửi bị nuốt (swallow) —<br/>không bao giờ làm hỏng việc tạo task
    Svc-->>Ctl: task (đã bao gồm assignees)
```

Điểm quan trọng: `TelegramNotificationsService.sendMessage` **không throw** khi lỗi — vì đây là side-effect nền của một hành động khác (tạo/giao việc), lỗi gửi thông báo không được phép làm hỏng thao tác chính. Ngược lại, các API trả kết quả trực tiếp cho người dùng (AI, tạo mã liên kết Telegram) thì throw lỗi rõ ràng khi chưa cấu hình — hai triết lý khác nhau cho hai loại lời gọi khác nhau, áp dụng nhất quán trong toàn bộ codebase.

### 4.2 Nhắc hạn công việc (cron hằng ngày)

```mermaid
sequenceDiagram
    participant Cron as "@Cron('0 8 * * *', {tz: Asia/Ho_Chi_Minh})"
    participant Tg as TelegramNotificationsService
    participant DB as PostgreSQL
    participant TgApi as Telegram Bot API

    Cron->>Tg: sendDueDateReminders()
    Tg->>DB: Task WHERE dueDate trong [hôm nay, ngày mai)<br/>giờ VN · status != DONE · reminderSentAt IS NULL<br/>(không lọc organizationId — quét toàn hệ thống)
    loop mỗi task đến hạn
        Tg->>TgApi: sendMessage tới từng assignee đã liên kết
        Tg->>DB: set telegramReminderSentAt = now()
    end
```

Vì cron job chạy ngoài một HTTP request, `AsyncLocalStorage` request context rỗng — Prisma extension tự động **không** áp bộ lọc tenant, cho phép quét đúng nghĩa toàn hệ thống. Đây là hành vi có chủ đích, không phải lỗ hổng: chỉ code chạy trong request pipeline mới bị/được tenant-scope.

### 4.3 Trợ lý AI — luôn là đề xuất, không bao giờ tự ghi

```mermaid
sequenceDiagram
    participant UI as Task detail (web)
    participant Ctl as AiController
    participant Prov as AnthropicProviderService
    participant Claude as Claude API

    UI->>Ctl: POST .../tasks/:id/suggest-subtasks
    Ctl->>Prov: generateJson(prompt)
    alt chưa cấu hình ANTHROPIC_API_KEY
        Prov-->>Ctl: throw ServiceUnavailableException
        Ctl-->>UI: 503, thông báo rõ ràng
    else đã cấu hình
        Prov->>Claude: messages.create(...)
        Claude-->>Prov: JSON gợi ý
        Prov-->>Ctl: danh sách subtask đề xuất
        Ctl-->>UI: hiển thị để người dùng chọn
        UI->>Ctl: POST tasks (chỉ cho các mục người dùng chọn)
    end
```

### 4.4 Pipeline CI

```mermaid
flowchart LR
    A["checks<br/>lint · typecheck · build · unit test"] --> B["integration<br/>Testcontainers Postgres thật<br/>+ Supertest qua toàn bộ HTTP pipeline"]
    B --> C["e2e<br/>Playwright, build production thật<br/>cho cả web và api"]
```

Mỗi job chạy trên một checkout + `pnpm install` độc lập — package nào được build ở job trước **không** mang sang job sau; job nào cần `packages/shared-types` đã build (không qua `next build`/`nest build`, vốn tự cascade qua `turbo`) phải tự build nó trước.
