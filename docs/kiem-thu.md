# Báo cáo kiểm thử

Cập nhật 2026-09-20. Mô tả chiến lược kiểm thử, kết quả lần chạy đầy đủ gần nhất, những gì **đã được kiểm chứng**, và những gì **chưa** (để GTM không hiểu nhầm phạm vi bảo đảm). Cách chạy: [README.md](../README.md#kiểm-thử).

## 1. Kết quả lần chạy gần nhất

| Tầng | Công cụ | Số lượng | Kết quả |
|---|---|---|---|
| Unit — API | Vitest (Prisma mock) | 248 test / 36 file | ✅ đạt |
| Unit — Web | Vitest + jsdom | 23 test | ✅ đạt |
| Unit — UI (design system, Gantt) | Vitest + Testing Library | 52 test | ✅ đạt |
| Tích hợp — API qua HTTP thật | Supertest + Postgres ephemeral (Testcontainers), toàn bộ guard/interceptor thật | 62 test | ✅ đạt (đã thấy 1 lần một test tên-nhân-vật-đã-dùng lỗi ngẫu nhiên, chạy lại 9 lần liên tiếp đều đạt — chưa tái hiện được, đang theo dõi) |
| End-to-end — trình duyệt thật | Playwright (Chromium), build dev thật của web + api | 34 test / 26 file | ✅ 33 đạt, 1 tự bỏ qua vì chưa cấu hình Telegram trong môi trường này, 1,8 phút |
| Tĩnh | ESLint, `tsc --noEmit`, `next build`, `nest build` (Turborepo 18 tác vụ) | 18 tác vụ | ✅ đạt, 0 cảnh báo |

Đợt kiểm thử này **tìm ra và sửa** 5 lỗi bảo mật/phân quyền thật (mục 3) — đó là lý do có thêm test ma trận.

## 2. Kiến trúc kiểm thử

| Tầng | Trả lời câu hỏi | Ví dụ |
|---|---|---|
| Unit | Logic thuần có đúng không? | Quy tắc cấp WBS, dựng đồ thị + kiểm tra độ phủ, so sánh thay đổi công việc, máy trạng thái giao phẩm, tính điểm/nhiệm vụ, bố cục sơ đồ |
| Tích hợp | Pipeline thật (guard → pipe → service → Prisma → DB) có ép đúng quy tắc không? | Cách ly tenant, ma trận vai trò, luồng nghiệm thu, WBS/phạm vi/từ điển |
| E2E | Người dùng thật thao tác qua giao diện có ra kết quả đúng không? | Đăng ký → tổ chức → dự án → WBS → phạm vi → sơ đồ liên kết |

## 3. Kiểm thử phân quyền theo vai trò

Test tích hợp **"Role-based access matrix"** gọi thật 24 hành động ghi/đọc đại diện với **cả 5 vai trò + một người ngoài tổ chức**, và khẳng định:
- vai trò *không* được phép → đúng `403`;
- vai trò *được phép* → thành công thật (không chấp nhận `400/404/5xx`; riêng `409` được chấp nhận cho "hành động hợp lệ nhưng sai trạng thái", ví dụ nghiệm thu giao phẩm chưa nộp);
- người ngoài tổ chức → `403` ở mọi hành động.

Bảng quyền được kiểm chứng: xem [kien-truc.md §2.4.1](kien-truc.md#241-ma-trận-phân-quyền-theo-vai-trò).

**Các lỗi tìm thấy và đã sửa (mỗi lỗi có test hồi quy):**

| # | Lỗi | Cách tái hiện | Sửa | Test |
|---|---|---|---|---|
| 1 | Admin hạ vai trò hoặc xoá được **Owner** | Admin gọi `PATCH/DELETE members/{ownerMembership}` | Chỉ Owner được thay đổi/xoá vai trò Owner | unit (3) + integration "an ADMIN cannot demote or remove the OWNER" |
| 2 | Gán **người ngoài tổ chức** làm người phụ trách/hỗ trợ, chủ giao phẩm, chủ rủi ro, quản lý điều lệ | `POST tasks {assigneeId: <id người tổ chức khác>}` trả `201` và lộ tên/ảnh | `assertOrgMembers()` → `400` | integration "refuses to assign work to… someone outside" + unit |
| 3 | **Vai trò cao ở dự án A dùng để sửa/xoá dữ liệu dự án B** (rủi ro, tài liệu, bên liên quan, artifact, cột Kanban, công việc, phụ thuộc) qua URL của A | Viewer ở B nhưng PM ở A: `PATCH /projects/A/risks/{riskCủaB}` thành công | `ProjectEntityGuard` + `@ProjectEntity` → `404` | integration "a role held on one project cannot be used to reach another project's records" |
| 4 | Member **xoá** được giao phẩm đã nghiệm thu | `DELETE deliverables/{id}` bằng Member | Xoá giao phẩm chỉ PM trở lên | ma trận + kiểm tra trực tiếp `403`/`200` |
| 5 | PM tự phê duyệt phạm vi do chính mình soạn | `POST scope/approve` bằng PM | Chỉ Owner/Admin phê duyệt (như điều lệ) | ma trận |

Cùng đợt: giao diện hiểu vai trò — nút không dùng được bị ẩn/vô hiệu hoá, Viewer thấy thông báo chỉ-đọc (kiểm chứng bằng E2E `roles-and-characters.spec.ts`).

## 4. Độ phủ theo hành trình người dùng

| Hành trình ([chi tiết](hanh-trinh-nguoi-dung.md)) | Tự động hoá bởi | Ghi chú |
|---|---|---|
| J1 Kích hoạt | E2E `auth`, `org-creation`, `project-creation`, `task-hierarchy` | Không có E2E cho AI thật (tốn phí) — chỉ unit + integration với mock |
| J2 Mời & tham gia | E2E `org-invite-login-redirect`, `roles-and-characters`; integration "Organization invite management" | Gửi email chưa có nên chưa thể kiểm thử |
| J3 Lập kế hoạch PMBOK | E2E `wbs-scope`, `pm-artifacts`; integration "WBS, scope statement and dictionary", "Project Charter" | |
| J4 Thực thi | E2E `task-ux`, `kanban-drag`, `gamification`; integration "Task history", "Quests", "Task assignees" | Telegram thật không kiểm thử E2E (cần webhook công khai) |
| J5 Giám sát | E2E `wbs-scope` (sơ đồ + độ phủ), `gantt`; unit dựng đồ thị/bố cục | Đã xem trực tiếp ảnh chụp sáng/tối |
| J6 Nghiệm thu | E2E `deliverables-milestones`; integration "Deliverables and milestones" | |
| J7 Gắn kết | E2E `gamification`, `settings`, `roles-and-characters`; integration "User preferences" | |
| J8 Quản trị | Integration "Organization archive", "Project-level RBAC overrides", ma trận; E2E `org-settings`, `project-settings` | |
| J9 Viewer | E2E `roles-and-characters`; ma trận | |

## 5. Danh sách kiểm tra thủ công trước mỗi bản phát hành

Những thứ tự động hoá chưa bao phủ hoặc cần mắt người:

- [ ] Giao diện **sáng và tối** ở các màn hình mới/đổi (WBS, Phạm vi, sơ đồ liên kết, danh sách công việc, cài đặt nhân vật).
- [ ] **Điện thoại (~400px)**: không cuộn ngang toàn trang; bảng/sơ đồ cuộn trong khung riêng.
- [ ] Sơ đồ liên kết với dự án lớn (≥ 300 công việc): mở/bung hoạt động vẫn mượt.
- [ ] Nhắc hạn Telegram thật (8:00 ICT) và bản tin cuối ngày với bot thật.
- [ ] AI thật (khoá API thật): tóm tắt, gợi ý công việc con, tạo từ ngôn ngữ tự nhiên.
- [ ] Thử hai trình duyệt độc lập: đổi vai trò một người rồi kiểm tra quyền thực tế có đổi ngay không.
- [ ] Diễn tập **khôi phục sao lưu** trên môi trường staging (khi có production).

## 6. Khoảng trống kiểm thử đã biết

| Khoảng trống | Rủi ro | Kế hoạch |
|---|---|---|
| Không có kiểm thử **tải/hiệu năng** | Chưa biết giới hạn số dự án/công việc/đồng thời | Trước beta mở: k6 hoặc tương đương với dữ liệu ~10⁵ công việc |
| Không có kiểm thử **bảo mật độc lập** (pentest) | Artifact HTML tự viết, phiên đăng nhập | Cổng G7 trong [gtm.md](gtm.md) |
| Không có kiểm thử **truy cập được (a11y)** tự động | Người dùng dùng bàn phím/đọc màn hình | Thêm axe vào E2E |
| Không có E2E trên **Firefox/Safari/di động thật** | Khác biệt trình duyệt | Mở rộng ma trận Playwright |
| Không kiểm thử **migration trên dữ liệu production-size** | Rủi ro khi nâng cấp | Diễn tập trên bản sao staging trước mỗi migration |
| Chưa có kiểm thử cho các mục chưa build (quên mật khẩu, email, thanh toán…) | — | Kèm theo khi xây (G1–G3) |

## 7. Lưu ý vận hành khi chạy kiểm thử cục bộ

- **Máy Mac ngủ khi chạy E2E dài** làm thời gian phình 10 lần và gây lỗi timeout ngẫu nhiên (gặp trong đợt này: 17 phút, các test riêng lẻ đều đạt trong vài giây). Chạy bằng `caffeinate -i npx playwright test`; nếu một test đơn lẻ lỗi khi chạy cả bộ, chạy lại riêng nó trước khi tìm lỗi trong code.
- Đừng chạy `next build` khi `next dev` đang chạy trên cùng thư mục `.next` — cache dev hỏng (trang mất CSS/JS). Dừng dev server, xoá `apps/web/.next`, rồi khởi động lại.
- Sau khi máy khởi động lại, container Docker bị dừng: `docker start infra-postgres-1 infra-redis-1`.
- **Không bao giờ** dùng DB thật làm `--shadow-database-url` khi tạo migration (đã làm mất dữ liệu dev hai lần); migration viết tay + `prisma migrate deploy`, kiểm tra số dòng trước/sau.
