# Hiệu năng

Cách đo, kết quả và các quyết định tối ưu của PMTool. Đối tượng đọc: người phát triển và vận hành.

> **Nguyên tắc.** Đo trước, sửa chỗ thực sự chậm, đo lại. Mọi con số dưới đây lấy từ một **dự án lớn giả lập (2.500 công việc, 600 phụ thuộc, 1.500 bình luận, 250 rủi ro, 120 giao phẩm, 4.000 dòng hoạt động)** trên máy phát triển (Mac mini M4, API + Postgres cục bộ). Người dùng thật thường có dự án nhỏ hơn 5–10 lần nên sẽ nhanh hơn; số liệu này là *trường hợp xấu*, không phải trung bình.

## 1. Cách đo lại

```bash
node infra/perf/bench.mjs          # dựng dự án lớn trong DB DEV (tổ chức mới, dùng một lần) rồi đo mọi API chính
```

- Script tạo dữ liệu trực tiếp bằng SQL trong container `infra-postgres-1` — **chỉ dùng với cơ sở dữ liệu phát triển**, không bao giờ với dữ liệu thật. Sau khi đo, xoá tổ chức `bench-*` và người dùng `bench*` do nó tạo.
- Đo phía trình duyệt: chạy web bản **production** (`next build && next start`, không dùng `next dev` vì chậm hơn nhiều lần) và dùng Playwright đo `networkidle`, `longtask` (tổng thời gian chặn luồng chính) và số phần tử DOM.
- Chỉ mục: `EXPLAIN (ANALYZE)` và bảng `pg_stat_user_tables` (`seq_scan`, `seq_tup_read`) sau khi chạy ứng dụng để thấy bảng nào bị quét toàn bộ.

## 2. Kết quả (dự án 2.500 công việc)

| Hạng mục | Trước | Sau |
|---|---|---|
| API danh sách công việc, độ trễ 1 yêu cầu | 74 ms | 45 ms |
| API danh sách công việc, thông lượng (20 người dùng song song) | 29 yêu cầu/giây | 39 yêu cầu/giây |
| Bộ truy vấn hỗn hợp (danh sách, dashboard, chi tiết, việc của tôi…) | 162 yêu cầu/giây | 188 yêu cầu/giây |
| Trang danh sách công việc: phần tử DOM | 60.104 | 3.768 |
| Trang danh sách công việc: chặn luồng chính | 375 ms | 0 ms |
| Gantt mở lần đầu (`networkidle`) | 2.797 ms | 662 ms |
| Yêu cầu tới máy chủ bên thứ ba khi mở Gantt | 2 (CDN) | 0 |

Các API nhẹ (chi tiết công việc, dashboard, hoạt động, danh sách dự án…) đã đạt ~1.150 yêu cầu/giây, độ trễ p95 ≈ 24 ms trước và sau. Các trang khác (bảng Kanban, WBS, dashboard, báo cáo, chi tiết) mở trong ~0,6 s (gồm 0,5 s chờ mạng rảnh của phép đo).

## 3. Đã tối ưu gì và vì sao

1. **Gantt tự phục vụ phông biểu tượng.** Thư viện Gantt mặc định tải phông từ `cdn.svar.dev` bằng hai yêu cầu nối tiếp (~3 giây lần đầu). Nay tắt (`fonts={false}`) và phục vụ cùng tệp từ `apps/web/public/fonts/svar/`. Còn tránh được phụ thuộc vào máy chủ của bên khác và việc lộ địa chỉ IP người dùng cho họ. E2E `performance.spec.ts` chặn hồi quy (không được có yêu cầu tới tên miền khác `localhost`).
2. **Danh sách công việc vẽ theo đợt.** Cây công việc được làm phẳng và chỉ vẽ 150 dòng đầu, nạp thêm 200 dòng mỗi khi cuộn gần cuối (`IntersectionObserver`). Trước đây vẽ đệ quy toàn bộ cây và mỗi dòng còn kèm một hộp thoại "thêm việc con" — hàng chục nghìn phần tử ngay khi mở trang. Logic làm phẳng là hàm thuần có test (`tree-rows.ts`).
3. **API danh sách công việc gọn hơn.** Không trả `description` (chỉ trang chi tiết cần; nhận `null` ở danh sách) và ghép người phụ trách, số việc con bằng ba truy vấn phẳng thay vì nối theo từng dòng — nhanh gấp ~2 ở tầng truy vấn (53 → 27 ms). **Hợp đồng:** `TaskDto.description` luôn `null` trong `GET .../tasks`; muốn nội dung phải gọi `GET .../tasks/:id`.
4. **Chỉ mục còn thiếu** (migration `20260922100000_fk_indexes`): `task_assignees(userId)`, `project_members(userId)`, `task_dependencies(successorId)`, `tasks(boardColumnId)`, `comments(authorId)`, `activity_logs(actorId)`, `risk_issues(ownerId)`, `deliverables(ownerId)`, `user_badges(userId)`, `user_scores(userId)`. Các truy vấn "Việc của tôi", nhiệm vụ, thông báo và kiểm tra quyền dự án riêng tư trước đây quét toàn bảng; chúng còn làm chậm xoá theo dây chuyền. Lợi ích tăng theo kích thước dữ liệu (ở vài nghìn dòng chưa thấy rõ).

## 4. Đã cân nhắc nhưng chưa làm

| Ý tưởng | Vì sao chưa |
|---|---|
| Ảo hoá cuộn hoàn chỉnh (chỉ giữ dòng đang thấy) cho danh sách | Vẽ theo đợt đã đủ cho vài nghìn dòng; ảo hoá thật cần chiều cao dòng cố định, phức tạp với dòng co giãn và kéo thả. Xem lại khi có dự án hàng chục nghìn công việc. |
| Bỏ tải lại toàn bộ danh sách sau mỗi thay đổi (cập nhật lạc quan) | Một số thay đổi kéo theo hiệu ứng phía máy chủ (ví dụ nâng cấp cấp WBS của cha) nên phải tải lại để đúng. Dự án nhỏ không cảm nhận được. |
| Bộ nhớ đệm phía máy chủ / kiểm tra phiên bản để trả 304 mà không dựng lại | ETag đã tiết kiệm băng thông; tiết kiệm CPU cần phiên bản danh sách chính xác, dễ lỗi khi đổi tên người phụ trách. Chỉ đáng làm khi tải thật đòi hỏi. |
| Bỏ bớt trường lặp trong JSON danh sách (`organizationId`, `projectId`, `createdById`) | Đổi hợp đồng API; ~15% dung lượng, mà Caddy/Cloudflare đã nén. |
| Nén ở tầng Node | Caddy (`encode zstd gzip`) và Cloudflare đã nén ở tầng ngoài. |
| Image Docker nhẹ hơn (hiện ≈ 2,15 GB) | Ảnh hưởng thời gian kéo/triển khai, không ảnh hưởng tốc độ chạy. Việc riêng (van-hanh.md). |

## 5. Giới hạn của các con số

- Máy phát triển, một tiến trình API (Node đơn luồng), Postgres cục bộ; không có độ trễ mạng thật. Trên VPS nhỏ hoặc qua Cloudflare Tunnel, độ trễ mạng cộng thêm nhưng chênh lệch giữa trước/sau vẫn giữ nguyên.
- Thông lượng bị giới hạn bởi một luồng Node: ~1.100 yêu cầu/giây với API nhẹ, ~40 với danh sách 2.500 công việc. Với nhiều người dùng đồng thời trên dự án rất lớn, cần nhiều bản API (khi đó phải chuyển bộ giới hạn tốc độ sang Redis — xem van-hanh.md §7).
- Chưa đo trên thiết bị di động thật hoặc mạng chậm.
