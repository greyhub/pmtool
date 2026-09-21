# Vận hành production (runbook)

Hướng dẫn triển khai, sao lưu, khôi phục, giám sát và xử lý sự cố cho PMTool. Đối tượng đọc: người vận hành hệ thống. Kiến trúc xem [kien-truc.md](kien-truc.md); kế hoạch ra mắt xem [gtm.md](gtm.md).

> **Mức đã kiểm chứng (2026-09-21).** *Đã chạy thật:* `backup.sh` trên bản dữ liệu phát triển (≈ 1.100 người dùng, ≈ 1.100 công việc) tạo tệp nén hợp lệ; `restore.sh` khôi phục vào cơ sở dữ liệu tạm và **số dòng khớp** ở các bảng đối chiếu; tệp sao lưu hỏng bị từ chối; `docker compose config` hợp lệ; `GET /health/ready` có test tích hợp. *Chưa kiểm chứng:* dựng image bằng `docker build` cho tới hết (trên máy phát triển, mạng trong Docker quá chậm nên chưa hoàn tất — quá trình cài gói bằng pnpm 10 đã chạy được), khởi động cả stack với Caddy/HTTPS thật, và vòng lặp sao lưu hằng đêm. Hãy chạy các bước này trên máy chủ thật (mục 3) và diễn tập khôi phục (mục 5) trước khi mở đăng ký.

## 1. Thành phần

```
Internet ──► Caddy (HTTPS tự động) ──┬─► web  (Next.js, cổng 3000)
                                     └─► api  (NestJS, cổng 3001, đường dẫn /api/*)
                                            ├─► postgres (dữ liệu, volume pgdata)
                                            └─► redis (cấp sẵn, chưa dùng)
backup ──► pg_dump hằng đêm ──► thư mục sao lưu (nên là ổ/đĩa khác postgres)
```

Web và API chạy chung **một origin** (một tên miền) nên cookie đăng nhập là first-party và không cần CORS. Toàn bộ định nghĩa nằm ở `Dockerfile`, `infra/docker-compose.prod.yml`, `infra/Caddyfile`.

## 2. Yêu cầu

- Một máy chủ Linux có Docker + Docker Compose, tối thiểu 2 vCPU / 2 GB RAM / 20 GB đĩa để bắt đầu.
- Một **tên miền** trỏ (bản ghi A/AAAA) về IP máy chủ; cổng 80 và 443 mở. Caddy tự xin và gia hạn chứng chỉ HTTPS.
- (Tuỳ chọn) SMTP để gửi email, Client ID/Secret của Google để đăng nhập Google, khoá Anthropic cho AI, bot Telegram — xem `infra/.env.prod.example`.

## 3. Triển khai lần đầu

```bash
git clone <repo> && cd PMTool
cp infra/.env.prod.example infra/.env.prod
# Điền: SITE_ADDRESS, SITE_URL, POSTGRES_PASSWORD, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET,
#       OPERATOR_NAME, CONTACT_EMAIL. Sinh bí mật:  openssl rand -hex 32
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod up -d --build
```

Kiểm tra sau khi chạy:

```bash
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod ps      # mọi dịch vụ Up/healthy
curl -fsS https://<tên miền>/api/v1/health/ready                                      # {"status":"ok"}
```

Container `api` tự chạy `prisma migrate deploy` khi khởi động (chỉ áp các migration đã có, không bao giờ sinh migration mới).

Việc phải làm ngay sau khi lên:
1. Đăng ký tài khoản đầu tiên qua giao diện và tạo tổ chức.
2. Nếu đã cấu hình SMTP: gửi thử email đặt lại mật khẩu; rồi đặt `EMAIL_VERIFICATION_REQUIRED=true` và khởi động lại `api`.
3. Kiểm tra trang `/terms` và `/privacy` hiển thị đúng tên đơn vị/email liên hệ.
4. **Diễn tập khôi phục** (mục 5) trước khi mời người dùng thật.

## 4. Nâng cấp phiên bản

```bash
git pull
# 1) Sao lưu ngay trước khi nâng cấp (migration có thể không hoàn tác được):
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod exec backup sh /usr/local/bin/backup.sh
# 2) Dựng lại và khởi động lại:
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod up -d --build
# 3) Kiểm tra:
curl -fsS https://<tên miền>/api/v1/health/ready
```

Nếu bản mới lỗi: quay lại commit trước (`git checkout <commit cũ>`), dựng lại. Nếu migration đã chạy và làm hỏng dữ liệu, khôi phục từ bản sao lưu ở bước 1 (mục 5).

**Quy tắc bắt buộc về migration** (đã từng làm mất dữ liệu phát triển hai lần):
- Migration được viết tay bằng SQL và áp bằng `prisma migrate deploy`. **Không** dùng `prisma migrate dev` hay `migrate diff --shadow-database-url` trên cơ sở dữ liệu thật.
- Trước khi phát hành một migration mới: chạy nó trên **bản sao** của dữ liệu (khôi phục sao lưu vào cơ sở dữ liệu tạm rồi `migrate deploy`) và đối chiếu số dòng các bảng trước/sau.

## 5. Sao lưu và khôi phục

**Sao lưu tự động:** dịch vụ `backup` chạy `pg_dump` nén ngay khi khởi động và mỗi đêm lúc 20:00 UTC (03:00 giờ Việt Nam; đổi bằng `BACKUP_HOUR_UTC`), kiểm tra tệp nén hợp lệ, lưu vào `BACKUP_DIR` (mặc định `infra/backup/data`) và xoá bản cũ hơn `BACKUP_KEEP_DAYS` ngày (mặc định 14).

**Việc bạn phải làm để sao lưu thực sự an toàn:**
- Đặt `BACKUP_DIR` trên **ổ/đĩa khác** với dữ liệu Postgres, và **sao chép ra ngoài máy chủ** (ví dụ `rclone`/`rsync` lên kho lưu trữ đám mây hoặc máy khác) — sao lưu nằm cùng máy chủ sẽ mất cùng máy chủ.
- **Diễn tập khôi phục** ít nhất một lần trước khi mở đăng ký, và định kỳ mỗi quý. Một bản sao lưu chưa từng được khôi phục thử thì chưa phải là bản sao lưu.

**Diễn tập khôi phục (an toàn — vào cơ sở dữ liệu tạm):**

```bash
# 1. Tạo cơ sở dữ liệu tạm trong container postgres
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.prod exec postgres createdb -U pmtool pmtool_restore_test
# 2. Khôi phục bản sao lưu mới nhất vào đó
./infra/backup/restore.sh infra/backup/data/pmtool-<mới nhất>.sql.gz \
  postgresql://pmtool:<POSTGRES_PASSWORD>@localhost:5432/pmtool_restore_test   # cần psql; hoặc chạy trong container postgres
# 3. Đối chiếu số dòng với bản thật
docker compose ... exec postgres psql -U pmtool -d pmtool_restore_test -c 'select count(*) from users'
docker compose ... exec postgres psql -U pmtool -d pmtool          -c 'select count(*) from users'
# 4. Xoá cơ sở dữ liệu tạm
docker compose ... exec postgres dropdb -U pmtool pmtool_restore_test
```

**Khôi phục thật sau sự cố:** dừng `api` (`docker compose … stop api web`), chạy `restore.sh` với cơ sở dữ liệu đích là `pmtool` (script yêu cầu gõ `RESTORE` để xác nhận), rồi `up -d`. Thời gian mất dữ liệu tối đa (RPO) ≈ khoảng giữa hai lần sao lưu (mặc định 24 giờ); muốn ngắn hơn, chạy `backup.sh` thường xuyên hơn.

## 6. Giám sát

Việc tối thiểu cần có trước khi mở công khai:

| Việc | Cách làm |
|---|---|
| **Uptime + cảnh báo** | Dịch vụ giám sát ngoài (UptimeRobot, Better Stack, …) gọi `https://<tên miền>/api/v1/health/ready` mỗi 1–5 phút, báo qua email/Telegram. `ready` kiểm tra kết nối cơ sở dữ liệu (503 khi mất). |
| **Sao lưu chạy đúng** | Kiểm tra tệp mới nhất trong `BACKUP_DIR` có tuổi < 26 giờ (một dòng cron cảnh báo), và log `docker compose logs backup` không có `FAILED`. |
| **Lỗi ứng dụng** | `docker compose logs -f api`; mọi exception 5xx được ghi qua bộ lọc lỗi toàn cục. Nên gắn một dịch vụ theo dõi lỗi (Sentry hoặc tương đương) — chưa tích hợp sẵn. |
| **Đĩa và RAM** | Cảnh báo khi đĩa > 80% (dữ liệu Postgres, log Docker, sao lưu). |
| **Chi phí** | Theo dõi hoá đơn nhà cung cấp AI và email; hạn mức `AI_DAILY_LIMIT_PER_ORG` chặn mỗi tổ chức. |

### 6.1 Số liệu sản phẩm (kích hoạt, giữ chân)

```bash
infra/metrics/metrics.sh          # qua dịch vụ postgres của compose; hoặc DATABASE_URL=... infra/metrics/metrics.sh
```

Báo cáo chỉ-đọc (chỉ có SELECT) trong `infra/metrics/metrics.sql`, chạy trên máy chủ vì xuyên nhiều tổ chức nên **không** đưa vào ứng dụng. Không thêm công cụ theo dõi nào; mọi thứ suy ra từ dữ liệu sẵn có: tổng số, **phễu kích hoạt theo tổ chức** (tạo dự án → ≥ 5 công việc → mời đồng đội → có phạm vi/WBS — cùng bốn bước với checklist trong ứng dụng), **giữ chân theo nhóm tuần đăng ký** (còn thao tác ở ngày 1–7, 8–14, 15–28), người dùng hoạt động theo tuần, tính năng nào được dùng, và tỉ lệ email đã xác minh. "Hoạt động" nghĩa là có ít nhất một thay đổi được ghi nhật ký — chỉ xem thì không thấy. Số liệu trên bản phát triển toàn là dữ liệu kiểm thử nên vô nghĩa; chỉ có ý nghĩa trên bản chạy thật. Nên chạy hằng tuần và ghi lại để xem xu hướng.

Chưa có sẵn: metrics/dashboards, log tập trung, tracing. Bổ sung khi lượng người dùng tăng.

## 7. Bảo mật vận hành

- Bí mật (`JWT_*`, `POSTGRES_PASSWORD`, khoá bên thứ ba) chỉ nằm trong `infra/.env.prod` trên máy chủ (quyền `600`), **không** commit. Đổi `JWT_*_SECRET` sẽ đăng xuất mọi người dùng.
- Chỉ mở cổng 80/443 ra ngoài; Postgres và Redis không publish cổng.
- Bật cập nhật bảo mật tự động của hệ điều hành và cập nhật image định kỳ (`docker compose pull` + `up -d --build`).
- Giới hạn tốc độ nằm trong bộ nhớ tiến trình `api`: chạy **một** bản `api`. Nếu cần nhiều bản, chuyển bộ đếm sang Redis trước.
- Xem [kien-truc.md §5](kien-truc.md#5-bảo-mật--các-quy-tắc-đã-siết) cho các quy tắc phân quyền và các điểm rủi ro còn mở; thực hiện rà soát bảo mật độc lập trước khi bán cho doanh nghiệp.

### 7.1 Lỗ hổng thư viện (kiểm tra 2026-09-21)

Chạy `pnpm audit --prod` định kỳ (mỗi tuần và trước mỗi lần phát hành). Đã xử lý: 52 → 26 cảnh báo bằng cách ghim các gói gián tiếp lên bản đã vá (`overrides` trong `pnpm-workspace.yaml`: `multer`, `lodash`, `js-yaml`, `postcss`, `qs`, `body-parser`), nâng `next-intl` lên 4.x, và tắt bộ tối ưu ảnh của Next (`images.unoptimized`) vì ứng dụng không dùng `next/image`.

**Còn lại, cần làm trước khi mở công khai:** **Next.js 14** còn 23 cảnh báo (2 nghiêm trọng, 8 cao) mà bản vá chỉ có ở **15.5+** — cần nâng cấp lớn (kéo theo React 19) và thử lại toàn bộ giao diện. Cảnh báo nghiêm trọng thứ nhất chỉ áp dụng khi chạy trên Windows; thứ hai nằm ở API tối ưu ảnh, đã tắt. Phần lớn còn lại là từ chối dịch vụ (DoS) và SSRF trong Server Actions/rewrites — ứng dụng không dùng Server Actions và không dùng rewrites, nhưng vẫn nên nâng cấp. Còn hai cảnh báo mức vừa ở `file-type` (qua `@nestjs/common`, chỉ dùng cho bộ kiểm tra tệp tải lên mà ứng dụng không dùng) và một ở `@nestjs/core` (cần nâng Nest 10 → 11).

## 8. Xử lý sự cố nhanh

| Triệu chứng | Kiểm tra | Cách xử lý |
|---|---|---|
| Trang không mở, `502` từ Caddy | `docker compose ps`, `logs web api` | Khởi động lại dịch vụ hỏng: `docker compose … restart api` |
| `api` thoát ngay khi khởi động | `logs api` | Thường do thiếu/sai biến môi trường (thông báo `Invalid environment configuration`) hoặc migration lỗi |
| `health/ready` trả 503 | `logs postgres`, đĩa đầy? | Giải phóng đĩa; khởi động lại `postgres`; nếu hỏng dữ liệu → khôi phục (mục 5) |
| Người dùng không nhận được email | `logs api` (dòng `Failed to send email` hoặc `SMTP not configured`) | Kiểm tra SMTP_*, SPF/DKIM của tên miền gửi |
| Đăng nhập bị chặn hàng loạt (429) | IP của người dùng có đúng không? | Bảo đảm `TRUST_PROXY=1` (đứng sau Caddy) để giới hạn theo IP thật, không theo IP của proxy |
| Google đăng nhập lỗi `redirect_uri_mismatch` | URI trong Google Cloud Console | Phải đúng `<SITE_URL>/api/v1/auth/google/callback` |
