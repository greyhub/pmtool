# Triển khai PMTool trên Mac mini (Cloudflare Tunnel)

Dành cho người vận hành đặt máy chủ tại nhà/văn phòng. Cách này **không mở cổng trên router**, không lộ IP nhà, HTTPS do Cloudflare lo. Phần chung về sao lưu, nâng cấp, giám sát xem [van-hanh.md](van-hanh.md).

> **Mức kiểm chứng.** Đã chạy thật trên máy phát triển: dựng cả stack bằng `docker-compose.prod.yml`, kiểm tra `docker-compose.tunnel.yml` hợp lệ và Caddy chuyển đúng IP người truy cập (giả mạo `X-Forwarded-For` bị ghi đè). Đã chạy thật với Cloudflare Tunnel và tên miền `pm.dgna.vn`, và với `offsite` lên Google Drive (chép bản sao lưu, tải về, khôi phục vào Postgres tạm: số liệu khớp prod). Nếu lỗi, đối chiếu mục 8.

## 1. Chuẩn bị máy

```bash
sudo pmset -a autorestart 1     # tự bật lại sau khi mất điện
sudo pmset -a sleep 0           # không tự ngủ (máy hiện đã đặt 0)
```

- **Đăng nhập tự động** (Cài đặt hệ thống → Người dùng & Nhóm) và bật **"Start Docker Desktop when you sign in"** (hoặc dùng OrbStack). Docker Desktop trên Mac chỉ chạy sau khi có người đăng nhập.
- **FileVault**: nếu bật, sau khi mất điện máy dừng ở màn hình nhập mật khẩu và **không tự phục vụ được** — chọn giữa an toàn ổ đĩa và khả năng tự phục hồi. Với máy chủ đặt ở nơi tin cậy, thường tắt FileVault.
- Nên có **UPS nhỏ**. Cúp điện là ngừng dịch vụ.
- **Không chạy môi trường phát triển trên cùng thư mục.** Chạy bản production từ một bản sao riêng:

```bash
git clone <repo> ~/pmtool-prod && cd ~/pmtool-prod
```

Việc build/test/`next dev` ở nơi khác (hoặc lúc ít người dùng) để không làm chậm dịch vụ đang chạy.

## 2. Đưa tên miền vào Cloudflare (miễn phí)

1. Tạo tài khoản tại cloudflare.com → **Add a site** → nhập tên miền → chọn gói Free.
2. Cloudflare đưa hai máy chủ tên (nameserver). Vào nơi bạn mua tên miền, đổi nameserver sang hai địa chỉ đó. Chờ vài phút đến vài giờ tới khi Cloudflare báo "Active".

## 3. Tạo tunnel

1. Cloudflare → **Zero Trust** → **Networks** → **Tunnels** → **Create a tunnel** → loại **Cloudflared** → đặt tên `pmtool`.
2. Chọn môi trường **Docker**, sao chép **token** (chuỗi dài sau `--token`). Đây là bí mật, không commit.
3. Tab **Public Hostname** → thêm: Subdomain `pm` (hoặc để trống dùng tên miền gốc), Domain chọn tên miền của bạn, **Service: `HTTP` — `caddy:80`**.
4. (Tuỳ chọn) **SSL/TLS → Edge Certificates**: bật *Always Use HTTPS* và *HSTS*.

## 4. Cấu hình `infra/.env.prod`

```bash
cp infra/.env.prod.example infra/.env.prod && chmod 600 infra/.env.prod
```

Điền:

| Biến | Giá trị |
|---|---|
| `SITE_URL` | `https://pm.tên-miền-của-bạn` (đúng địa chỉ ở bước 3) |
| `CLOUDFLARE_TUNNEL_TOKEN` | token ở bước 3 |
| `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | mỗi giá trị `openssl rand -hex 32` |
| `OPERATOR_NAME`, `CONTACT_EMAIL` | hiện trên trang Điều khoản/Quyền riêng tư |
| `BACKUP_DIR` | thư mục sao lưu, **nên là ổ ngoài** (ví dụ `/Volumes/Backup/pmtool`) |
| `FEEDBACK_ADMIN_EMAILS` | email của bạn (và ai khác cần xem), cách nhau bởi dấu phẩy — mới xem và xử lý được góp ý gửi từ mục **Góp ý** trong app ([huong-dan-su-dung.md §34](huong-dan-su-dung.md#34-góp-ý--phản-hồi)); để trống thì vẫn gửi được nhưng không ai xem |

`SITE_ADDRESS` không dùng ở chế độ tunnel. Email/Google để trống lúc đầu, bổ sung ở mục 7.

## 5. Chạy

Đặt sẵn lệnh cho gọn (`~/pmtool-prod`):

```bash
export DC="docker compose -f infra/docker-compose.prod.yml -f infra/docker-compose.tunnel.yml --env-file infra/.env.prod"
$DC up -d --build
$DC ps                                    # mọi dịch vụ Up; api healthy
curl -fsS https://pm.tên-miền-của-bạn/api/v1/health/ready     # {"status":"ok"}
```

Các dịch vụ có `restart: unless-stopped` nên tự lên lại khi Docker khởi động. **Thử một lần:** khởi động lại máy và xác nhận trang tự mở lại sau vài phút mà không cần thao tác.

Rồi làm các việc sau khi lên của [van-hanh.md §3](van-hanh.md#3-triển-khai-lần-đầu): đăng ký tài khoản đầu tiên, tạo tổ chức, kiểm tra `/terms` và `/privacy`, **diễn tập khôi phục** ([§5](van-hanh.md#5-sao-lưu-và-khôi-phục)).

## 6. Sao lưu ra ngoài máy (bắt buộc)

Sao lưu nằm cùng máy sẽ mất cùng máy. Dùng `rclone` chép lên Google Drive, Backblaze B2, S3… (một lần cấu hình):

Bước xác thực Google cần trình duyệt, mà rclone chạy trong container không mở được (cổng chỉ nghe ở 127.0.0.1 của container). Vì vậy cấu hình **trực tiếp trên máy**, ghi thẳng vào thư mục dịch vụ sẽ đọc:

```bash
# cài rclone không cần brew/sudo (Mac Apple silicon; máy Intel thay arm64 bằng amd64)
mkdir -p ~/.local/bin && cd /tmp && curl -fsSLO https://downloads.rclone.org/rclone-current-osx-arm64.zip \
  && unzip -q -o rclone-current-osx-arm64.zip && cp rclone-*-osx-arm64/rclone ~/.local/bin/ && cd -
mkdir -p ~/.config/pmtool-rclone
RCLONE_CONFIG=~/.config/pmtool-rclone/rclone.conf ~/.local/bin/rclone config
# n → tên "gdrive" → drive → client_id/secret để trống → y (client chung) → scope 3 (drive.file) → Enter... → trình duyệt tự mở, cho phép
```

> **Lưu ý:** rclone báo client_id chung của nó sẽ **ngừng hoạt động trong năm 2026**. Khi đó tạo client_id riêng (Google Cloud Console → OAuth client, https://rclone.org/drive/#making-your-own-client-id) rồi chạy lại `rclone config` cho remote `gdrive`. Nếu `offsite` báo `FAILED` đột ngột, đây là nguyên nhân đầu tiên cần nghĩ tới.

Thêm vào `infra/.env.prod`: `RCLONE_REMOTE=gdrive:pmtool-backups` (và `OFFSITE_KEEP_DAYS=60` nếu muốn đổi). Rồi chạy thêm tệp offsite:

```bash
export DC="docker compose -f infra/docker-compose.prod.yml -f infra/docker-compose.tunnel.yml -f infra/docker-compose.offsite.yml --env-file infra/.env.prod"
$DC up -d
$DC logs offsite | tail        # "offsite ok"
```

Dịch vụ chép 30 phút sau lần sao lưu ban đêm và một lần khi khởi động. Dùng **copy** (không đồng bộ xoá): xoá/xoay vòng bản cục bộ không xoá bản ở xa; bản ở xa cũ hơn `OFFSITE_KEEP_DAYS` ngày được dọn. **Kiểm tra định kỳ** bằng cách tải một tệp về và khôi phục thử (van-hanh.md §5).

## 7. Email và đăng nhập Google

- **SMTP:** dịch vụ có gói miễn phí đủ cho giai đoạn đầu (Brevo, Resend, Mailjet…) — lấy `SMTP_HOST/PORT/USER/PASS` và đặt `MAIL_FROM` bằng địa chỉ thuộc tên miền của bạn; **thêm bản ghi SPF/DKIM** mà nhà cung cấp yêu cầu vào DNS (Cloudflare) để thư không vào spam. Xong thì thử "Quên mật khẩu", rồi đặt `EMAIL_VERIFICATION_REQUIRED=true`.
- **Google:** Google Cloud Console → tạo OAuth client (Web) → *Authorized redirect URI* đúng bằng `https://pm.tên-miền-của-bạn/api/v1/auth/google/callback` → điền `GOOGLE_CLIENT_ID/SECRET`.
- Sau khi sửa `.env.prod`: `$DC up -d` để áp dụng.

## 8. Nếu có sự cố

| Triệu chứng | Kiểm tra |
|---|---|
| Trang báo lỗi 502/1033 của Cloudflare | `$DC logs cloudflared` — token sai/hết hạn? `$DC ps` — `caddy` còn chạy? Public Hostname trỏ đúng `caddy:80`? |
| Đăng nhập bị chặn 429 hàng loạt | Giới hạn theo IP; Caddy phải là `Caddyfile.tunnel` (truyền `CF-Connecting-IP`). `$DC config \| grep Caddyfile` |
| Không đăng nhập được / cookie không lưu | `SITE_URL` phải đúng `https://` + đúng tên miền đang truy cập |
| Sau khi mất điện trang không lên | Docker đã chạy chưa (cần đăng nhập tự động)? FileVault đang chặn? |
| `offsite` báo `FAILED` | `$DC logs offsite`; chạy `rclone config` lại; kiểm tra hạn ngạch kho lưu trữ |

## 9. Nâng cấp

> Các image đã được làm gọn (mỗi cái ≈ 0,5 GB thay vì 2 GB) nên lần build và kéo nhanh hơn, ít tốn đĩa hơn. Sau vài lần nâng cấp, dọn bản cũ bằng `docker image prune -f` và `docker builder prune -f`.

```bash
cd ~/pmtool-prod && git pull
$DC exec backup sh /usr/local/bin/backup.sh     # sao lưu ngay trước khi nâng cấp
$DC up -d --build
curl -fsS https://pm.tên-miền-của-bạn/api/v1/health/ready
```

## 10. Khi nào chuyển sang VPS

Khi cần cam kết thời gian hoạt động, khi người dùng đông hoặc cúp điện/mạng nhà làm ảnh hưởng người dùng. Việc chuyển rất đơn giản vì mọi thứ đã đóng gói: cài Docker trên VPS, chép `infra/.env.prod`, khôi phục bản sao lưu mới nhất ([van-hanh.md §5](van-hanh.md#5-sao-lưu-và-khôi-phục)), bật tunnel/Caddy như trên hoặc dùng `docker-compose.prod.yml` thuần (Caddy tự lấy chứng chỉ khi tên miền trỏ về IP VPS).
