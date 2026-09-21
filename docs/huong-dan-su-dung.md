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
19. [Mốc quan trọng (Milestone)](#19-mốc-quan-trọng-milestone)
20. [Giao phẩm (Deliverable)](#20-giao-phẩm-deliverable)
21. [Phạm vi, WBS và từ điển WBS (PMBOK)](#21-phạm-vi-wbs-và-từ-điển-wbs-pmbok)

---

## 1. Bắt đầu: đăng ký và tạo tổ chức

1. Vào trang chủ, chọn **Đăng ký**, nhập họ tên / email / mật khẩu.
2. Sau khi đăng ký, hệ thống chuyển thẳng đến màn hình **Tạo tổ chức của bạn** — mỗi tổ chức là một không gian làm việc riêng cho công ty/nhóm bạn, đại diện bởi một **slug** (định danh trong URL, ví dụ `cong-ty-abc`).
3. Sau khi tạo tổ chức, bạn vào thẳng **Dashboard** của tổ chức đó với vai trò **Owner**.

Đăng nhập lần sau tại trang **Đăng nhập**; phiên đăng nhập dùng access token (15 phút) tự làm mới qua refresh token (cookie httpOnly, 30 ngày) — không cần đăng nhập lại thường xuyên.

**Bắt đầu nhanh.** Trên Dashboard của một tổ chức mới có thẻ **Bắt đầu nhanh** liệt kê 5 bước đầu tiên — tạo dự án, thêm ít nhất 5 công việc, mời một đồng đội, xác định phạm vi/WBS, tạo giao phẩm đầu tiên. Bước nào xong sẽ tự được tích (tính từ dữ liệu thật, không phải tự đánh dấu); bước kế tiếp có nút **Làm tiếp**. Bấm **Ẩn** để tắt (nhớ theo từng tổ chức trên trình duyệt), và thẻ tự biến mất khi xong cả 5 bước.

**Dự án mẫu.** Khi **Tạo dự án** bạn có thể chọn **Bắt đầu từ**: *Dự án trống* hoặc một mẫu — *Dự án phần mềm*, *Tổ chức sự kiện*, *Chiến dịch marketing*. Mẫu tạo sẵn (bằng ngôn ngữ đang dùng): bản nháp **Phạm vi**, cây **WBS** đủ 4 cấp với **từ điển WBS**, các **hoạt động** xếp lịch nối tiếp theo ngày làm việc (bỏ thứ Bảy/Chủ nhật) từ ngày bắt đầu, một **mốc** ở cuối mỗi giai đoạn, **giao phẩm** kèm tiêu chí nghiệm thu, và vài **rủi ro** thường gặp. Toàn bộ chỉ là điểm khởi đầu — sửa, xoá hay thêm tuỳ ý; dự án mới từ mẫu không có cảnh báo nào ở Kiểm tra độ phủ.

Mời thêm thành viên vào tổ chức được thực hiện ở trang **Cài đặt tổ chức** — xem [mục 3](#3-quản-lý-tổ-chức).

**Đăng nhập bằng Google.** Khi quản trị hệ thống đã cấu hình, trang **Đăng nhập** và **Đăng ký** có nút **Tiếp tục với Google**. Bấm nút, chọn tài khoản Google — lần đầu PMTool tự tạo tài khoản (tên và ảnh lấy từ Google, email được coi là đã xác minh, không cần đặt mật khẩu), các lần sau vào thẳng. Nếu email Google trùng với một tài khoản đã đăng ký bằng mật khẩu, hai cách đăng nhập dùng chung **một tài khoản** (không tạo bản trùng, mật khẩu cũ vẫn dùng được). Mở link mời rồi đăng nhập bằng Google sẽ quay lại đúng lời mời. Tài khoản chỉ dùng Google chưa có mật khẩu: muốn đặt, dùng **Quên mật khẩu**; khi **xoá tài khoản/tổ chức** bạn xác nhận bằng cách gõ lại email của mình thay vì mật khẩu.

**Xác minh email.** Sau khi đăng ký, PMTool gửi một email chứa liên kết xác minh (hiệu lực 24 giờ). Trong lúc chưa xác minh bạn thấy một dải nhắc ở đầu trang kèm nút **Gửi lại email**. Khi quản trị hệ thống bật yêu cầu xác minh, tài khoản chưa xác minh sẽ chưa dùng được **trợ lý AI** và **mời thành viên** (hai tính năng dễ bị lạm dụng); mọi thứ khác vẫn dùng bình thường.

**Quên mật khẩu.** Ở trang **Đăng nhập** bấm **Quên mật khẩu?**, nhập email. Hệ thống luôn trả lời giống nhau dù email có tài khoản hay không (để không lộ ai đã đăng ký) và, nếu có, gửi liên kết đặt lại có hiệu lực **60 phút, dùng được một lần**; yêu cầu mới sẽ vô hiệu liên kết cũ. Đặt mật khẩu mới xong, **mọi phiên đăng nhập cũ bị đăng xuất** và email của bạn được coi là đã xác minh.

**Giới hạn để chống lạm dụng.** Đăng nhập sai quá 10 lần trong 15 phút (cùng email + cùng địa chỉ mạng) sẽ bị tạm khoá vài phút; đăng ký, tạo tổ chức, quên mật khẩu, dùng AI cũng có giới hạn tốc độ. Mỗi tài khoản sở hữu tối đa 5 tổ chức, và mỗi tổ chức có hạn mức lượt dùng AI mỗi ngày (mặc định 100, làm mới lúc 00:00 giờ Việt Nam).

## 2. Vai trò & phân quyền

Mỗi thành viên trong một tổ chức có đúng một trong 5 vai trò (RBAC), theo thứ tự quyền giảm dần:

| Vai trò | Mô tả |
|---|---|
| **Owner** | Toàn quyền, người tạo tổ chức mặc định là Owner |
| **Admin** | Toàn quyền quản trị, trừ một số thao tác chỉ Owner mới làm được |
| **PM** (Project Manager) | Quản lý dự án: tạo/sửa dự án, công việc, rủi ro |
| **Member** | Thành viên thực thi: cập nhật công việc được giao, bình luận |
| **Viewer** | Chỉ xem, không chỉnh sửa |

Phân quyền được kiểm tra ở tầng API cho mọi thao tác ghi dữ liệu — ví dụ Member không thể tạo dự án mới, chỉ PM trở lên mới làm được. Giao diện cũng **ẩn hoặc vô hiệu hoá** các nút bạn không có quyền dùng; người chỉ có quyền xem thấy thông báo "Bạn chỉ có quyền xem trong dự án này".

**Bảng quyền chi tiết** (✓ = được, ✗ = không):

| Hành động | Owner | Admin | PM | Member | Viewer |
|---|:-:|:-:|:-:|:-:|:-:|
| Xem dự án, công việc, phạm vi, hoạt động, danh sách thành viên | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tạo/sửa/xoá công việc, bình luận, phụ thuộc, cột Kanban | ✓ | ✓ | ✓ | ✓ | ✗ |
| Rủi ro/vấn đề, tài liệu, artifact | ✓ | ✓ | ✓ | ✓ | ✗ |
| Tạo/sửa/nộp giao phẩm, viết từ điển WBS, dùng trợ lý AI | ✓ | ✓ | ✓ | ✓ | ✗ |
| Sửa điều lệ, sửa phạm vi, quản lý bên liên quan | ✓ | ✓ | ✓ | ✗ | ✗ |
| Nghiệm thu, từ chối hoặc **xoá** giao phẩm | ✓ | ✓ | ✓ | ✗ | ✗ |
| Tạo và sửa dự án | ✓ | ✓ | ✓ | ✗ | ✗ |
| **Phê duyệt** điều lệ và phạm vi | ✓ | ✓ | ✗ | ✗ | ✗ |
| Mời, đổi vai trò (trừ Owner), xoá thành viên; đổi tên tổ chức; xuất dữ liệu tổ chức | ✓ | ✓ | ✗ | ✗ | ✗ |
| Lưu trữ / khôi phục / **xoá** tổ chức; cấp hoặc thu hồi vai trò Owner | ✓ | ✗ | ✗ | ✗ | ✗ |

Lưu ý: **Admin không thể hạ vai trò hoặc xoá Owner**; chỉ Owner mới làm được. Người chưa vào tổ chức không truy cập được bất cứ thứ gì của tổ chức. Bạn chỉ có thể chọn người **trong tổ chức** làm người phụ trách, người hỗ trợ, chủ giao phẩm, chủ rủi ro hay quản lý dự án.

**Vai trò riêng theo từng dự án:** vai trò ở trên là vai trò *mặc định trong toàn tổ chức*, áp dụng cho mọi dự án trừ khi dự án đó gán riêng cho bạn một vai trò khác — xem [mục 5](#5-quản-lý-dự-án) để biết cách gán và ý nghĩa của vai trò riêng này.

## 3. Quản lý Tổ chức

Vào menu bên trái, chọn **Cài đặt tổ chức** (chỉ Owner/Admin thao tác được các mục dưới đây, nhưng ai cũng xem được trang này — thao tác không đủ quyền sẽ báo lỗi rõ ràng thay vì bị ẩn).

- **Thông tin chung**: sửa **Tên tổ chức**, bấm **Lưu**. Nút **Lưu trữ tổ chức** (chỉ Owner) đưa tổ chức vào trạng thái lưu trữ: tổ chức biến mất khỏi danh sách chuyển đổi tổ chức, không tạo được dự án mới hay mời thêm thành viên mới — các thao tác khác (sửa dự án, xoá thành viên, ...) vẫn hoạt động bình thường. Bấm **Bỏ lưu trữ** bất cứ lúc nào để khôi phục lại như cũ.
- **Thành viên**: bảng liệt kê toàn bộ thành viên, đổi vai trò trực tiếp qua ô chọn hoặc **Xoá** khỏi tổ chức. Tổ chức luôn phải còn ít nhất một Owner — hệ thống chặn việc hạ vai trò hoặc xoá Owner cuối cùng.
- **Chuyển quyền Owner**: chỉ Owner mới đổi được vai trò của một thành viên sang **Owner** (đồng sở hữu) hoặc thay đổi/xoá một Owner; Admin thì không. Cần làm việc này trước khi người Owner duy nhất rời tổ chức hoặc xoá tài khoản.
- **Xoá tổ chức** (chỉ Owner): trong thẻ dữ liệu ở cuối trang Cài đặt tổ chức; phải gõ lại slug và nhập mật khẩu; xoá vĩnh viễn toàn bộ dự án và dữ liệu bên trong, không hoàn tác được.
- **Xuất dữ liệu tổ chức** (Owner/Admin): thẻ **Xuất dữ liệu tổ chức** ở cuối trang Cài đặt tổ chức tải toàn bộ dự án, công việc, bình luận, rủi ro, điều lệ, phạm vi, giao phẩm… thành một tệp JSON.
- **Mời thành viên**: nhập **Email** và chọn **Vai trò**, bấm **Gửi lời mời**. PMTool **gửi email mời** tới người được mời (khi hệ thống đã cấu hình gửi email) và luôn hiển thị **liên kết chấp nhận lời mời** để bạn sao chép, gửi thủ công qua kênh khác nếu cần (Slack, Zalo, ...) — liên kết có hiệu lực 7 ngày. Người nhận đăng nhập/đăng ký tài khoản rồi mở liên kết đó để tham gia tổ chức — nếu họ chưa đăng nhập, hệ thống tự đưa họ quay lại đúng liên kết mời sau khi đăng nhập/đăng ký xong, không cần mở lại link.
  - Mời một email **đã là thành viên** sẽ báo lỗi rõ ràng thay vì tạo lời mời trùng — hãy đổi vai trò trực tiếp trong bảng Thành viên ở trên.
  - Mời lại **cùng một email** đang có lời mời chờ sẽ thay thế lời mời cũ (coi như gửi lại/đổi vai trò lời mời), không tạo thêm bản sao.
  - Bấm **Huỷ** trên một lời mời đang chờ để thu hồi — liên kết cũ ngay lập tức không dùng được nữa.

## 4. Dự án và công việc (WBS)

- Từ menu bên trái, chọn **Dự án** để xem danh sách, bấm **Tạo dự án** — nhập **Tên dự án** và **Mã dự án** (chữ hoa + số, ví dụ `WEB`, dùng làm tiền tố cho mã công việc như `WEB-1`, `WEB-2`, ...).
- Mỗi dự án có 12 tab: **Tổng quan** (dashboard), **Công việc** (danh sách WBS), **Bảng** (Kanban), **Tiến độ** (Gantt), **Mốc quan trọng**, **Giao phẩm**, **Rủi ro/Vấn đề**, **Điều lệ**, **Các bên liên quan**, **Tài liệu**, **Artifact**, **Cài đặt**.
- Trong tab **Công việc**, bấm **Thêm công việc** để tạo việc mới với tiêu đề, mô tả, độ ưu tiên (Thấp/Trung bình/Cao/Khẩn cấp), ngày bắt đầu/kết thúc, người phụ trách.
- Mở một công việc để xem chi tiết: có thể **thêm công việc con** (phân cấp cha/con không giới hạn độ sâu — đây là cấu trúc WBS thật sự), thêm **phụ thuộc** (predecessor/successor — hệ thống tự chặn vòng lặp phụ thuộc), gán **người phụ trách** (đúng 1 người chịu trách nhiệm) cùng các **người hỗ trợ** (không giới hạn số lượng), và **bình luận** trao đổi ngay trên công việc.
- Trạng thái công việc: Cần làm → Đang làm → Đang xem xét → Hoàn thành, hoặc Bị chặn.
- **Danh sách công việc**: ô tìm kiếm (không phân biệt dấu — gõ "thiet ke" vẫn ra "Thiết kế"), lọc theo trạng thái / người (gồm **Của tôi**, **Chưa giao**) và **Ẩn việc đã xong**; khi đang lọc, công việc cha của kết quả vẫn hiện để giữ ngữ cảnh. Mỗi dòng cho thấy người phụ trách (+ số người hỗ trợ), hạn (đỏ **Trễ** nếu quá hạn, vàng khi hôm nay/sắp đến), tiến độ %, số công việc con đã xong, và **ô chọn trạng thái ngay trên dòng**. Có thể **sắp xếp** (hạn gần nhất, độ ưu tiên) và **nhóm theo trạng thái**. Nút **+** thêm công việc con luôn hiện; trạng thái thu/mở các nhánh được nhớ theo từng dự án (có **Mở tất cả / Thu gọn tất cả**).
- **Chi tiết công việc**: bấm vào tiêu đề để sửa tại chỗ (Enter lưu, Esc huỷ); có ô **Bắt đầu** và **Đến hạn** (ngày bắt đầu không được sau ngày đến hạn); mọi thay đổi tự lưu và hiện "Đã lưu". Trên điện thoại, khối thuộc tính (trạng thái, người phụ trách...) nằm ngay đầu trang. Bình luận hiển thị thời gian tương đối ("3 phút trước", rê chuột để xem giờ đầy đủ) và gửi nhanh bằng **Ctrl+Enter**. Nút **Xoá công việc** nằm cuối trang và luôn hỏi xác nhận. Nút **‹ ›** ở góc trên (hoặc phím **k** / **j**) chuyển sang công việc trước/sau theo thứ tự trong danh sách. Khối **Lịch sử thay đổi** ở cuối liệt kê ai đã sửa gì, từ giá trị nào sang giá trị nào (trạng thái, độ ưu tiên, ngày, % hoàn thành, người phụ trách/hỗ trợ, tiêu đề, mô tả) — lần lưu không thay đổi gì sẽ không tạo dòng lịch sử.

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
- **Người phụ trách và người hỗ trợ**: mỗi công việc có tối đa 1 người phụ trách — người chịu trách nhiệm chính; những người còn lại là người hỗ trợ. Chọn/đổi ở khối "Người phụ trách" và "Người hỗ trợ" trong trang chi tiết công việc (đổi người phụ trách thì người cũ được gỡ khỏi công việc, thêm lại ở mục hỗ trợ nếu vẫn cần). Nhiệm vụ ngày/tuần và các nhắc việc Telegram chỉ tính cho **người phụ trách**; người hỗ trợ không bị tính trách nhiệm. Công việc cũ có nhiều người được giao đã được chuyển tự động: người được giao sớm nhất thành người phụ trách, những người còn lại thành người hỗ trợ.
- Bảng bên trái chỉ giữ hai cột **Công việc** và **Người phụ trách** — cố tình gọn để nhường chỗ cho biểu đồ; Trạng thái/Độ ưu tiên/Ngày đã có sẵn ngay trên chính thanh công việc (màu sắc, vị trí, độ dài) nên không lặp lại thành cột riêng. Trên màn hình hẹp, bảng tự thu gọn chỉ còn cột tên.
- Cột **Người phụ trách** hiển thị icon nhân vật đồng hành thay vì tên đầy đủ: người phụ trách là icon lớn có viền vàng, người hỗ trợ là icon nhỏ mờ hơn (tối đa 2 icon, thêm "+N" nếu nhiều hơn) — di chuột vào icon để xem tên và vai trò. Các icon nhân vật trên biểu đồ luôn **nhìn theo con trỏ chuột** (trên thiết bị cảm ứng không có con trỏ thì nhìn thẳng). Cách này nhận diện đúng từng người vì mỗi thành viên trong một tổ chức bắt buộc chọn một nhân vật khác nhau (xem mục 18).

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
- **Tổng quan dự án** (tab đầu tiên trong một dự án): tỉ lệ hoàn thành, số công việc/rủi ro/vấn đề đang mở của riêng dự án đó, danh sách công việc quá hạn, và **Sơ đồ liên kết PMBOK** (xem mục 21).

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
| Xong việc hôm nay | Hoàn thành mọi công việc bạn là người phụ trách có hạn chót hôm nay | +15 |
| Xong việc tuần này | Hoàn thành mọi công việc bạn là người phụ trách có hạn chót trong tuần này | +30 |
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
   - Thông báo ngay khi được giao làm **người phụ trách** một công việc.
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

**Mỗi nhân vật chỉ thuộc về một người trong cùng tổ chức**: nhân vật của bạn có nhãn **✓ Đang dùng**; nhân vật đã có thành viên khác trong bất kỳ tổ chức nào bạn tham gia chọn thì bị làm mờ, không bấm được và ghi **Đã có người chọn** (rê chuột để xem ai đã chọn) — chọn một nhân vật chưa ai dùng. Nếu người khác vừa chọn trước bạn, hệ thống vẫn báo lỗi và giữ nguyên lựa chọn cũ. Quy tắc này áp dụng theo từng tổ chức (không phải toàn hệ thống), nên nhân vật vẫn có thể trùng giữa hai người ở hai tổ chức khác nhau không liên quan.

## 19. Mốc quan trọng (Milestone)

Tab **Mốc quan trọng** liệt kê các cột mốc của dự án theo ngày đến hạn.

- **Mốc thực chất là một công việc được đánh dấu "Là mốc quan trọng"** — nên mở mốc ra là trang chi tiết công việc quen thuộc: có người phụ trách/hỗ trợ, phụ thuộc, bình luận, và xuất hiện trên biểu đồ Tiến độ dưới dạng hình thoi. Mốc không có thời lượng: ngày bắt đầu luôn trùng ngày đến hạn (đổi ngày đến hạn thì ngày bắt đầu đi theo).
- Bấm **Thêm mốc**, nhập tên và ngày đến hạn (bắt buộc), có thể chọn người phụ trách. Cũng có thể biến một công việc có sẵn thành mốc bằng ô **Là mốc quan trọng** ở trang chi tiết công việc (cần đã có ngày đến hạn).
- Mỗi mốc hiển thị: ngày đến hạn, người phụ trách, trạng thái, nhãn **Trễ hạn** nếu quá hạn mà chưa hoàn thành, và tiến độ **giao phẩm đã nghiệm thu / tổng** gắn với mốc. Nút **+ Giao phẩm** thêm nhanh một giao phẩm đã gắn sẵn vào mốc đó.

## 20. Giao phẩm (Deliverable)

Tab **Giao phẩm** theo dõi các sản phẩm bàn giao của dự án và việc nghiệm thu chúng.

- Mỗi giao phẩm có: **tên**, **tiêu chí nghiệm thu**, công việc/mốc liên quan (tuỳ chọn, phải thuộc cùng dự án), người phụ trách, hạn giao, đường dẫn tới sản phẩm thật, mô tả.
- **Vòng đời**: Kế hoạch → Đang làm → **Đã nộp** → **Đã nghiệm thu** hoặc **Bị từ chối**. Thành viên (Member trở lên) tạo, sửa và bấm **Nộp**. Chỉ **PM/Admin/Owner** được **Nghiệm thu**, **Từ chối** hoặc **Xoá** (xoá làm mất dấu vết nghiệm thu) — từ chối bắt buộc nhập lý do, hiển thị ngay dưới tên giao phẩm. Bị từ chối thì làm lại rồi **Nộp** lại.
- Hệ thống lưu ai nghiệm thu và khi nào. **Sửa nội dung** (tên, mô tả, tiêu chí, đường dẫn) của giao phẩm đã nộp/nghiệm thu/từ chối sẽ rút lại việc nộp và nghiệm thu, giao phẩm quay về "Đang làm" — vì bản nghiệm thu cũ không còn đúng với nội dung mới (giống cách Điều lệ dự án hoạt động). Đổi người phụ trách, hạn hay công việc liên quan thì không ảnh hưởng.
- Mọi thay đổi được ghi vào dòng hoạt động của tổ chức.

## 21. Phạm vi, WBS và từ điển WBS (PMBOK)

PMTool áp dụng chuỗi quản lý phạm vi của PMBOK. Mỗi khái niệm có một chỗ riêng và liên kết với nhau:

| Khái niệm PMBOK | Ý nghĩa | Ở đâu trong PMTool |
|---|---|---|
| Điều lệ dự án | Cho phép dự án tồn tại, mục tiêu cấp cao | Tab **Điều lệ** |
| **Phạm vi dự án** (Scope Statement) | Trong/ngoài phạm vi, giao phẩm chính, tiêu chí nghiệm thu, giả định, ràng buộc | Tab **Phạm vi** |
| **WBS** | Phân rã phạm vi theo giao phẩm: Giai đoạn › Giao phẩm › Gói công việc › Hoạt động | Tab **WBS** (và mỗi công việc có **Cấp WBS**) |
| **Từ điển WBS** | Mô tả chi tiết từng phần tử: phạm vi, tiêu chí nghiệm thu, giả định, ràng buộc, nguồn lực, chất lượng, chi phí | Bảng bên phải tab **WBS**, và trang chi tiết của Giao phẩm/Gói công việc |
| **Hoạt động** (Activity) | Công việc cụ thể, xếp lịch được, thuộc một gói công việc | Công việc cấp *Hoạt động*; phụ thuộc, người phụ trách, Tiến độ dùng như cũ |
| Mốc | Cột mốc không thời lượng | Công việc đánh dấu "Là mốc" (mục 19) |

**Cấp WBS và quy tắc thứ bậc.** Mỗi công việc có một cấp: *Giai đoạn > Giao phẩm > Gói công việc > Hoạt động*. Mục con phải ở cấp thấp hơn mục cha; hoạt động là mức thấp nhất. Thêm công việc con vào một hoạt động sẽ tự nâng hoạt động đó lên thành gói công việc, nên các thao tác cũ vẫn dùng bình thường. Đổi cấp không hợp lệ (ví dụ đưa gói công việc lên cao hơn cha của nó) bị từ chối kèm giải thích. Công việc có sẵn được xếp cấp tự động: công việc gốc có con là Giai đoạn, còn lại là Hoạt động — hãy chỉnh lại cho đúng cấu trúc thực tế.

**Mã WBS** (1, 1.2, 1.2.3…) tự sinh theo thứ tự anh em, không lưu nên luôn đúng sau khi kéo thả sắp xếp lại.

**Tab Phạm vi.** Giống Điều lệ: PM trở lên soạn/sửa, còn **Phê duyệt phạm vi** chỉ Owner/Admin (người soạn và người duyệt tách nhau); sửa một bản đã duyệt sẽ đưa về Bản nháp (vì chữ ký cũ không còn đúng nội dung mới).

**Sắp xếp bằng kéo thả** (tab WBS và danh sách Công việc, Member trở lên): kéo một dòng rồi thả vào **mép trên** hoặc **mép dưới** của dòng khác để đặt ngay cạnh nó, thả vào **giữa** để đưa nó vào trong dòng đó (thành công việc con). Đường kẻ hoặc khung sáng cho biết sẽ rơi ở đâu; vị trí không hợp lệ (vào chính nó hay con cháu của nó, hoặc làm sai thứ bậc Giai đoạn › Giao phẩm › Gói › Hoạt động) không nhận thả. Thả vào một *hoạt động* thì hoạt động đó thành gói công việc, như khi thêm việc con. Mã WBS tự đánh lại theo thứ tự mới, và thứ tự này cũng là thứ tự ở Gantt và danh sách. Ai không dùng chuột có thể dùng nút **↑ ↓** (và **← →** ở tab WBS để đưa ra ngoài / vào trong mục phía trên) hiện khi rê hoặc focus vào dòng. Ở danh sách Công việc, kéo thả chỉ bật khi **không lọc/tìm kiếm** và đang ở thứ tự **Mặc định** (khi đang lọc hoặc sắp theo hạn, thứ tự chỉ là một phần nên không cho kéo).

**Đổi cấp WBS hàng loạt** (tab WBS, Member trở lên) — để đưa dữ liệu cũ về đúng cấu trúc:
- **Gán cấp theo độ sâu**: gốc = Giai đoạn, cấp 2 = Giao phẩm, cấp 3 = Gói công việc, mục cuối mỗi nhánh = Hoạt động. Hộp thoại **xem trước** số lượng ở từng cấp rồi mới áp dụng; nhánh sâu quá 4 cấp được báo lỗi thay vì đoán. Không đụng tới ngày, người phụ trách, trạng thái.
- **Chọn nhiều**: tick các công việc, chọn cấp rồi **Áp dụng**. Hệ thống kiểm tra cả bộ thay đổi cùng lúc (cha phải cao hơn con) — có lỗi thì **không đổi gì** và nêu rõ mục nào sai vì sao.

**Tab WBS.** Cây có mã WBS và nhãn cấp; nút **+** ở mỗi dòng chỉ cho thêm các cấp hợp lệ bên dưới. Chọn một phần tử để viết/sửa từ điển WBS (thành viên trở lên được sửa).

**Sơ đồ liên kết PMBOK (Tổng quan dự án).** Sơ đồ vẽ từ trái sang phải: Điều lệ → Phạm vi → Giai đoạn → Giao phẩm → Gói công việc → Hoạt động → Mốc. Ô có viền đứt màu cam là chỗ còn thiếu; ô xanh là đã hoàn thành/đã duyệt; thanh nhỏ là % hoàn thành; "✓ 1/2" là số bản ghi nghiệm thu đã duyệt trên tổng. Hoạt động được gộp thành bộ đếm — bấm **N hoạt động** (hoặc **Mở hết**) để bung ra. Bấm vào một ô để mở công việc tương ứng.

**Kiểm tra độ phủ** ngay dưới sơ đồ liệt kê các khoảng trống theo PMBOK, mỗi mục có liên kết tới phần tử cần sửa:
- gói công việc chưa có hoạt động, hoặc chưa có từ điển WBS;
- giao phẩm chưa có tiêu chí nghiệm thu, hoặc chưa có bản ghi nghiệm thu (tab Giao phẩm);
- hoạt động không thuộc gói công việc;
- mốc chưa gắn giao phẩm;
- mục cha chỉ có một mục con (gợi ý kiểm tra "quy tắc 100%": các con phải gộp lại đủ phạm vi của cha, không thừa không thiếu).

## 22. Dữ liệu cá nhân & quyền riêng tư

Trong **Cài đặt → Dữ liệu & quyền riêng tư** bạn có thể:

- **Tải dữ liệu của tôi**: một tệp JSON gồm hồ sơ (không có mật khẩu), các tổ chức bạn tham gia, công việc được giao, bình luận, điểm, huy hiệu, nhiệm vụ và nhật ký hoạt động của bạn.
- **Xoá tài khoản**: nhập mật khẩu để xác nhận. Hệ thống gỡ bạn khỏi mọi tổ chức, xoá dữ liệu cá nhân (điểm, huy hiệu, liên kết Telegram, phiên đăng nhập) và **ẩn danh** hồ sơ (email, tên, ảnh). Nội dung bạn đã viết trong không gian chung (bình luận, công việc) được giữ lại dưới tên **"Người dùng đã xoá"** để dự án của người khác không bị hỏng. Tổ chức chỉ có mình bạn sẽ bị xoá cùng. Nếu bạn là **Owner duy nhất** của một tổ chức còn người khác, hệ thống từ chối và yêu cầu chuyển quyền Owner hoặc xoá thành viên trước. Email cũ có thể đăng ký lại sau đó.

Trang **Điều khoản sử dụng** (`/terms`) và **Chính sách quyền riêng tư** (`/privacy`) công khai, có bản tiếng Việt và tiếng Anh, được liên kết từ trang đăng ký và chân trang chủ.

> **Dành cho người vận hành:** nội dung hai trang này là bản dự thảo tiêu chuẩn cho dịch vụ miễn phí; đặt `NEXT_PUBLIC_OPERATOR_NAME` và `NEXT_PUBLIC_CONTACT_EMAIL` cho web, và **nhờ tư vấn pháp lý rà soát** (đặc biệt phần dữ liệu cá nhân theo Nghị định 13/2023/NĐ-CP, chuyển dữ liệu ra nước ngoài, và điều khoản đồng ý) trước khi mở đăng ký công khai.

## 23. Nhập / xuất công việc bằng CSV

Ở tab **Công việc** có hai nút:

- **Xuất CSV** (mọi vai trò): tải toàn bộ WBS của dự án ra một tệp CSV mở được bằng Excel (UTF-8, tiếng Việt không lỗi). Mỗi dòng là một công việc theo thứ tự mã WBS, gồm mã, mã cha, tên, cấp WBS, trạng thái, độ ưu tiên, ngày, % hoàn thành, giờ ước tính, mốc, người phụ trách/hỗ trợ (email) và mô tả. Văn bản bắt đầu bằng `=`, `+`, `-`, `@` được thêm dấu `'` phía trước để Excel không chạy nó như công thức.
- **Nhập CSV** (Member trở lên): chọn tệp CSV — xuất từ PMTool hoặc tự soạn trong Excel/Google Sheets (dấu phẩy hoặc chấm phẩy đều được). Hệ thống **kiểm tra toàn bộ trước** và cho xem trước; nếu bất kỳ dòng nào lỗi thì **không tạo gì**, và mỗi lỗi ghi rõ số dòng. Khi hết lỗi bấm **Nhập N công việc**.

Chỉ cột `title` là bắt buộc. Các cột khác (tên cột tiếng Việt hoặc tiếng Anh đều nhận): `ref` (mã tuỳ ý của dòng, để dòng khác trỏ tới), `parent` (`ref` của dòng cha trong tệp, hoặc mã công việc có sẵn như `PRJ-12`), `type` (Giai đoạn/Giao phẩm/Gói công việc/Hoạt động), `status`, `priority`, `start`/`due` (`yyyy-mm-dd` hoặc `dd/mm/yyyy`), `percent`, `estimate_hours`, `milestone`, `assignee` và `supporters` (email thành viên của tổ chức, nhiều người ngăn bằng `;`), `description`. Cha có thể nằm sau con trong tệp; quy tắc cấp WBS vẫn được áp dụng (một hoạt động nhận con sẽ thành gói công việc). Tối đa 2000 dòng / 1 MB mỗi lần; nhập không tính điểm thưởng và không gửi thông báo Telegram. Bạn có thể **Tải tệp mẫu** ngay trong hộp thoại nhập.

## 24. Thông báo trong ứng dụng và "Việc của tôi"

**Chuông thông báo** ở thanh trên cùng (mọi trang của tổ chức) hiện số thông báo chưa đọc (cập nhật mỗi phút và khi bạn quay lại tab). Bạn được báo khi:

- được **giao việc** (người phụ trách hoặc người hỗ trợ — chỉ khi bạn mới được thêm vào, không báo lại khi sửa việc khác);
- có **bình luận** trong việc bạn phụ trách/hỗ trợ hoặc do bạn tạo (người viết không tự nhận thông báo);
- một giao phẩm được **nộp chờ nghiệm thu** (gửi tới PM/Admin/Owner), hoặc được **nghiệm thu / từ chối** (gửi tới người phụ trách và người tạo giao phẩm, kèm lý do từ chối).

Bấm một thông báo để mở đúng công việc/giao phẩm và tự đánh dấu đã đọc; **Đánh dấu đã đọc hết** ở đầu danh sách. Mỗi người chỉ thấy thông báo của chính mình. Thông báo Telegram (nếu đã liên kết) vẫn hoạt động song song.

**Việc của tôi** (menu trái): mọi việc bạn phụ trách hoặc hỗ trợ, **xuyên mọi dự án** của tổ chức, gom theo hạn: *Trễ hạn*, *Hôm nay*, *7 ngày tới*, *Sau đó*, *Chưa có hạn*; mỗi dòng cho biết dự án, vai trò (Phụ trách/Hỗ trợ), trạng thái, % hoàn thành. Mặc định ẩn việc đã xong (có ô bật lên).

## 25. Làm việc theo sprint (Scrum)

Sprint là một lớp lập kế hoạch đặt **lên trên chính các công việc bạn đã có** — không có danh sách công việc thứ hai. Mặc định tắt; bật theo từng dự án.

**Bật:** Cài đặt dự án → thẻ *Sprint* → tick "Làm việc theo sprint" (PM trở lên). Chọn đơn vị ước lượng: **điểm** (story points, tương đối, mặc định) hoặc **giờ** (dùng ước tính giờ sẵn có). Tab **Sprint** xuất hiện.

**Trang Sprint (Backlog):** bên trái là *Backlog* — các việc chưa vào sprint và chưa xong. Bên phải là các sprint đang chạy / kế hoạch, mỗi sprint có mục tiêu, ngày, thanh khối lượng (kế hoạch, đã xong, và vạch tốc độ trung bình các sprint gần nhất; vượt vạch thì cảnh báo "Vượt sức chứa"). **Kéo việc** từ backlog thả vào sprint (hoặc dùng ô chọn sprint trên từng dòng nếu không kéo thả được). Sửa điểm ngay trên dòng.

**Vòng đời:** *Kế hoạch* → **Bắt đầu sprint** (chỉ một sprint chạy tại một thời điểm; hệ thống ghi lại khối lượng cam kết) → **Đóng sprint** (chọn việc chưa xong chuyển sang sprint kế hoạch khác hoặc về backlog; hệ thống ghi khối lượng hoàn thành). Sprint đã đóng không nhận thêm việc và không sửa được; chỉ xoá được sprint còn ở trạng thái Kế hoạch (việc về backlog).

**Bảng (Kanban):** khi có sprint đang chạy, bảng mặc định chỉ hiện việc của sprint đó (bỏ tick để xem tất cả).

**Quyền:** tạo/sửa/bắt đầu/đóng/xoá sprint — Owner, Admin, PM. Gán việc vào sprint và sửa điểm — mọi vai trò được sửa công việc (Member trở lên); Viewer chỉ xem.

Chưa có (sẽ bổ sung): biểu đồ burndown, báo cáo review sprint, cảnh báo phình phạm vi, retrospective, tự lặp sprint.
