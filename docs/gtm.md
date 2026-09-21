# Kế hoạch Go-To-Market (GTM) — PMTool

Phiên bản 1 · 2026-09-20 · Đầu vào: [hành trình người dùng](hanh-trinh-nguoi-dung.md), [kiến trúc & bảo mật](kien-truc.md), [báo cáo kiểm thử](kiem-thu.md).

> **Cập nhật 2026-09-20 — giai đoạn hiện tại: hoàn thiện sản phẩm và cung cấp MIỄN PHÍ cho thị trường.** Không thu tiền ở giai đoạn này: bỏ hạng mục thanh toán/gói (G3) khỏi cổng sẵn sàng, thay bằng **kiểm soát chi phí** (hạn mức AI, giới hạn tốc độ, hạn mức lưu trữ) để bản miễn phí không tự phá sản. Mục tiêu đổi từ "doanh thu" sang **kích hoạt, giữ chân và bằng chứng giá trị** — dữ liệu này sẽ quyết định mô hình kiếm tiền sau. Thứ tự làm cụ thể ở [mục 4.0](#40-thứ-tự-thực-hiện-giai-đoạn-miễn-phí).

> **Đọc trước khi dùng.** Kế hoạch này dựa trên **những gì sản phẩm thực sự có** (đã kiểm chứng bằng test) và **các giả thuyết thị trường chưa được kiểm chứng** — chưa có khảo sát khách hàng, dữ liệu giá hay số liệu thị trường trong repo. Mọi con số về giá, mục tiêu và tỉ lệ chuyển đổi dưới đây là **giả thuyết cần hiệu chỉnh bằng dữ liệu từ giai đoạn beta**, không phải dự báo. Những gì cần bạn quyết định nằm ở [mục 10](#10-quyết-định-cần-bạn-chốt).

## 1. Định vị

**Một câu:** *Quản lý dự án chuẩn PMBOK cho đội nhóm Việt — nhanh như công cụ việc-cần-làm, chặt chẽ như một PMO.*

| Trụ cột | Bằng chứng trong sản phẩm | Khác biệt so với công cụ phổ thông |
|---|---|---|
| **Chặt chẽ theo PMBOK** | Điều lệ → Phạm vi → WBS (4 cấp, mã tự sinh) → Từ điển WBS → Hoạt động → Giao phẩm/Mốc; **sơ đồ liên kết + kiểm tra độ phủ** trên dashboard; phê duyệt tách người soạn/người duyệt | Phần lớn công cụ công việc phổ thông không ép cấu trúc phạm vi; công cụ PMO nặng thì đắt và khó dùng |
| **Tiếng Việt là công dân hạng nhất** | Giao diện vi/en, tài liệu tiếng Việt, nhắc hạn theo giờ Việt Nam (8:00 ICT) | Thường chỉ dịch một phần |
| **Đội thực thi thực sự dùng** | Cập nhật nhanh tại danh sách, Telegram, nhiệm vụ ngày/tuần, điểm & nhân vật đồng hành | Giảm bệnh "PM nhập liệu, đội im lặng" |
| **An toàn cho nhiều bên** | Đa tenant, 5 vai trò + vai trò riêng theo dự án, ma trận quyền được test tự động | Có thể mời khách hàng xem mà không lo sửa nhầm |

**Không** định vị là "thay thế mọi thứ": chưa có nhập/xuất dữ liệu, đường găng, EVM, tích hợp lịch/lưu trữ (xem mục 4).

## 2. Khách hàng mục tiêu (giả thuyết — cần xác thực)

| Ưu tiên | Phân khúc | Vì sao hợp | Người mua / người dùng |
|---|---|---|---|
| **A** | Công ty dịch vụ/outsource phần mềm, agency, tư vấn 10–100 người chạy nhiều dự án cho khách | Cần phạm vi rõ, nghiệm thu giao phẩm, báo khách; đã quen PMBOK/Scrum | Giám đốc / PM |
| **A** | Đơn vị đào tạo & cộng đồng **PMP/PMBOK** (học viên cần công cụ thực hành có cấu trúc) | Kênh phân phối + nguồn người dùng có ý định cao | Giảng viên / học viên |
| **B** | Đội dự án nội bộ ở doanh nghiệp vừa (xây dựng, lắp đặt, sự kiện, chuyển đổi số) | Có mốc, giao phẩm, nghiệm thu | Trưởng dự án |
| **C** | Freelancer/nhóm nhỏ | Dễ vào (gói miễn phí) nhưng giá trị thương mại thấp | Cá nhân |

Bắt đầu với **A**: nỗi đau "khách hỏi đã xong chưa/đúng phạm vi chưa" khớp trực tiếp với sơ đồ liên kết + nghiệm thu.

## 3. Bối cảnh cạnh tranh (định tính — cần rà soát trước khi công bố)

| Nhóm | Ví dụ | Họ mạnh | PMTool thắng ở | PMTool thua ở |
|---|---|---|---|---|
| Công cụ công việc toàn cầu | Jira, Asana, ClickUp, Monday, Trello | Hệ sinh thái, tích hợp, độ phổ biến | Cấu trúc PMBOK sẵn có, tiếng Việt, nhắc qua Telegram | Tích hợp, ứng dụng di động, nhập/xuất, thương hiệu |
| Lập lịch chuyên sâu | MS Project, Primavera | Đường găng, tài nguyên, chi phí | Nhẹ, cộng tác web, giá | Chiều sâu lập lịch |
| Nền tảng nội địa/quản trị doanh nghiệp | Các nền tảng quản lý công việc Việt Nam, bộ ứng dụng văn phòng | Tiếng Việt, gần khách, gói tổng hợp | PMBOK rigor, đa tenant sạch, phân quyền | Bề rộng (nhân sự, chat, kho…) |

> **Việc cần làm:** lập bảng so sánh tính năng/giá có nguồn dẫn từ trang chính thức của từng đối thủ trước khi dùng trong tiếp thị (không đưa nhận định chưa kiểm chứng ra công khai).

## 4. Cổng sẵn sàng — phải xong trước khi mở đăng ký công khai

### 4.0 Thứ tự thực hiện (giai đoạn miễn phí)

Miễn phí không có nghĩa là hạ chuẩn: người dùng vẫn giao dữ liệu công việc thật cho bạn, và mỗi tài khoản có chi phí hạ tầng. Thứ tự dưới đây theo nguyên tắc *an toàn và chi phí trước, tăng trưởng sau*:

| Bước | Hạng mục | Lý do ở chế độ miễn phí |
|---|---|---|
| 1 ✅ | **G5 Giới hạn tốc độ + hạn mức AI theo tổ chức** *(xong 2026-09-20)* | Không có doanh thu bù chi phí AI/lạm dụng; chống dò mật khẩu và đăng ký hàng loạt |
| 2 ✅ | **Đăng nhập bằng Google** *(xong 2026-09-21; cần Client ID/Secret thật — xem `apps/api/.env.example`)* · **G1/G2 Quên mật khẩu, xác minh email, email giao dịch** *(xong 2026-09-20; cần cấu hình SMTP thật ở production rồi bật `EMAIL_VERIFICATION_REQUIRED`)* (nhà cung cấp email cắm được; chưa cấu hình thì ghi log) | Không có mật khẩu = mất tài khoản; email chặn tài khoản rác |
| 3 ✅ | **G4 Xuất dữ liệu + xoá tài khoản + trang điều khoản/quyền riêng tư** *(xong 2026-09-20 — còn cần tư vấn pháp lý rà soát nội dung và điền tên đơn vị/email liên hệ; Owner cũng có thể xoá cả tổ chức)* | Bắt buộc pháp lý khi thu dữ liệu cá nhân (Nghị định 13/2023), xây niềm tin để dùng miễn phí |
| 4 ✅ | **G8 Dự án mẫu + checklist kích hoạt** *(xong 2026-09-21: 3 mẫu vi/en — phần mềm, sự kiện, marketing — và thẻ "Bắt đầu nhanh"; nên bổ sung mẫu theo ngành khi có phản hồi beta)* | Rút ngắn thời gian tới "aha" — chỉ số quan trọng nhất khi không có doanh thu |
| 5 ✅ | **G9 Nhập/xuất CSV** *(xong 2026-09-21: nhập/xuất công việc; xuất PDF báo cáo và nhập Excel .xlsx/MS Project chưa có)* | Hạ rào chuyển đổi từ bảng tính; xuất cũng phục vụ G4 |
| 6 ✅ | **G11 Thông báo trong app**, "việc của tôi" xuyên dự án *(xong 2026-09-21; thông báo qua email theo sự kiện chưa làm — hiện email chỉ dùng cho tài khoản/lời mời)* | Giữ chân |
| 7 | ~~G10 Dự án riêng tư~~ ✅, ~~G12~~ ✅ *(đổi cấp WBS hàng loạt xong 2026-09-21)*, ~~G13~~ ✅ *(route AI ràng buộc dự án; quyền xoá công việc giữ nguyên: Member trở lên được xoá, có nhật ký)* | Mở rộng tệp khách |
| Song song | **G6 vận hành production** *(2026-09-21: đã có Dockerfile, compose production + Caddy HTTPS, sao lưu/khôi phục, `health/ready` và runbook `docs/van-hanh.md`; **chưa** kiểm chứng trọn vẹn trên máy chủ thật, chưa có giám sát ngoài và chưa diễn tập khôi phục trên dữ liệu thật)* —  (sao lưu diễn tập, giám sát, HTTPS, migrate an toàn), **G7 rà soát bảo mật**, ~~**phân tích sản phẩm**~~ ✅ *(2026-09-21: báo cáo SQL chỉ-đọc `infra/metrics/metrics.sh`, không cài công cụ theo dõi — xem van-hanh.md §6.1)* | Cần trước khi mở đăng ký công khai |


Rút từ rà soát hành trình và bảo mật. Kích cỡ: **S** ≤ 3 ngày, **M** ≈ 1–2 tuần, **L** > 2 tuần (một kỹ sư, ước lượng thô).

### 4.1 Chặn bán (bắt buộc)

| # | Hạng mục | Vì sao chặn | Cỡ |
|---|---|---|---|
| G1 | **Quên/đặt lại mật khẩu** + **xác minh email** | Mất mật khẩu = mất tài khoản; email giả | M |
| G2 | **Email giao dịch** (mời thành viên, nhắc, chào mừng) qua nhà cung cấp email; lời mời hiện chỉ có liên kết sao chép tay | Giảm đứt gãy J2, cần cho G1 | M |
| ~~G3~~ | ~~Gói dịch vụ + thanh toán~~ — **hoãn** (giai đoạn miễn phí). Thay bằng **hạn mức sử dụng** (số tổ chức/người, AI, lưu trữ) để kiểm soát chi phí | — | (gộp vào G5) |
| G4 | **Điều khoản sử dụng, chính sách quyền riêng tư, xuất/xoá dữ liệu & đóng tài khoản** (tuân thủ Nghị định 13/2023 về dữ liệu cá nhân) | Pháp lý; niềm tin | M (+tư vấn pháp lý) |
| G5 | **Giới hạn tốc độ** cho đăng nhập/đăng ký/AI; khoá tạm khi đoán mật khẩu; **hạn mức AI theo tổ chức/ngày** | Chống lạm dụng, chi phí AI — quan trọng hơn khi miễn phí | S–M |
| G6 | **Triển khai production**: môi trường, HTTPS/tên miền, biến môi trường bí mật, **sao lưu tự động + diễn tập khôi phục**, giám sát lỗi/hiệu năng/uptime, cảnh báo | Chưa có bằng chứng vận hành; **từng mất dữ liệu dev do lệnh migrate** (bài học: không thao tác migrate trên DB thật; cần quy trình migrate production an toàn) | L |
| G7 | **Rà soát bảo mật độc lập** (pentest/checklist OWASP), đặc biệt Artifact HTML tự viết (iframe cách ly) và luồng phiên | Bán cho doanh nghiệp | M |

### 4.2 Cản trở tăng trưởng (nên xong trong beta)

| # | Hạng mục | Tác động | Cỡ |
|---|---|---|---|
| G8 | **Dự án mẫu / mẫu WBS** theo ngành (phần mềm, xây dựng, sự kiện) + checklist kích hoạt | Rút ngắn tới "aha" (J1) | M |
| G9 | **Nhập/xuất** CSV/Excel (công việc, WBS); xuất báo cáo PDF của dashboard/sơ đồ liên kết | Rào cản chuyển đổi; PM cần gửi khách | M |
| G10 | ~~**Dự án riêng tư / khách chỉ thấy dự án của họ**~~ ✅ *(xong 2026-09-21)* | Bán cho công ty dịch vụ có nhiều khách (J9) | M |
| G11 | **Thông báo trong app + email** cho giao việc/bình luận/từ chối giao phẩm; màn "việc của tôi" xuyên dự án | Telegram không đủ (J4) | M |
| G12 | Công cụ **chuyển cấp WBS hàng loạt** cho dữ liệu cũ | Tránh "đầy cảnh báo" khi nhập kế hoạch có sẵn | S |
| G13 | Ràng buộc route AI theo dự án; soát quyền xoá công việc của người khác | Khép các điểm đã biết trong kien-truc.md §5 | S |

### 4.3 Khác biệt hoá thêm (sau GA, theo phản hồi)
Baseline + kiểm soát thay đổi phạm vi; đường găng; yêu cầu + ma trận truy vết; rủi ro ↔ WBS; EVM/chi phí cộng dồn; SSO; tích hợp Google Calendar/Drive; ứng dụng di động.

## 5. Mô hình cung cấp: miễn phí (giai đoạn hiện tại)

**Quyết định:** cung cấp miễn phí cho thị trường trong giai đoạn hoàn thiện sản phẩm. Miễn phí là *chiến lược thu thập bằng chứng*, không phải kết luận về giá.

| Nguyên tắc | Cách thực hiện |
|---|---|
| Miễn phí nhưng **có hạn mức công bằng** để không bị lạm dụng | Giới hạn tốc độ; hạn mức AI/ngày/tổ chức; giới hạn số tổ chức tạo mới mỗi tài khoản; hạn mức số dự án/thành viên đặt rộng, hiển thị công khai |
| **Không khoá dữ liệu** | Xuất dữ liệu (G4/G9) để người dùng yên tâm — giảm rào cản dùng thử |
| **Chi phí biến đổi được theo dõi** | Theo dõi chi phí AI, email, lưu trữ theo tổ chức từ ngày đầu |
| **Không hứa miễn phí mãi mãi** | Điều khoản nêu rõ: có thể giới thiệu gói trả phí sau; tính năng đang dùng có thời gian báo trước hợp lý; dữ liệu luôn xuất được |
| Viewer không tính | Khách hàng xem miễn phí — vòng lan truyền tự nhiên |

**Dữ liệu cần thu trong giai đoạn miễn phí để quyết định kiếm tiền sau** (tôn trọng quyền riêng tư, chỉ đo hành vi tổng hợp): tổ chức nào kích hoạt và ở lại; tính năng nào gắn với giữ chân (PMBOK, Telegram, gamification…); chi phí thực tế/tổ chức; người dùng sẵn lòng trả cho thứ gì (phỏng vấn 10–15 tổ chức hoạt động nhiều nhất). Các phương án kiếm tiền để thử sau: gói Nhóm/Doanh nghiệp theo thành viên, tính năng doanh nghiệp (dự án riêng tư nâng cao, SSO, nhật ký kiểm toán, hỗ trợ ưu tiên), dịch vụ triển khai/đào tạo PMBOK.

**Rủi ro riêng của miễn phí:** chi phí AI và hạ tầng tăng theo người dùng nhưng không có doanh thu; tài khoản rác/lạm dụng; kỳ vọng hỗ trợ "như trả tiền". Xem [mục 11](#11-rủi-ro--giảm-thiểu).

## 6. Lộ trình ra thị trường

```mermaid
gantt
    dateFormat  YYYY-MM-DD
    axisFormat  %d/%m
    section Giai đoạn 0 · Sẵn sàng
    Cổng chặn bán G1,G2,G4,G5     :g0a, 2026-09-28, 28d
    Production + sao lưu + giám sát G6 :g0b, 2026-09-28, 28d
    Dự án mẫu + xuất dữ liệu G4,G8 :g0c, after g0a, 21d
    section Giai đoạn 1 · Beta kín
    Tuyển 8–10 đối tác thiết kế    :g1a, 2026-10-26, 14d
    Beta kín + phỏng vấn hằng tuần :g1b, after g1a, 42d
    Mẫu WBS, nhập/xuất G8,G9       :g1c, 2026-11-09, 35d
    section Giai đoạn 2 · Beta mở
    Beta mở + miễn phí có giới hạn :g2a, 2026-12-21, 42d
    Dự án riêng tư, thông báo G10,G11 :g2b, 2026-12-21, 42d
    section Giai đoạn 3 · GA
    Mở rộng miễn phí + đo chi phí  :g3a, 2027-02-01, 30d
```

> Mốc ngày là **khung tham chiếu** giả định một đội nhỏ toàn thời gian; điều chỉnh theo nguồn lực thực (mục 10).

| Giai đoạn | Mục tiêu | Tiêu chí hoàn thành (cổng qua giai đoạn) |
|---|---|---|
| **0 · Sẵn sàng** (≈4–7 tuần) | Khép các mục chặn bán G1–G7 | Toàn bộ G1–G7 xong; khôi phục sao lưu đã diễn tập; pentest không còn lỗi mức cao |
| **1 · Beta kín** (≈6 tuần) | Học từ 8–10 nhóm thật (ưu tiên phân khúc A) | ≥ 60% nhóm đạt "kích hoạt" (mục 8); ≥ 5 nhóm dùng nghiệm thu giao phẩm; danh sách 10 vấn đề UX hàng đầu đã xử lý |
| **2 · Beta mở** (≈6 tuần) | Kiểm chứng tăng trưởng tự nhiên + kênh | Có kênh thu hút lặp lại được; retention tuần 4 đạt ngưỡng đặt ra từ beta kín; đã thử giá |
| **3 · Mở rộng miễn phí** | Mở rộng kênh, đo giữ chân và chi phí | Chi phí/tổ chức trong ngân sách; quy trình hỗ trợ và sự cố; dữ liệu đủ để chọn mô hình kiếm tiền |

## 7. Kênh & chiến thuật

| Kênh | Chiến thuật | Vì sao |
|---|---|---|
| **Đơn vị đào tạo/cộng đồng PMP** | Gói miễn phí cho lớp học, bộ **mẫu dự án theo chương PMBOK**, webinar "lập WBS + từ điển WBS trên PMTool" | Người dùng có ý định cao, tự lan truyền |
| **Nội dung (SEO/LinkedIn/Facebook group/Zalo)** | Bài thực hành: "WBS đúng chuẩn", "Quy tắc 100%", "Nghiệm thu giao phẩm"; tải mẫu WBS | Tận dụng tài liệu vi sẵn có; thu email |
| **Sản phẩm tự lan truyền** | Viewer miễn phí (khách hàng xem tiến độ), liên kết báo cáo/sơ đồ chia sẻ, bot Telegram | Mỗi dự án kéo thêm người xem |
| **Bán trực tiếp phân khúc A** | Demo 20 phút bằng dự án mẫu; kèm bảng độ phủ của chính kế hoạch khách | Người mua là giám đốc/PM |
| **Đối tác dịch vụ** | Tư vấn/PMO triển khai cho khách, hoa hồng | Mở rộng có kiểm soát |

## 8. Thông điệp theo persona

| Persona | Thông điệp | Bằng chứng để demo |
|---|---|---|
| Chủ/giám đốc | "Biết dự án có đúng phạm vi, đúng hạn và đã được nghiệm thu chưa — trong một màn hình." | Sơ đồ liên kết + độ phủ, giao phẩm đã duyệt |
| PM | "Lập WBS chuẩn PMBOK nhanh hơn bảng tính, và hệ thống chỉ ra chỗ thiếu." | Cảnh báo độ phủ, mã WBS tự sinh |
| Thành viên | "Cập nhật trong 2 chạm, nhắc đúng giờ qua Telegram, không spam." | Đổi trạng thái tại dòng, nhiệm vụ ngày |
| Khách hàng | "Xem tiến độ và nghiệm thu mà không cần học công cụ." | Viewer chỉ đọc |

## 9. Số đo thành công

**Định nghĩa kích hoạt (đề xuất):** trong 7 ngày đầu tổ chức có ≥ 1 dự án, ≥ 5 công việc, ≥ 2 thành viên đã tham gia, và ≥ 1 phần tử WBS có cấp **hoặc** ≥ 1 giao phẩm.

| Nhóm | Chỉ số | Cách đo |
|---|---|---|
| Thu hút | Đăng ký/tuần theo kênh | Tham số UTM khi đăng ký *(cần bổ sung sự kiện phân tích — hiện chưa có)* |
| Kích hoạt | % tổ chức đạt định nghĩa trên | Truy vấn dữ liệu sẵn có |
| Giá trị PMBOK | % dự án có Phạm vi đã duyệt; điểm độ phủ trung bình; số giao phẩm nghiệm thu | Từ bảng `project_scopes`, `scope-map`, `deliverables` |
| Giữ chân | Tổ chức còn hoạt động tuần 4/8; DAU/WAU | Nhật ký hoạt động |
| Chi phí & giá trị | Chi phí/tổ chức hoạt động; tỉ lệ tổ chức hoạt động ≥ 4 tuần; số người sẵn lòng trả (phỏng vấn) | Theo dõi chi phí + phỏng vấn (chưa thu tiền) |
| Chất lượng | Tỉ lệ lỗi 5xx, thời gian phản hồi p95, NPS, số ticket/tổ chức | Giám sát (G6) + khảo sát trong app |

Ngưỡng mục tiêu: **đặt sau beta kín** từ dữ liệu thực; không cam kết số liệu trước đó.

## 10. Quyết định cần bạn chốt

1. **Thị trường đầu tiên:** chỉ Việt Nam, hay song song thị trường nói tiếng Anh? (ảnh hưởng ngôn ngữ, thanh toán, pháp lý)
2. **Nguồn lực & ngân sách:** số kỹ sư/thời gian dành cho giai đoạn 0; có thuê tư vấn pháp lý, pentest, hạ tầng không?
3. **Mô hình kinh doanh:** SaaS đa tenant tự vận hành, hay có gói triển khai riêng/on-prem cho doanh nghiệp?
4. ~~Thanh toán~~ — hoãn theo quyết định miễn phí. Còn lại: **ngân sách chi phí biến đổi tối đa mỗi tháng** (AI, email, hạ tầng) để đặt hạn mức.
5. **Phân khúc ưu tiên:** đồng ý bắt đầu với công ty dịch vụ/outsource + đơn vị đào tạo PMP (A)?
6. **Chính sách AI:** chi phí AI do ai chịu (gói/hạn mức), và dữ liệu khách có được gửi tới nhà cung cấp AI không (cần nêu rõ trong chính sách riêng tư)?

## 11. Rủi ro & giảm thiểu

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Ra mắt khi chưa có quên mật khẩu/sao lưu/hạn mức chi phí → mất niềm tin | Cao | Cổng giai đoạn 0 là điều kiện cứng |
| Mất dữ liệu khách do thao tác migrate/vận hành | Cao | Quy trình migrate production + sao lưu tự động + diễn tập khôi phục; cấm dùng DB thật làm shadow DB |
| Sản phẩm bị coi là "quá nặng PMBOK" với đội nhỏ | Trung bình | Mẫu dự án, chế độ đơn giản (WBS tuỳ chọn), thông điệp "chặt chẽ nhưng nhanh" |
| Đối thủ lớn sao chép cấu trúc PMBOK | Trung bình | Bám tiếng Việt, cộng đồng PMP, độ sâu (baseline, truy vết) |
| Chi phí AI/hạ tầng tăng mà không có doanh thu | **Cao** | Hạn mức AI theo tổ chức, giới hạn tốc độ và số tổ chức (G5), theo dõi chi phí/tổ chức, ngân sách trần hằng tháng |
| Tài khoản rác/lạm dụng khi đăng ký miễn phí | Cao | Xác minh email (G1), giới hạn tốc độ, giới hạn tổ chức/tài khoản |
| Gamification gây "hoàn thành ảo" | Thấp–TB | Theo dõi chỉ số bất thường; cho tổ chức tắt bảng xếp hạng |
| Phụ thuộc một cá nhân (bus factor) | Trung bình | Tài liệu hệ thống (đã có), CI xanh, quy trình phát hành |

## 12. 30 – 60 – 90 ngày

| Mốc | Việc chính |
|---|---|
| **30 ngày** | G1, G2, G5 xong; môi trường production + HTTPS + giám sát cơ bản dựng xong; soạn điều khoản/quyền riêng tư (G4); chốt các quyết định mục 10; bắt đầu tuyển đối tác beta |
| **60 ngày** | Sao lưu/khôi phục diễn tập (G6), pentest (G7); bắt đầu beta kín; mẫu WBS đầu tiên (G8) |
| **90 ngày** | Xong vòng phản hồi beta kín; nhập/xuất (G9); kế hoạch giá dựa dữ liệu; quyết định vào beta mở |
