# Hướng dẫn sử dụng PMTool

Tài liệu này mô tả các tính năng hiện có của PMTool và cách sử dụng, dành cho người dùng cuối (quản lý dự án, thành viên nhóm). Về kiến trúc kỹ thuật, cách chạy dự án cho mục đích phát triển, xem [README.md](../README.md).

PMTool tổ chức dữ liệu theo 3 cấp: **Tổ chức** (Organization) → **Dự án** (Project) → **Công việc** (Task). Mỗi tổ chức là một không gian làm việc biệt lập hoàn toàn với các tổ chức khác (đa tenant) — dữ liệu của tổ chức này không bao giờ hiển thị cho thành viên của tổ chức khác.

## Mục lục

1. [Bắt đầu: đăng ký và tạo tổ chức](#1-bắt-đầu-đăng-ký-và-tạo-tổ-chức)
2. [Vai trò & phân quyền](#2-vai-trò--phân-quyền)
3. [Dự án và công việc (WBS)](#3-dự-án-và-công-việc-wbs)
4. [Bảng Kanban](#4-bảng-kanban)
5. [Biểu đồ tiến độ (Gantt)](#5-biểu-đồ-tiến-độ-gantt)
6. [Rủi ro & Vấn đề](#6-rủi-ro--vấn-đề)
7. [Điều lệ dự án (Project Charter)](#7-điều-lệ-dự-án-project-charter)
8. [Các bên liên quan (Stakeholder Register)](#8-các-bên-liên-quan-stakeholder-register)
9. [Danh mục tài liệu (Document Registry)](#9-danh-mục-tài-liệu-document-registry)
10. [Dashboard tổng quan](#10-dashboard-tổng-quan)
11. [Gamification: điểm, chuỗi ngày, huy hiệu](#11-gamification-điểm-chuỗi-ngày-huy-hiệu)
12. [Trợ lý AI](#12-trợ-lý-ai)
13. [Thông báo Telegram](#13-thông-báo-telegram)
14. [Giao diện: sáng/tối, song ngữ, di động](#14-giao-diện-sángtối-song-ngữ-di-động)

---

## 1. Bắt đầu: đăng ký và tạo tổ chức

1. Vào trang chủ, chọn **Đăng ký**, nhập họ tên / email / mật khẩu.
2. Sau khi đăng ký, hệ thống chuyển thẳng đến màn hình **Tạo tổ chức của bạn** — mỗi tổ chức là một không gian làm việc riêng cho công ty/nhóm bạn, đại diện bởi một **slug** (định danh trong URL, ví dụ `cong-ty-abc`).
3. Sau khi tạo tổ chức, bạn vào thẳng **Dashboard** của tổ chức đó với vai trò **Owner**.

Đăng nhập lần sau tại trang **Đăng nhập**; phiên đăng nhập dùng access token (15 phút) tự làm mới qua refresh token (cookie httpOnly, 30 ngày) — không cần đăng nhập lại thường xuyên.

> **Mời thành viên:** cơ chế mời thành viên (tạo lời mời, chấp nhận lời mời) đã có sẵn ở tầng API nhưng **chưa có giao diện** trong bản hiện tại — đây là hạng mục UI còn thiếu, dự kiến bổ sung ở bản sau.

## 2. Vai trò & phân quyền

Mỗi thành viên trong một tổ chức có đúng một trong 5 vai trò (RBAC), theo thứ tự quyền giảm dần:

| Vai trò | Mô tả |
|---|---|
| **Owner** | Toàn quyền, người tạo tổ chức mặc định là Owner |
| **Admin** | Toàn quyền quản trị, trừ một số thao tác chỉ Owner mới làm được |
| **PM** (Project Manager) | Quản lý dự án: tạo/sửa dự án, công việc, rủi ro |
| **Member** | Thành viên thực thi: cập nhật công việc được giao, bình luận |
| **Viewer** | Chỉ xem, không chỉnh sửa |

Phân quyền được kiểm tra ở tầng API cho mọi thao tác ghi dữ liệu — ví dụ Member không thể tạo dự án mới, chỉ PM trở lên mới làm được.

## 3. Dự án và công việc (WBS)

- Từ menu bên trái, chọn **Dự án** để xem danh sách, bấm **Tạo dự án** — nhập **Tên dự án** và **Mã dự án** (chữ hoa + số, ví dụ `WEB`, dùng làm tiền tố cho mã công việc như `WEB-1`, `WEB-2`, ...).
- Mỗi dự án có 8 tab: **Tổng quan** (dashboard), **Công việc** (danh sách WBS), **Bảng** (Kanban), **Tiến độ** (Gantt), **Rủi ro/Vấn đề**, **Điều lệ**, **Các bên liên quan**, **Tài liệu**.
- Trong tab **Công việc**, bấm **Thêm công việc** để tạo việc mới với tiêu đề, mô tả, độ ưu tiên (Thấp/Trung bình/Cao/Khẩn cấp), ngày bắt đầu/kết thúc, người phụ trách.
- Mở một công việc để xem chi tiết: có thể **thêm công việc con** (phân cấp cha/con không giới hạn độ sâu — đây là cấu trúc WBS thật sự), thêm **phụ thuộc** (predecessor/successor — hệ thống tự chặn vòng lặp phụ thuộc), gán **người phụ trách**, và **bình luận** trao đổi ngay trên công việc.
- Trạng thái công việc: Cần làm → Đang làm → Đang xem xét → Hoàn thành, hoặc Bị chặn.

## 4. Bảng Kanban

Tab **Bảng** hiển thị công việc theo cột trạng thái, kéo-thả để chuyển trạng thái (thứ tự và cột được lưu lại ngay, còn nguyên sau khi tải lại trang). Bấm **+ Thêm cột** để tạo cột tuỳ chỉnh ngoài 3 cột mặc định (Việc cần làm / Đang thực hiện / Hoàn thành).

## 5. Biểu đồ tiến độ (Gantt)

Tab **Tiến độ** vẽ toàn bộ công việc của dự án theo ngày bắt đầu/kết thúc trên trục thời gian — công việc chưa đặt ngày sẽ mặc định hiển thị tại ngày tạo. Đặt ngày bắt đầu/kết thúc trong trang chi tiết công việc để biểu đồ phản ánh đúng kế hoạch thực tế.

## 6. Rủi ro & Vấn đề

Tab **Rủi ro/Vấn đề** là sổ theo dõi rủi ro (Risk) và vấn đề (Issue) của dự án theo chuẩn PMP:

- Khi tạo, nhập **Khả năng xảy ra** và **Mức độ ảnh hưởng** (thang 1–5) — hệ thống tự tính **Mức độ nghiêm trọng = Khả năng × Ảnh hưởng** (tối đa 25), hiển thị ngay trong bảng để ưu tiên xử lý.
- Trạng thái đi theo vòng đời: Đã xác định → Đang phân tích → Đang xử lý → Đã giải quyết/Đã đóng.
- Có thể gán người phụ trách và hạn xử lý cho từng rủi ro/vấn đề.

## 7. Điều lệ dự án (Project Charter)

Tab **Điều lệ** là văn kiện chính thức hoá dự án theo PMBOK — mỗi dự án có đúng một điều lệ:

- Gồm các mục: **Mục đích & lý do** (business case), **Mục tiêu & tiêu chí thành công**, **Phạm vi tổng quát** (trong/ngoài phạm vi), **Các mốc chính** và **Ngân sách** (tóm tắt dạng văn bản), **Giả định**, **Ràng buộc**, **Nhà tài trợ** (Sponsor), **Quản lý dự án được chỉ định**.
- Bấm **Lưu** để lưu nháp — có thể lưu nhiều lần khi soạn thảo dần, không bắt buộc điền đủ ngay từ đầu.
- Bấm **Phê duyệt** để chính thức hoá điều lệ — chỉ Owner/Admin mới phê duyệt được (PM trở lên mới sửa được nội dung).
- **Quan trọng**: nếu sửa lại nội dung sau khi đã phê duyệt, điều lệ tự động quay về trạng thái **Bản nháp** và cần phê duyệt lại — vì bản phê duyệt cũ không còn phản ánh đúng nội dung mới.

## 8. Các bên liên quan (Stakeholder Register)

Tab **Các bên liên quan** là sổ theo dõi và phân tích các bên liên quan của dự án (khách hàng, nhà tài trợ, nhà cung cấp, thành viên nội bộ, ...):

- Mỗi bên liên quan có thể **liên kết với một thành viên trong tổ chức** (nếu là người có tài khoản) hoặc là **bên ngoài** (khách hàng, nhà cung cấp, ... không có tài khoản PMTool) — chỉ cần nhập tên, chức danh, tổ chức, email/điện thoại.
- Đánh giá **Quyền lực** (Influence) và **Mức quan tâm** (Interest) theo 3 mức Thấp/Trung bình/Cao — hệ thống tự vẽ **Ma trận Quyền lực/Mức quan tâm** (Power/Interest Grid), một công cụ phân tích kinh điển của PMBOK, giúp thấy ngay ai cần "Quản lý sát sao" (quyền lực cao + quan tâm cao).
- Theo dõi **mức độ gắn kết hiện tại → mong muốn** theo 5 cấp độ PMBOK: Chưa biết, Phản đối, Trung lập, Ủng hộ, Dẫn dắt.
- Có thể **Sửa** hoặc **Xoá** từng bên liên quan sau khi tạo.

## 9. Danh mục tài liệu (Document Registry)

Tab **Tài liệu** là danh mục các tài liệu của dự án — **không phải nơi tải file lên**, mà là một sổ theo dõi trỏ tới nơi tài liệu thật sự được lưu (Google Drive, SharePoint, ...):

- Mỗi mục gồm: **Tiêu đề**, **Đường dẫn** (bắt buộc — liên kết tới tài liệu thật), **Loại** (Điều lệ/Kế hoạch/Báo cáo/Hợp đồng/Biên bản họp/Thiết kế/Yêu cầu/Khác), **Phiên bản**, **Trạng thái** (Bản nháp/Đang xem xét/Đã phê duyệt/Đã lỗi thời), **Người phụ trách**.
- Bấm vào tiêu đề trong danh sách để mở tài liệu ở tab mới.
- Có thể **Sửa** hoặc **Xoá** từng tài liệu sau khi tạo.

## 10. Dashboard tổng quan

- **Dashboard tổ chức** (menu trái): tổng số dự án, số rủi ro/vấn đề đang mở, số công việc quá hạn trên toàn tổ chức, cùng biểu đồ phân bổ dự án/công việc theo trạng thái.
- **Tổng quan dự án** (tab đầu tiên trong một dự án): tỉ lệ hoàn thành, số công việc/rủi ro/vấn đề đang mở của riêng dự án đó, danh sách công việc quá hạn.

## 11. Gamification: điểm, chuỗi ngày, huy hiệu

PMTool thưởng điểm hoạt động để khuyến khích cập nhật tiến độ thường xuyên:

| Hành động | Điểm |
|---|---|
| Tạo công việc mới | +5 |
| Hoàn thành công việc | +10 |

- **Chuỗi ngày (streak):** số ngày liên tiếp có hoạt động ghi điểm, tính theo giờ Việt Nam (UTC+7).
- **Huy hiệu:** Khởi đầu (công việc đầu tiên), Kiên trì 7 ngày, Bền bỉ 30 ngày, Người giải quyết rủi ro (5 rủi ro/vấn đề), Cỗ máy công việc (50 công việc hoàn thành), Đồng đội tích cực (20 bình luận).
- **Bảng xếp hạng** (menu trái): xếp hạng thành viên trong tổ chức theo tổng điểm.

## 12. Trợ lý AI

Trong trang chi tiết công việc, có 3 tính năng AI (dùng Anthropic Claude API):

- **Tóm tắt bằng AI**: tóm tắt nhanh nội dung mô tả + bình luận của công việc.
- **Gợi ý công việc con (AI)**: AI đề xuất danh sách công việc con phù hợp dựa trên tiêu đề/mô tả công việc cha — bạn xem trước và chọn cái nào muốn thêm thật, AI không tự tạo công việc.
- **Tạo công việc bằng AI**: mô tả nhu cầu bằng ngôn ngữ tự nhiên (ví dụ "Tạo 3 công việc để chuẩn bị demo tuần sau"), AI phân tích thành danh sách công việc cụ thể để bạn xác nhận trước khi tạo.

> Cần biến môi trường `ANTHROPIC_API_KEY` ở phía máy chủ. Nếu chưa cấu hình, các nút trên vẫn hiển thị nhưng khi bấm sẽ báo lỗi rõ ràng thay vì tạo dữ liệu sai.

## 13. Thông báo Telegram

Vào **Cài đặt** (bấm avatar ở góc phải trên → Cài đặt) để liên kết tài khoản Telegram cá nhân — đây là cài đặt theo từng người dùng, dùng chung cho mọi tổ chức bạn tham gia, không phải cài đặt riêng theo tổ chức.

1. Bấm **Kết nối Telegram**, hệ thống tạo một liên kết `t.me/...` có hiệu lực 10 phút.
2. Mở liên kết đó trên Telegram, bấm **Start** để hoàn tất liên kết.
3. Sau khi liên kết, bạn sẽ nhận được:
   - Thông báo ngay khi được giao một công việc.
   - Nhắc nhở hằng ngày lúc 8:00 sáng (giờ Việt Nam) cho các công việc đến hạn trong ngày.

Có thể **Ngắt kết nối** bất cứ lúc nào từ cùng trang Cài đặt.

> Cần biến môi trường `TELEGRAM_BOT_TOKEN` (và `TELEGRAM_WEBHOOK_SECRET`, `API_PUBLIC_URL` truy cập công khai qua HTTPS) ở phía máy chủ. Nếu chưa cấu hình, nút Kết nối sẽ báo lỗi rõ ràng thay vì treo hoặc gửi thông báo thất bại âm thầm.

## 14. Giao diện: sáng/tối, song ngữ, di động

- **Chủ đề sáng/tối**: bấm biểu tượng mặt trăng/mặt trời ở thanh trên cùng, lựa chọn được lưu lại cho lần sau.
- **Ngôn ngữ**: chọn Tiếng Việt / English ở góc phải thanh trên cùng, lưu qua cookie nên giữ nguyên khi điều hướng.
- **Di động**: giao diện responsive — menu bên trái chuyển thành drawer trượt ra khi màn hình hẹp.
