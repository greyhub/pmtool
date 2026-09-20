# Hướng dẫn sử dụng PMTool

Tài liệu này mô tả các tính năng hiện có của PMTool và cách sử dụng, dành cho người dùng cuối (quản lý dự án, thành viên nhóm). Về kiến trúc kỹ thuật, cách chạy dự án cho mục đích phát triển, xem [README.md](../README.md).

PMTool tổ chức dữ liệu theo 3 cấp: **Tổ chức** (Organization) → **Dự án** (Project) → **Công việc** (Task). Mỗi tổ chức là một không gian làm việc biệt lập hoàn toàn với các tổ chức khác (đa tenant) — dữ liệu của tổ chức này không bao giờ hiển thị cho thành viên của tổ chức khác.

## Mục lục

1. [Bắt đầu: đăng ký và tạo tổ chức](#1-bắt-đầu-đăng-ký-và-tạo-tổ-chức)
2. [Vai trò & phân quyền](#2-vai-trò--phân-quyền)
3. [Quản lý Tổ chức](#3-quản-lý-tổ-chức)
4. [Dự án và công việc (WBS)](#4-dự-án-và-công-việc-wbs)
5. [Quản lý Dự án](#5-quản-lý-dự-án)
6. [Bảng Kanban](#6-bảng-kanban)
7. [Biểu đồ tiến độ (Gantt)](#7-biểu-đồ-tiến-độ-gantt)
8. [Rủi ro & Vấn đề](#8-rủi-ro--vấn-đề)
9. [Điều lệ dự án (Project Charter)](#9-điều-lệ-dự-án-project-charter)
10. [Các bên liên quan (Stakeholder Register)](#10-các-bên-liên-quan-stakeholder-register)
11. [Danh mục tài liệu (Document Registry)](#11-danh-mục-tài-liệu-document-registry)
12. [Artifact: trang HTML/CSS/JS tự viết](#12-artifact-trang-htmlcssjs-tự-viết)
13. [Dashboard tổng quan](#13-dashboard-tổng-quan)
14. [Gamification: điểm, chuỗi ngày, huy hiệu](#14-gamification-điểm-chuỗi-ngày-huy-hiệu)
15. [Trợ lý AI](#15-trợ-lý-ai)
16. [Thông báo Telegram](#16-thông-báo-telegram)
17. [Giao diện: sáng/tối, song ngữ, di động](#17-giao-diện-sángtối-song-ngữ-di-động)
18. [Nhân vật đồng hành](#18-nhân-vật-đồng-hành)

---

## 1. Bắt đầu: đăng ký và tạo tổ chức

1. Vào trang chủ, chọn **Đăng ký**, nhập họ tên / email / mật khẩu.
2. Sau khi đăng ký, hệ thống chuyển thẳng đến màn hình **Tạo tổ chức của bạn** — mỗi tổ chức là một không gian làm việc riêng cho công ty/nhóm bạn, đại diện bởi một **slug** (định danh trong URL, ví dụ `cong-ty-abc`).
3. Sau khi tạo tổ chức, bạn vào thẳng **Dashboard** của tổ chức đó với vai trò **Owner**.

Đăng nhập lần sau tại trang **Đăng nhập**; phiên đăng nhập dùng access token (15 phút) tự làm mới qua refresh token (cookie httpOnly, 30 ngày) — không cần đăng nhập lại thường xuyên.

Mời thêm thành viên vào tổ chức được thực hiện ở trang **Cài đặt tổ chức** — xem [mục 3](#3-quản-lý-tổ-chức).

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

**Vai trò riêng theo từng dự án:** vai trò ở trên là vai trò *mặc định trong toàn tổ chức*, áp dụng cho mọi dự án trừ khi dự án đó gán riêng cho bạn một vai trò khác — xem [mục 5](#5-quản-lý-dự-án) để biết cách gán và ý nghĩa của vai trò riêng này.

## 3. Quản lý Tổ chức

Vào menu bên trái, chọn **Cài đặt tổ chức** (chỉ Owner/Admin thao tác được các mục dưới đây, nhưng ai cũng xem được trang này — thao tác không đủ quyền sẽ báo lỗi rõ ràng thay vì bị ẩn).

- **Thông tin chung**: sửa **Tên tổ chức**, bấm **Lưu**. Nút **Lưu trữ tổ chức** (chỉ Owner) đưa tổ chức vào trạng thái lưu trữ: tổ chức biến mất khỏi danh sách chuyển đổi tổ chức, không tạo được dự án mới hay mời thêm thành viên mới — các thao tác khác (sửa dự án, xoá thành viên, ...) vẫn hoạt động bình thường. Bấm **Bỏ lưu trữ** bất cứ lúc nào để khôi phục lại như cũ.
- **Thành viên**: bảng liệt kê toàn bộ thành viên, đổi vai trò trực tiếp qua ô chọn hoặc **Xoá** khỏi tổ chức. Tổ chức luôn phải còn ít nhất một Owner — hệ thống chặn việc hạ vai trò hoặc xoá Owner cuối cùng.
- **Mời thành viên**: nhập **Email** và chọn **Vai trò**, bấm **Gửi lời mời**. Vì PMTool chưa gửi email tự động, hệ thống hiển thị một **liên kết chấp nhận lời mời** để bạn sao chép và gửi thủ công cho người được mời (Slack, email cá nhân, ...) — liên kết có hiệu lực 7 ngày. Người nhận đăng nhập/đăng ký tài khoản rồi mở liên kết đó để tham gia tổ chức — nếu họ chưa đăng nhập, hệ thống tự đưa họ quay lại đúng liên kết mời sau khi đăng nhập/đăng ký xong, không cần mở lại link.
  - Mời một email **đã là thành viên** sẽ báo lỗi rõ ràng thay vì tạo lời mời trùng — hãy đổi vai trò trực tiếp trong bảng Thành viên ở trên.
  - Mời lại **cùng một email** đang có lời mời chờ sẽ thay thế lời mời cũ (coi như gửi lại/đổi vai trò lời mời), không tạo thêm bản sao.
  - Bấm **Huỷ** trên một lời mời đang chờ để thu hồi — liên kết cũ ngay lập tức không dùng được nữa.

## 4. Dự án và công việc (WBS)

- Từ menu bên trái, chọn **Dự án** để xem danh sách, bấm **Tạo dự án** — nhập **Tên dự án** và **Mã dự án** (chữ hoa + số, ví dụ `WEB`, dùng làm tiền tố cho mã công việc như `WEB-1`, `WEB-2`, ...).
- Mỗi dự án có 10 tab: **Tổng quan** (dashboard), **Công việc** (danh sách WBS), **Bảng** (Kanban), **Tiến độ** (Gantt), **Rủi ro/Vấn đề**, **Điều lệ**, **Các bên liên quan**, **Tài liệu**, **Artifact**, **Cài đặt**.
- Trong tab **Công việc**, bấm **Thêm công việc** để tạo việc mới với tiêu đề, mô tả, độ ưu tiên (Thấp/Trung bình/Cao/Khẩn cấp), ngày bắt đầu/kết thúc, người phụ trách.
- Mở một công việc để xem chi tiết: có thể **thêm công việc con** (phân cấp cha/con không giới hạn độ sâu — đây là cấu trúc WBS thật sự), thêm **phụ thuộc** (predecessor/successor — hệ thống tự chặn vòng lặp phụ thuộc), gán **người phụ trách**, và **bình luận** trao đổi ngay trên công việc.
- Trạng thái công việc: Cần làm → Đang làm → Đang xem xét → Hoàn thành, hoặc Bị chặn.

## 5. Quản lý Dự án

Tab **Cài đặt** trong một dự án:

- **Thông tin chung**: sửa tên, mô tả, ngày bắt đầu/kết thúc dự kiến, và **Trạng thái** — chọn **Lưu trữ** trong ô Trạng thái chính là cách lưu trữ dự án (không phải một nút riêng).
- **Vai trò riêng trong dự án**: gán cho một thành viên tổ chức một vai trò *khác* với vai trò mặc định của họ, chỉ áp dụng trong phạm vi dự án này — ví dụ một người là **Member** ở cấp tổ chức nhưng cần làm **PM** trên riêng dự án X, hoặc ngược lại cần hạn chế một **PM** xuống **Viewer** trên một dự án nhạy cảm. Bấm **+ Thêm thành viên**, chọn một thành viên tổ chức (chỉ hiện những người *chưa có* vai trò riêng trên dự án này) và vai trò mong muốn, bấm **Thêm**.
  - Bấm **Xoá** trên một dòng để gỡ vai trò riêng — thành viên đó **không** bị mất quyền truy cập dự án, chỉ quay về dùng vai trò mặc định theo tổ chức như trước.
  - Chỉ Owner/Admin của tổ chức, hoặc người đang có vai trò riêng Owner/Admin trên *chính dự án đó*, mới quản lý được danh sách này — đảm bảo một Owner/Admin tổ chức không bao giờ tự khoá mình khỏi việc chỉnh sửa, kể cả khi đã tự hạ vai trò riêng của bản thân trên dự án.

## 6. Bảng Kanban

Tab **Bảng** hiển thị công việc theo cột trạng thái, kéo-thả để chuyển trạng thái (thứ tự và cột được lưu lại ngay, còn nguyên sau khi tải lại trang). Bấm **+ Thêm cột** để tạo cột tuỳ chỉnh ngoài 3 cột mặc định (Việc cần làm / Đang thực hiện / Hoàn thành).

## 7. Biểu đồ tiến độ (Gantt)

Tab **Tiến độ** vẽ toàn bộ công việc của dự án theo ngày bắt đầu/kết thúc trên trục thời gian — công việc chưa đặt ngày sẽ mặc định hiển thị tại ngày tạo. Đặt ngày bắt đầu/kết thúc trong trang chi tiết công việc để biểu đồ phản ánh đúng kế hoạch thực tế.

- **Màu thanh công việc theo trạng thái**: xanh lá (Hoàn thành), xanh dương (Đang làm), vàng (Đang xem xét), đỏ (Bị chặn), xám (Cần làm) — nhất quán với màu trạng thái ở Bảng Kanban và danh sách Công việc.
- **Công việc cha** (có công việc con) hiển thị dạng thanh tổng hợp bao trùm toàn bộ khoảng thời gian của các công việc con. **Công việc mốc** (ngày bắt đầu = ngày kết thúc) hiển thị dạng hình thoi thay vì thanh dài.
- Đường kẻ dọc màu vàng nhạt đánh dấu **hôm nay**; các ngày cuối tuần được tô nền xám nhạt.
- Bấm vào tên một công việc để mở trang chi tiết của nó. Kéo thả một thanh để đổi ngày bắt đầu/kết thúc — hệ thống tự lưu và báo "Đã lưu" ngay dưới thanh công cụ.
- Chọn mức hiển thị **Ngày / Tuần / Tháng** ở góc trên bên phải để thu phóng trục thời gian.
- Bảng bên trái chỉ giữ hai cột **Công việc** và **Người phụ trách** — cố tình gọn để nhường chỗ cho biểu đồ; Trạng thái/Độ ưu tiên/Ngày đã có sẵn ngay trên chính thanh công việc (màu sắc, vị trí, độ dài) nên không lặp lại thành cột riêng. Trên màn hình hẹp, bảng tự thu gọn chỉ còn cột tên.
- Cột **Người phụ trách** hiển thị icon nhân vật đồng hành của từng người (tối đa 2 icon, thêm "+N" nếu nhiều hơn) thay vì tên đầy đủ — di chuột vào icon để xem tên. Cách này nhận diện đúng từng người vì mỗi thành viên trong một tổ chức bắt buộc chọn một nhân vật khác nhau (xem mục 18).

## 8. Rủi ro & Vấn đề

Tab **Rủi ro/Vấn đề** là sổ theo dõi rủi ro (Risk) và vấn đề (Issue) của dự án theo chuẩn PMP:

- Khi tạo, nhập **Khả năng xảy ra** và **Mức độ ảnh hưởng** (thang 1–5) — hệ thống tự tính **Mức độ nghiêm trọng = Khả năng × Ảnh hưởng** (tối đa 25), hiển thị ngay trong bảng để ưu tiên xử lý.
- Trạng thái đi theo vòng đời: Đã xác định → Đang phân tích → Đang xử lý → Đã giải quyết/Đã đóng.
- Có thể gán người phụ trách và hạn xử lý cho từng rủi ro/vấn đề.

## 9. Điều lệ dự án (Project Charter)

Tab **Điều lệ** là văn kiện chính thức hoá dự án theo PMBOK — mỗi dự án có đúng một điều lệ:

- Gồm các mục: **Mục đích & lý do** (business case), **Mục tiêu & tiêu chí thành công**, **Phạm vi tổng quát** (trong/ngoài phạm vi), **Các mốc chính** và **Ngân sách** (tóm tắt dạng văn bản), **Giả định**, **Ràng buộc**, **Nhà tài trợ** (Sponsor), **Quản lý dự án được chỉ định**.
- Bấm **Lưu** để lưu nháp — có thể lưu nhiều lần khi soạn thảo dần, không bắt buộc điền đủ ngay từ đầu.
- Bấm **Phê duyệt** để chính thức hoá điều lệ — chỉ Owner/Admin mới phê duyệt được (PM trở lên mới sửa được nội dung).
- **Quan trọng**: nếu sửa lại nội dung sau khi đã phê duyệt, điều lệ tự động quay về trạng thái **Bản nháp** và cần phê duyệt lại — vì bản phê duyệt cũ không còn phản ánh đúng nội dung mới.

## 10. Các bên liên quan (Stakeholder Register)

Tab **Các bên liên quan** là sổ theo dõi và phân tích các bên liên quan của dự án (khách hàng, nhà tài trợ, nhà cung cấp, thành viên nội bộ, ...):

- Mỗi bên liên quan có thể **liên kết với một thành viên trong tổ chức** (nếu là người có tài khoản) hoặc là **bên ngoài** (khách hàng, nhà cung cấp, ... không có tài khoản PMTool) — chỉ cần nhập tên, chức danh, tổ chức, email/điện thoại.
- Đánh giá **Quyền lực** (Influence) và **Mức quan tâm** (Interest) theo 3 mức Thấp/Trung bình/Cao — hệ thống tự vẽ **Ma trận Quyền lực/Mức quan tâm** (Power/Interest Grid), một công cụ phân tích kinh điển của PMBOK, giúp thấy ngay ai cần "Quản lý sát sao" (quyền lực cao + quan tâm cao).
- Theo dõi **mức độ gắn kết hiện tại → mong muốn** theo 5 cấp độ PMBOK: Chưa biết, Phản đối, Trung lập, Ủng hộ, Dẫn dắt.
- Có thể **Sửa** hoặc **Xoá** từng bên liên quan sau khi tạo.

## 11. Danh mục tài liệu (Document Registry)

Tab **Tài liệu** là danh mục các tài liệu của dự án — **không phải nơi tải file lên**, mà là một sổ theo dõi trỏ tới nơi tài liệu thật sự được lưu (Google Drive, SharePoint, ...):

- Mỗi mục gồm: **Tiêu đề**, **Đường dẫn** (bắt buộc — liên kết tới tài liệu thật), **Loại** (Điều lệ/Kế hoạch/Báo cáo/Hợp đồng/Biên bản họp/Thiết kế/Yêu cầu/Khác), **Phiên bản**, **Trạng thái** (Bản nháp/Đang xem xét/Đã phê duyệt/Đã lỗi thời), **Người phụ trách**.
- Bấm vào tiêu đề trong danh sách để mở tài liệu ở tab mới.
- Có thể **Sửa** hoặc **Xoá** từng tài liệu sau khi tạo.

## 12. Artifact: trang HTML/CSS/JS tự viết

Tab **Artifact** cho phép tự viết một trang HTML/CSS/JS và xem nó chạy thật ngay trong trình duyệt — giống tính năng Artifact của Claude:

- Cột trái là ô soạn HTML/CSS/JS (một file duy nhất, CSS/JS viết inline bằng thẻ `<style>`/`<script>`); cột phải là **khung xem trước cập nhật ngay khi gõ**, không cần lưu mới xem được.
- Bấm **Lưu** để lưu vào dự án. Với artifact đã có, có thể **Xoá**.
- Trang xem trước chạy trong một khung **cách ly hoàn toàn** (sandbox): mã JS trong đó không thể đọc cookie, không thể truy cập bất kỳ trang nào khác của PMTool, và không thể gửi yêu cầu mang theo phiên đăng nhập của bạn tới máy chủ — kể cả khi trang đó có lỗi hoặc bị ai đó cố tình viết mã độc. Điều này đã được kiểm chứng trực tiếp (không chỉ trên lý thuyết): thử đọc `document.cookie`, truy cập trang cha, hoặc gọi tới API PMTool từ bên trong artifact đều bị chặn hoàn toàn.
- Vì nội dung có thể chạy JS tự do, tất cả thành viên tổ chức (trừ Viewer) đều tạo/sửa được — giống mức độ mở của Danh mục tài liệu, không phải mức hạn chế như Điều lệ/Các bên liên quan.

## 13. Dashboard tổng quan

- **Dashboard tổ chức** (menu trái): tổng số dự án, số rủi ro/vấn đề đang mở, số công việc quá hạn trên toàn tổ chức, cùng biểu đồ phân bổ dự án/công việc theo trạng thái.
- **Tổng quan dự án** (tab đầu tiên trong một dự án): tỉ lệ hoàn thành, số công việc/rủi ro/vấn đề đang mở của riêng dự án đó, danh sách công việc quá hạn.

## 14. Gamification: điểm, chuỗi ngày, huy hiệu

PMTool thưởng điểm hoạt động để khuyến khích cập nhật tiến độ thường xuyên:

| Hành động | Điểm |
|---|---|
| Tạo công việc mới | +5 |
| Hoàn thành công việc | +10 |

- **Chuỗi ngày (streak):** số ngày liên tiếp có hoạt động ghi điểm, tính theo giờ Việt Nam (UTC+7).
- **Huy hiệu:** Khởi đầu (công việc đầu tiên), Kiên trì 7 ngày, Bền bỉ 30 ngày, Người giải quyết rủi ro (5 rủi ro/vấn đề), Cỗ máy công việc (50 công việc hoàn thành), Đồng đội tích cực (20 bình luận).
- **Bảng xếp hạng** (menu trái): xếp hạng thành viên trong tổ chức theo tổng điểm.

**Nhiệm vụ ngày/tuần** — khối "Nhiệm vụ của tôi" ở đầu trang Bảng xếp hạng, mỗi nhiệm vụ hoàn thành được cộng điểm thưởng đúng một lần cho mỗi ngày/tuần (giờ Việt Nam; tuần tính từ Thứ Hai):

| Nhiệm vụ | Điều kiện | Điểm |
|---|---|---|
| Xong việc hôm nay | Hoàn thành mọi công việc được giao có hạn chót hôm nay | +15 |
| Xong việc tuần này | Hoàn thành mọi công việc được giao có hạn chót trong tuần này | +30 |
| Cập nhật tiến độ | Cập nhật **% hoàn thành** của ít nhất 1 công việc hôm nay (ô "% hoàn thành" ở trang chi tiết công việc; thanh tiến độ cũng hiện trên biểu đồ Gantt) | +5 |
| Điểm danh | Đăng nhập trong ngày | +5 |

- Hai nhiệm vụ "Xong việc" chỉ hiện khi bạn có công việc đến hạn trong kỳ đó; điểm thưởng được ghi nhận khi bạn mở trang Bảng xếp hạng lần đầu sau khi đạt đủ điều kiện.
- Đã hoàn thành trong kỳ thì giữ nguyên trạng thái hoàn thành dù sau đó bạn được giao thêm việc mới.

## 15. Trợ lý AI

Trong trang chi tiết công việc, có 3 tính năng AI (dùng Anthropic Claude API):

- **Tóm tắt bằng AI**: tóm tắt nhanh nội dung mô tả + bình luận của công việc.
- **Gợi ý công việc con (AI)**: AI đề xuất danh sách công việc con phù hợp dựa trên tiêu đề/mô tả công việc cha — bạn xem trước và chọn cái nào muốn thêm thật, AI không tự tạo công việc.
- **Tạo công việc bằng AI**: mô tả nhu cầu bằng ngôn ngữ tự nhiên (ví dụ "Tạo 3 công việc để chuẩn bị demo tuần sau"), AI phân tích thành danh sách công việc cụ thể để bạn xác nhận trước khi tạo.

> Cần biến môi trường `ANTHROPIC_API_KEY` ở phía máy chủ. Nếu chưa cấu hình, các nút trên vẫn hiển thị nhưng khi bấm sẽ báo lỗi rõ ràng thay vì tạo dữ liệu sai.

## 16. Thông báo Telegram

Vào **Cài đặt** (bấm avatar ở góc phải trên → Cài đặt) để liên kết tài khoản Telegram cá nhân — đây là cài đặt theo từng người dùng, dùng chung cho mọi tổ chức bạn tham gia, không phải cài đặt riêng theo tổ chức.

1. Bấm **Kết nối Telegram**, hệ thống tạo một liên kết `t.me/...` có hiệu lực 10 phút.
2. Mở liên kết đó trên Telegram, bấm **Start** để hoàn tất liên kết.
3. Sau khi liên kết, bạn sẽ nhận được:
   - Thông báo ngay khi được giao một công việc.
   - Nhắc nhở hằng ngày lúc 8:00 sáng (giờ Việt Nam) cho các công việc đến hạn trong ngày.
   - **Nhắc cập nhật trạng thái công việc hàng ngày**: một tin nhắn tổng hợp mọi công việc bạn đang được giao mà chưa Hoàn thành, gửi vào giờ bạn tự chọn (mặc định 17:00, bật sẵn khi vừa liên kết). Bấm ô **Nhắc việc mỗi ngày** ngay dưới nút Ngắt kết nối để tắt/bật, và chọn lại giờ gửi ở ô **Gửi lúc**.

Có thể **Ngắt kết nối** bất cứ lúc nào từ cùng trang Cài đặt.

> Cần biến môi trường `TELEGRAM_BOT_TOKEN` (và `TELEGRAM_WEBHOOK_SECRET`, `API_PUBLIC_URL` truy cập công khai qua HTTPS) ở phía máy chủ. Nếu chưa cấu hình, nút Kết nối sẽ báo lỗi rõ ràng thay vì treo hoặc gửi thông báo thất bại âm thầm.

## 17. Giao diện: sáng/tối, song ngữ, di động

- **Chủ đề sáng/tối**: bấm biểu tượng mặt trăng/mặt trời ở thanh trên cùng, lựa chọn được lưu lại cho lần sau.
- **Ngôn ngữ**: chọn Tiếng Việt / English ở góc phải thanh trên cùng, lưu qua cookie nên giữ nguyên khi điều hướng.
- **Di động**: giao diện responsive — menu bên trái chuyển thành drawer trượt ra khi màn hình hẹp.
- **Thu gọn menu trái**: bấm nút mũi tên ở đầu menu bên trái (trang tổ chức, màn hình rộng) để thu menu chỉ còn icon, có thêm khoảng trống cho nội dung chính. Lựa chọn được ghi nhớ trên trình duyệt và giữ nguyên ở lần truy cập sau.

## 18. Nhân vật đồng hành

Ở góc dưới bên trái mọi trang (khi đã đăng nhập), một nhân vật nhỏ theo dõi con trỏ chuột của bạn và phản ứng khi bạn bấm vào ("boop"). Vào **Cài đặt** để chọn nhân vật mình thích trong số 52 nhân vật có sẵn — lựa chọn được lưu theo tài khoản và hiển thị trên mọi trang, mọi tổ chức bạn tham gia. Nhân vật tự ẩn trên màn hình hẹp (điện thoại) và tự tắt hiệu ứng theo dõi con trỏ nếu thiết bị không có chuột, hoặc tắt hiệu ứng chuyển động nếu hệ điều hành đang bật chế độ giảm chuyển động (reduced motion).

**Mỗi nhân vật chỉ thuộc về một người trong cùng tổ chức**: nếu một thành viên khác trong bất kỳ tổ chức nào bạn tham gia đã chọn nhân vật đó, hệ thống báo lỗi và giữ nguyên lựa chọn cũ của bạn — chọn nhân vật khác chưa ai dùng. Quy tắc này áp dụng theo từng tổ chức (không phải toàn hệ thống), nên nhân vật vẫn có thể trùng giữa hai người ở hai tổ chức khác nhau không liên quan.
