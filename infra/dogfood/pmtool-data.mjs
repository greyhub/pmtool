// The data of the project that builds PMTool, derived from its own git history (85 commits, 2026-09-14 → 2026-09-21).
// Every completed task carries the time of the commit that finished it; nothing here is invented history — what is planned
// (deployment, backlog) is marked as such. Times are Vietnam time (UTC+7).

/** "09-15 17:16" → Date (2026, Vietnam time). */
export const at = (md, hm = '00:00') => new Date(`2026-${md}T${hm}:00+07:00`);
const T = (s) => {
  const [md, hm] = s.split(' ');
  return at(md, hm);
};

/**
 * An activity. `done` is when the commit landed (null = not done), `sp` story points, `fix` marks unplanned repair work
 * (created after its sprint had started), `status` for work that is not done.
 */
const A = (title, done, sp, o = {}) => ({ t: 'ACTIVITY', title, done: done ? T(done) : null, sp, ...o });
const F = (title, done, sp, o = {}) => A(title, done, sp, { fix: true, ...o });

/**
 * Deliverables with their activities. Each deliverable gets a work package "Phát triển" for planned work and one
 * "Sửa lỗi và hoàn thiện" for the fixes that came up — the WBS follows Phase → Deliverable → Work package → Activity.
 */
const D = (title, criteria, items, o = {}) => ({ t: 'DELIVERABLE', title, criteria, items, ...o });

export const PHASES = [
  {
    title: '1. Nền tảng kỹ thuật',
    deliverables: [
      D('Bộ khung monorepo, xác thực và CI', 'Đăng ký/đăng nhập, đa tenant tách dữ liệu, pipeline CI xanh.', [
        A('Dựng monorepo pnpm + Turborepo, API NestJS, web Next.js', '09-14 21:31', 3),
        A('Nền tảng xác thực và đa tenant (Milestone B)', '09-15 01:13', 8),
        A('Test tích hợp Testcontainers và E2E Playwright (Milestone I)', '09-16 00:54', 5),
        A('Pipeline CI GitHub Actions (lint, typecheck, build, unit → integration → E2E)', '09-16 00:57', 3),
        F('Sửa CI: build shared-types trước khi chạy integration', '09-16 16:12', 1),
        F('Sửa CI: turbo --filter cần tên gói đầy đủ', '09-16 17:22', 1),
        F('Sửa @UsePipes kiểm tra sai tham số', '09-15 12:18', 1),
      ]),
      D('Hệ thiết kế và giao diện nền', 'Token, thành phần, sáng/tối, vi/en, điều hướng dùng được trên di động.', [
        A('Hệ thiết kế: token, thành phần, chủ đề sáng/tối, khung điều hướng (Milestone C)', '09-15 01:34', 8),
        A('Chuyển sang phong cách kính mờ (glass) hiện đại', '09-15 12:38', 3),
        A('Thanh điều hướng di động, sửa tràn giao diện, viết lại README (Milestone J)', '09-16 09:36', 3),
        F('Trang chủ: chuỗi tiếng Việt cứng bỏ qua ngôn ngữ đang chọn', '09-15 08:13', 1),
        F('Đăng nhập luôn chuyển tới tạo tổ chức dù đã có tổ chức', '09-15 12:45', 1),
      ]),
    ],
  },
  {
    title: '2. Quản lý dự án và công việc',
    deliverables: [
      D('Dự án, công việc phân cấp và WBS', 'Tạo dự án, công việc cha/con, mã công việc, chi tiết công việc.', [
        A('Dự án và công việc phân cấp / WBS (Milestone D)', '09-15 17:16', 8),
      ]),
      D('Bảng Kanban', 'Kéo thả giữa các cột, thứ tự được lưu, cột tuỳ chỉnh.', [A('Bảng Kanban kéo thả (Milestone E)', '09-15 18:06', 5)]),
      D('Biểu đồ Gantt', 'Vẽ công việc theo ngày, kéo đổi ngày, phụ thuộc.', [A('Biểu đồ Gantt (Milestone F)', '09-15 21:17', 8)]),
      D('Rủi ro, dashboard và nhật ký hoạt động', 'Sổ rủi ro/vấn đề, dashboard tổ chức và dự án, dòng sự kiện.', [
        A('Sổ rủi ro/vấn đề và dashboard tổ chức/dự án (Milestone G)', '09-15 23:50', 8),
        A('Dòng sự kiện ActivityLog và interceptor ghi nhật ký (Milestone H)', '09-16 00:21', 5),
      ]),
    ],
  },
  {
    title: '3. Cộng tác, PMBOK cơ bản và tích hợp',
    deliverables: [
      D('Gamification và trợ lý AI', 'Điểm, chuỗi ngày, huy hiệu, bảng xếp hạng; AI tóm tắt, gợi ý, tạo việc.', [
        A('Điểm, chuỗi ngày, huy hiệu và bảng xếp hạng (Milestone K)', '09-17 00:42', 5),
        A('AI: tóm tắt, gợi ý việc con, tạo việc từ ngôn ngữ tự nhiên (Milestone L)', '09-17 00:54', 5),
      ]),
      D('Tích hợp Telegram', 'Liên kết tài khoản, thông báo, nhắc hạn hằng ngày.', [
        A('Tích hợp Telegram: liên kết tài khoản, webhook (Milestone M)', '09-17 09:04', 8),
        A('Nhắc hạn công việc hằng ngày qua Telegram', '09-19 01:10', 3),
      ]),
      D('Tài liệu người dùng và kiến trúc', 'Hướng dẫn sử dụng và tài liệu kiến trúc đầy đủ, giới thiệu trên trang chủ.', [
        A('Hướng dẫn sử dụng cho người dùng cuối', '09-17 09:38', 2),
        A('Tài liệu kiến trúc hệ thống', '09-17 09:54', 3),
        A('Trang chủ thành trang giới thiệu sản phẩm', '09-17 13:41', 3),
        A('Liên kết ba tài liệu do Claude tạo ra từ trang chủ', '09-17 15:32', 1),
      ]),
      D('Giấy tờ PMBOK cơ bản và Artifact', 'Điều lệ, sổ bên liên quan, danh mục tài liệu, trang Artifact trong sandbox.', [
        A('Điều lệ dự án, sổ bên liên quan, danh mục tài liệu (giai đoạn 4a)', '09-17 10:55', 8),
        A('Artifact: trang HTML/CSS/JS trong sandbox theo từng dự án', '09-17 15:06', 5),
      ]),
      D('Quản trị tổ chức và dự án', 'CRUD tổ chức/dự án, phân quyền hai lớp, mời thành viên hoạt động đúng.', [
        A('CRUD tổ chức và dự án, phân quyền hai lớp (vai trò tổ chức + dự án)', '09-17 21:04', 8),
        F('Giữ điểm đến khi đăng nhập/đăng ký (lời mời không dùng được)', '09-17 22:47', 2),
        F('Rà soát và sửa quản lý lời mời (xung đột, trùng lặp, không huỷ được)', '09-18 12:20', 3),
      ]),
      D('Trải nghiệm và linh vật', 'Điều hướng Quay lại/Trang chủ, linh vật đồng hành, 52 nhân vật.', [
        A('Nút Quay lại/Trang chủ cho các trang còn thiếu', '09-19 15:29', 1),
        A('Linh vật đồng hành nổi trên mọi trang', '09-19 16:54', 3),
        A('Mở rộng bộ nhân vật từ 12 lên 52', '09-19 17:29', 2),
      ]),
    ],
  },
  {
    title: '4. Khung PMBOK và trải nghiệm công việc',
    deliverables: [
      D('Gantt hoàn thiện', 'Gantt dùng tốt: sửa lỗi, % hoàn thành, nhân vật người phụ trách.', [
        A('Đại tu UX Gantt: sửa 15 lỗi, thêm tính năng thật', '09-20 03:42', 8),
        A('Nhân vật duy nhất theo tổ chức, biểu tượng người phụ trách trên Gantt, thu gọn sidebar', '09-20 05:39', 5),
        A('Ẩn cột bắt đầu/thời lượng/trạng thái/ưu tiên trong lưới Gantt', '09-20 06:03', 1),
        A('Hiện % hoàn thành trên thanh Gantt', '09-20 13:27', 2),
        A('Nhân vật trên Gantt nhìn theo con trỏ chuột', '09-20 14:02', 2),
        A('Tooltip tên tức thì khi rê vào nhân vật', '09-20 14:10', 1),
        F('Giữ dòng cha mở sau khi lưu ngày của việc con', '09-20 13:17', 1),
        F('Làm mờ phần chưa xong của thanh, giữ nguyên phần đã xong', '09-20 13:36', 1),
      ]),
      D('Nhiệm vụ ngày/tuần và người phụ trách chính', 'Nhiệm vụ gamification, % hoàn thành, mỗi việc một người chính.', [
        A('Nhiệm vụ ngày/tuần (gamification) và % hoàn thành', '09-20 12:44', 5),
        A('Mỗi việc một người phụ trách chính, những người khác là hỗ trợ', '09-20 13:50', 3),
        F('Luôn liệt kê nhiệm vụ và hiện ở dashboard', '09-20 13:08', 1),
      ]),
      D('Giao phẩm và mốc quan trọng', 'Quy trình nộp → nghiệm thu/từ chối, liên kết với mốc.', [
        A('Giao phẩm (quy trình nghiệm thu) và mốc quan trọng', '09-20 14:41', 8),
        F('Tạo phụ thuộc trùng trả 409 thay vì 500', '09-20 15:11', 1),
      ]),
      D('Trải nghiệm danh sách và chi tiết công việc', 'Lọc, sắp xếp, nhóm, chuyển việc trước/sau, lịch sử từng việc.', [
        A('Cải thiện UX danh sách và chi tiết công việc', '09-20 15:37', 5),
        A('Sắp xếp/nhóm danh sách, chuyển việc trước/sau, lịch sử từng công việc', '09-20 16:14', 5),
      ]),
      D('Khung phạm vi PMBOK', 'WBS nhiều cấp, từ điển WBS, phát biểu phạm vi, sơ đồ liên kết trên dashboard.', [
        A('WBS nhiều cấp, từ điển WBS, phát biểu phạm vi, sơ đồ liên kết trên dashboard', '09-20 17:15', 13),
        A('Siết phân quyền, giao diện theo vai trò, đánh dấu nhân vật đã chọn; tài liệu hành trình/kiểm thử/GTM', '09-20 20:05', 8),
        F('Chờ bản ghi hoạt động ghi bất đồng bộ trong test lịch sử', '09-20 20:13', 1),
      ]),
    ],
  },
  {
    title: '5. Sẵn sàng phát hành miễn phí',
    deliverables: [
      D('Kiểm soát chi phí và lạm dụng', 'Giới hạn tốc độ, hạn mức AI theo ngày, giới hạn số tổ chức.', [
        A('Giới hạn tốc độ, hạn mức AI/ngày, giới hạn số tổ chức; kế hoạch GTM giai đoạn miễn phí', '09-20 23:29', 8),
      ]),
      D('Tài khoản, email và đăng nhập Google', 'Đặt lại mật khẩu, xác minh email, email mời, đăng nhập Google.', [
        A('Đặt lại mật khẩu, xác minh email, email mời (SMTP tuỳ chọn)', '09-20 23:42', 8),
        A('Đăng nhập bằng Google (OAuth phía máy chủ)', '09-21 02:25', 5),
      ]),
      D('Quyền riêng tư và pháp lý', 'Xuất dữ liệu, xoá tài khoản/tổ chức, chuyển quyền chủ sở hữu, Điều khoản/Riêng tư.', [
        A('Xuất dữ liệu, xoá tài khoản và tổ chức, chuyển chủ sở hữu, trang Điều khoản/Riêng tư', '09-21 00:01', 8),
      ]),
      D('Khởi động nhanh và nhập/xuất', 'Dự án mẫu, checklist bắt đầu, nhập/xuất CSV, thao tác hàng loạt.', [
        A('Dự án mẫu (phần mềm, sự kiện, marketing) và checklist bắt đầu', '09-21 00:26', 5),
        A('Nhập/xuất công việc bằng CSV (an toàn, báo lỗi theo dòng)', '09-21 00:37', 5),
        A('Đổi cấp WBS hàng loạt (theo độ sâu có xem trước, hoặc theo lựa chọn)', '09-21 08:31', 5),
        A('Kéo thả sắp xếp trong tab WBS và danh sách công việc', '09-21 08:52', 5),
      ]),
      D('Thông báo và Việc của tôi', 'Chuông thông báo, trang việc của tôi xuyên dự án.', [
        A('Thông báo trong ứng dụng (chuông) và trang Việc của tôi', '09-21 01:35', 5),
      ]),
      D('Tệp triển khai và vận hành', 'Dockerfile, compose production, sao lưu diễn tập khôi phục, runbook.', [
        A('Tệp triển khai production, sao lưu có diễn tập khôi phục, endpoint sẵn sàng, runbook', '09-21 06:24', 8),
      ]),
    ],
  },
  {
    title: '6. Sprint, báo cáo và kiểm toán',
    deliverables: [
      D('Sprint: backlog, burndown, review', 'Backlog, bắt đầu/đóng sprint, burndown, báo cáo review.', [
        A('Sprint bản đầu: backlog, điểm, bắt đầu/đóng, lọc Kanban theo sprint', '09-21 09:54', 8),
        A('Burndown sprint: đường lý tưởng, phình phạm vi, kết luận, dự báo', '09-21 20:30', 5),
        A('Báo cáo review sprint: đã giao, còn dở, phát sinh, theo người, xu hướng', '09-21 21:02', 5),
      ]),
      D('Dự án riêng tư và báo cáo tự động', 'Khách chỉ thấy dự án của mình; báo cáo ngày và số liệu sản phẩm.', [
        A('Dự án riêng tư; ràng buộc route AI theo dự án', '09-21 10:10', 5),
        A('Báo cáo số liệu sản phẩm (kích hoạt, giữ chân)', '09-21 10:22', 2),
        A('Báo cáo ngày tự động, so sánh với ngày trước', '09-21 19:28', 8),
      ]),
      D('Lịch sử thay đổi và nhật ký kiểm toán', 'Mọi thay đổi có lịch sử trước → sau; mục đã xoá giữ nội dung.', [
        A('Lịch sử thay đổi đầy đủ cho mọi phần và nhật ký kiểm toán', '09-21 21:44', 13),
      ]),
    ],
  },
  {
    title: '7. Giao diện tối giản, hiện đại',
    deliverables: [
      D('Glass UI và điều hướng tối giản', 'Một hệ kính mờ thống nhất; 6 nhóm điều hướng; tìm nhanh.', [
        A('Nền động tinh tế (ba khối mờ trôi chậm)', '09-21 10:28', 2),
        A('Glass UI: một hệ thống thống nhất cho thẻ, thanh, menu, hộp thoại, ô nhập', '09-21 12:25', 5),
        A('Điều hướng dự án tối giản: 14 tab thành 6 nhóm', '09-21 12:48', 5),
        A('Tìm nhanh Ctrl/⌘K, nút hiện khi rê chuột, sửa màu chính có độ trong suốt', '09-21 13:07', 5),
        A('Nhân vật trên Timeline lớn hơn, bỏ viền vàng', '09-21 14:17', 2),
        A('Mọi người dùng hiển thị bằng nhân vật đại diện', '09-21 14:34', 5),
        F('Nút thu phóng Timeline không thấy ở chế độ tối', '09-21 14:20', 1),
      ]),
    ],
  },
  {
    title: '8. Bảo mật, hiệu năng và đóng gói',
    deliverables: [
      D('Vá bảo mật thư viện', 'Cảnh báo pnpm audit giảm từ 52 xuống 3 mức vừa.', [
        A('Vá lỗ hổng phụ thuộc gián tiếp, nâng next-intl 4, tắt tối ưu ảnh Next', '09-21 15:46', 5),
        A('Nâng Next.js 14 → 15.5 và React 18 → 19', '09-21 15:57', 8),
      ]),
      D('Tối ưu hiệu năng', 'Danh sách 2.500 việc không chặn luồng chính; Gantt mở nhanh; chỉ mục còn thiếu.', [
        A('Tối ưu tốc độ: danh sách công việc, phông Gantt tự phục vụ, chỉ mục khoá ngoại', '09-21 20:00', 8),
      ]),
      D('Đóng gói và triển khai thử cục bộ', 'Image gọn, chạy không root; stack production đã chạy thử cục bộ.', [
        A('Kiểm chứng stack production cục bộ (image, migration, HTTPS, sao lưu/khôi phục)', '09-21 16:20', 5),
        A('Cloudflare Tunnel, sao lưu ra ngoài bằng rclone, hướng dẫn Mac mini', '09-21 16:29', 5),
        A('Image Docker nhẹ (2,15 GB → ~0,5 GB), chạy không root', '09-21 20:13', 5),
        F('Bỏ infra/.env.prod khỏi git (chứa khoá bí mật)', '09-21 16:50', 1),
      ]),
    ],
  },
  {
    title: '9. Đưa lên máy chủ thật (Mac mini, pm.dgna.vn)',
    deliverables: [
      D(
        'Hệ thống chạy thật cho nhóm dùng thử kín',
        'https://pm.dgna.vn trả health/ready ok; sao lưu ra ngoài đã diễn tập khôi phục; email và Google hoạt động; điều khoản đã được rà soát.',
        [
          A('Bật tự khởi động lại sau mất điện, đăng nhập tự động, Docker tự chạy', null, 2, { sprint: 4, status: 'TODO', priority: 'HIGH' }),
          A('Xoá bản ghi pm cũ và tạo Cloudflare Tunnel, lấy token', null, 2, { sprint: 4, status: 'IN_PROGRESS', pct: 30, priority: 'HIGH', key: 'tunnel' }),
          A('Điền token và thông tin đơn vị vào ~/pmtool-prod/infra/.env.prod', null, 1, { sprint: 4, status: 'TODO', priority: 'HIGH', key: 'env', after: 'tunnel' }),
          A('Chạy stack và kiểm tra health/ready qua https://pm.dgna.vn', null, 2, { sprint: 4, status: 'TODO', priority: 'HIGH', key: 'run', after: 'env' }),
          A('Cấu hình rclone và diễn tập khôi phục từ bản sao lưu ngoài máy', null, 3, { sprint: 4, status: 'TODO', priority: 'CRITICAL', after: 'run' }),
          A('Cấu hình SMTP và SPF/DKIM để gửi email (đặt lại mật khẩu, mời)', null, 3, { sprint: 4, status: 'BLOCKED', priority: 'MEDIUM', after: 'run' }),
          A('Tạo Google OAuth client và điền GOOGLE_CLIENT_ID/SECRET', null, 2, { sprint: 4, status: 'TODO', priority: 'MEDIUM', after: 'run' }),
          A('Rà soát Điều khoản/Quyền riêng tư và điền tên đơn vị, email liên hệ', null, 3, { sprint: 4, status: 'TODO', priority: 'HIGH' }),
          A('Đặt giám sát bên ngoài gọi health/ready (uptime + cảnh báo)', null, 1, { sprint: 4, status: 'TODO', priority: 'MEDIUM', after: 'run' }),
        ],
        { status: 'IN_PROGRESS' },
      ),
    ],
  },
  {
    title: '10. Sau go-live (backlog)',
    deliverables: [
      D(
        'Cải tiến đã dự kiến',
        'Danh sách việc đã xếp hạng, chưa xếp vào sprint.',
        [
          A('Nâng NestJS 10 → 11 (còn 3 cảnh báo bảo mật mức vừa)', null, 5, { status: 'TODO' }),
          A('Nút khôi phục mục đã xoá từ lịch sử thay đổi', null, 5, { status: 'TODO' }),
          A('Xuất nhật ký kiểm toán ra CSV để lưu hồ sơ', null, 3, { status: 'TODO' }),
          A('Burndown loại bỏ ngày cuối tuần khỏi đường lý tưởng', null, 3, { status: 'TODO' }),
          A('Retrospective sprint', null, 5, { status: 'TODO' }),
          A('Tự lặp sprint', null, 3, { status: 'TODO' }),
          A('Gửi báo cáo ngày qua email và Telegram', null, 5, { status: 'TODO' }),
          A('Chuyển bộ giới hạn tốc độ sang Redis để chạy nhiều bản API', null, 5, { status: 'TODO' }),
          A('Ảnh nền Alpine cho image Docker (nhẹ thêm ~200 MB)', null, 3, { status: 'TODO' }),
          A('Kiểm thử truy cập (a11y) tự động và thử trên Firefox/Safari/di động', null, 5, { status: 'TODO' }),
          A('Theo dõi lỗi ứng dụng (Sentry hoặc tương đương)', null, 3, { status: 'TODO' }),
        ],
        { status: 'PLANNED' },
      ),
    ],
  },
];

export const SPRINTS = [
  { n: 1, name: 'Sprint 1 — Nền tảng và lõi quản lý công việc', goal: 'Có sản phẩm chạy được: đăng nhập, tổ chức, dự án, công việc, Kanban, Gantt, rủi ro.', start: '09-14', end: '09-16',
    notes: 'Đi nhanh nhờ chia lát dọc (mỗi mốc là một tính năng chạy được từ API tới giao diện). CI gặp hai lỗi cấu hình phải sửa ngay: nên chạy thử job trên bản sao sạch trước khi đẩy.',
    goalResult: 'MET' },
  { n: 2, name: 'Sprint 2 — Cộng tác, PMBOK cơ bản và tích hợp', goal: 'Thêm gamification, AI, Telegram, điều lệ/bên liên quan/tài liệu, quản trị tổ chức.', start: '09-17', end: '09-19',
    notes: 'Quản trị tổ chức là phần nhiều lỗi nhất (lời mời không dùng được, trùng lặp): cần test tích hợp cho từng luồng nghiệp vụ, không chỉ giao diện.',
    goalResult: 'MET' },
  { n: 3, name: 'Sprint 3 — Khung PMBOK, sẵn sàng phát hành, sprint và báo cáo', goal: 'Khung PMBOK đầy đủ; các hạng mục cần có để phát hành miễn phí; sprint, báo cáo, lịch sử; đóng gói và bảo mật.', start: '09-20', end: '09-21',
    notes: 'Khối lượng lớn nhất nhưng ổn định nhờ kiểm thử đầy đủ trước mỗi lần đẩy. Hai bài học: (1) bể kết nối phải tách riêng cho lịch sử — bế tắc chỉ lộ ở kiểm thử tải; (2) đo trước khi tối ưu (Gantt chậm vì phông CDN, không phải mã).',
    goalResult: 'MET' },
  { n: 4, name: 'Sprint 4 — Đưa lên máy chủ thật', goal: 'pm.dgna.vn chạy thật cho nhóm dùng thử kín, có sao lưu ngoài máy đã diễn tập khôi phục.', start: '09-21', end: '09-28' },
];

export const MILESTONES = [
  { title: 'M1 — Nền tảng hoàn tất (xác thực, đa tenant, hệ thiết kế)', day: '09-15 12:00', done: true },
  { title: 'M2 — MVP quản lý công việc (Kanban, Gantt, rủi ro)', day: '09-16 01:00', done: true },
  { title: 'M3 — Khung PMBOK hoàn chỉnh (WBS, phạm vi, giao phẩm)', day: '09-20 17:30', done: true },
  { title: 'M4 — Sẵn sàng phát hành miễn phí', day: '09-21 21:00', done: true },
  { title: 'M5 — Go-live cho nhóm dùng thử kín trên pm.dgna.vn', day: '09-28 17:00', done: false },
];

export const RISKS = [
  { type: 'RISK', title: 'Phụ thuộc Next.js 14 có nhiều lỗ hổng, bản vá chỉ có ở 15.5+', p: 4, i: 4, status: 'RESOLVED', created: '09-21 12:00', due: '09-21 15:57',
    d: 'pnpm audit báo 52 cảnh báo (2 nghiêm trọng). Đã nâng Next 15.5/React 19 và ghim các gói gián tiếp: còn 3 cảnh báo mức vừa.' },
  { type: 'ISSUE', title: 'Mất dữ liệu phát triển do lệnh migrate diff dùng nhầm cơ sở dữ liệu thật làm shadow', p: 5, i: 5, status: 'RESOLVED', created: '09-17 03:17',
    d: 'Xảy ra hai lần (17/9). Quy tắc mới: không bao giờ dùng DATABASE_URL thật làm shadow; kiểm tra số dòng trước/sau mọi migration; viết migration bằng tay.' },
  { type: 'ISSUE', title: 'Ghi lịch sử dùng chung bể kết nối làm các giao dịch chờ nhau đến hết hạn', p: 5, i: 4, status: 'RESOLVED', created: '09-21 21:30', due: '09-21 21:44',
    d: 'Lộ ra ở kiểm thử E2E hiệu năng (240 việc song song). Đã tách bể riêng 4 kết nối cho lịch sử; test tích hợp chạy với bể 4 kết nối để giữ chặt.' },
  { type: 'RISK', title: 'Triển khai thật chưa từng chạy: chứng chỉ, DNS, vòng sao lưu qua đêm', p: 3, i: 4, status: 'MITIGATING', created: '09-21 06:24',
    d: 'Đã kiểm chứng trọn stack cục bộ (image, migration, HTTPS, sao lưu/khôi phục khớp số dòng). Còn phần cần máy chủ và tên miền thật.' },
  { type: 'RISK', title: 'Mất điện hoặc mất mạng khi đặt máy chủ ở nhà', p: 3, i: 3, status: 'MITIGATING', created: '09-21 16:29',
    d: 'Dùng Cloudflare Tunnel (không mở cổng), bật tự khởi động lại; nên có UPS nhỏ. Khi cần cam kết thời gian hoạt động sẽ chuyển sang VPS.' },
  { type: 'RISK', title: 'Bản sao lưu nằm cùng một ổ với dữ liệu', p: 3, i: 5, status: 'MITIGATING', created: '09-21 16:29',
    d: 'Đã có dịch vụ chép ra ngoài bằng rclone (chỉ thêm, không đồng bộ xoá); cần cấu hình kho lưu trữ thật và diễn tập khôi phục.' },
  { type: 'RISK', title: 'Điều khoản và Quyền riêng tư chưa được người có chuyên môn rà soát', p: 3, i: 4, status: 'IDENTIFIED', created: '09-21 00:01', due: '09-27 17:00',
    d: 'Trang đã có, nội dung là bản nháp kỹ thuật. Cần rà soát trước khi mở cho người dùng thật.' },
  { type: 'ISSUE', title: 'Chưa cấu hình SMTP và Google OAuth nên email và đăng nhập Google chưa dùng được ở bản thật', p: 4, i: 3, status: 'IDENTIFIED', created: '09-21 02:25', due: '09-27 17:00',
    d: 'Mã đã xong và có kiểm thử với bản giả; cần tài khoản/khoá thật của nhà cung cấp.' },
  { type: 'RISK', title: 'Giới hạn tốc độ nằm trong bộ nhớ nên chỉ chạy được một bản API', p: 2, i: 3, status: 'ANALYZING', created: '09-20 23:29',
    d: 'Chấp nhận ở giai đoạn đầu. Khi cần nhiều bản API phải chuyển bộ đếm sang Redis.' },
  { type: 'RISK', title: 'Chưa có giám sát bên ngoài và theo dõi lỗi ứng dụng', p: 3, i: 3, status: 'IDENTIFIED', created: '09-21 06:24', due: '09-28 17:00',
    d: 'Cần uptime gọi health/ready, cảnh báo qua Telegram/email, và Sentry hoặc tương đương.' },
];

export const STAKEHOLDERS = [
  { fullName: 'Grey', role: 'Chủ sản phẩm, nhà tài trợ và quản lý dự án', organizationName: 'DGNA', category: 'INTERNAL', influence: 'HIGH', interest: 'HIGH', currentEngagement: 'LEADING', desiredEngagement: 'LEADING', notes: 'Quyết định hướng đi và độ ưu tiên; nghiệm thu các giao phẩm.' },
  { fullName: 'Nhóm dùng thử kín', role: 'Người dùng đầu tiên (giai đoạn miễn phí)', organizationName: 'Ngoài DGNA', category: 'EXTERNAL', influence: 'MEDIUM', interest: 'HIGH', currentEngagement: 'UNAWARE', desiredEngagement: 'SUPPORTIVE', notes: 'Cần chọn 10–15 tổ chức hoạt động nhiều nhất để phỏng vấn về giá trị và mức sẵn lòng trả.' },
  { fullName: 'Khách hàng doanh nghiệp tiềm năng', role: 'Công ty dịch vụ có nhiều khách (dùng dự án riêng tư)', organizationName: 'Chưa xác định', category: 'EXTERNAL', influence: 'HIGH', interest: 'MEDIUM', currentEngagement: 'UNAWARE', desiredEngagement: 'SUPPORTIVE', notes: 'Nhóm khách hàng có khả năng trả phí sau giai đoạn miễn phí.' },
  { fullName: 'Cloudflare', role: 'Nhà cung cấp DNS, Tunnel và HTTPS', organizationName: 'Cloudflare', category: 'EXTERNAL', influence: 'MEDIUM', interest: 'LOW', currentEngagement: 'NEUTRAL', desiredEngagement: 'NEUTRAL', notes: 'dgna.vn đã dùng Cloudflare; tunnel cho pm.dgna.vn.' },
  { fullName: 'Tenten', role: 'Nhà đăng ký tên miền dgna.vn', organizationName: 'Tenten.vn', category: 'EXTERNAL', influence: 'LOW', interest: 'LOW', currentEngagement: 'NEUTRAL', desiredEngagement: 'NEUTRAL', notes: 'Chỉ cần khi đổi nameserver hoặc gia hạn.' },
  { fullName: 'Anthropic', role: 'Nhà cung cấp mô hình AI (tóm tắt, gợi ý, tạo việc)', organizationName: 'Anthropic', category: 'EXTERNAL', influence: 'LOW', interest: 'LOW', currentEngagement: 'NEUTRAL', desiredEngagement: 'NEUTRAL', notes: 'Chi phí kiểm soát bằng hạn mức AI theo ngày cho mỗi tổ chức.' },
  { fullName: 'Người rà soát pháp lý', role: 'Xem Điều khoản và Quyền riêng tư trước khi mở công khai', organizationName: 'Chưa xác định', category: 'EXTERNAL', influence: 'MEDIUM', interest: 'MEDIUM', currentEngagement: 'UNAWARE', desiredEngagement: 'SUPPORTIVE', notes: 'Cần tìm người có chuyên môn trước ngày go-live.' },
];

const REPO = 'https://github.com/greyhub/pmtool/blob/main';
export const DOCUMENTS = [
  { title: 'Hướng dẫn sử dụng', category: 'OTHER', version: '33 mục', status: 'APPROVED', path: 'docs/huong-dan-su-dung.md', d: 'Hướng dẫn đầy đủ cho người dùng cuối, cập nhật theo từng tính năng.' },
  { title: 'Kiến trúc hệ thống', category: 'DESIGN', version: '§1.14', status: 'APPROVED', path: 'docs/kien-truc.md', d: 'Kiến trúc nghiệp vụ và kỹ thuật, quy tắc bảo mật, mô hình dữ liệu.' },
  { title: 'Kiểm thử và độ phủ', category: 'REPORT', version: '2026-09-21', status: 'APPROVED', path: 'docs/kiem-thu.md', d: 'Số test theo tầng, bản đồ hành trình ↔ test, giới hạn đã biết.' },
  { title: 'Hành trình người dùng', category: 'REQUIREMENT', version: '1.0', status: 'APPROVED', path: 'docs/hanh-trinh-nguoi-dung.md', d: 'Các luồng nghiệp vụ và điểm gãy đã tìm thấy.' },
  { title: 'Kế hoạch đưa ra thị trường (GTM)', category: 'PLAN', version: 'giai đoạn miễn phí', status: 'APPROVED', path: 'docs/gtm.md', d: 'Kế hoạch giai đoạn miễn phí, cổng sẵn sàng, chi phí kiểm soát.' },
  { title: 'Vận hành production (runbook)', category: 'PLAN', version: '2026-09-22', status: 'APPROVED', path: 'docs/van-hanh.md', d: 'Triển khai, sao lưu/khôi phục, giám sát, bảo mật, xử lý sự cố.' },
  { title: 'Triển khai trên Mac mini (Cloudflare Tunnel)', category: 'PLAN', version: '1.0', status: 'IN_REVIEW', path: 'docs/trien-khai-mac-mini.md', d: 'Các bước đưa pm.dgna.vn lên máy chủ tại nhà; chưa chạy với tài khoản Cloudflare thật.' },
  { title: 'Hiệu năng', category: 'REPORT', version: '2026-09-21', status: 'APPROVED', path: 'docs/hieu-nang.md', d: 'Cách đo, kết quả trước/sau và các đánh đổi đã cân nhắc.' },
];
export const docUrl = (p) => `${REPO}/${p}`;

export const CHARTER = {
  purpose:
    'Xây dựng PMTool — nền tảng quản lý dự án theo chuẩn PMBOK/PMP cho nhiều tổ chức (đa tenant), giao diện tiếng Việt/Anh, có quản lý phạm vi (WBS, từ điển WBS), tiến độ (Gantt, sprint), rủi ro, giao phẩm và báo cáo tự động. Đồng thời dùng chính PMTool để quản lý việc xây dựng PMTool.',
  objectives:
    '1. Bản MVP chạy được và có kiểm thử đầy đủ.\n2. Đủ tính năng và độ an toàn để phát hành miễn phí cho nhóm dùng thử kín.\n3. Chạy thật trên pm.dgna.vn có sao lưu ngoài máy và giám sát.\n4. Thu dữ liệu kích hoạt/giữ chân để quyết định mô hình kiếm tiền sau giai đoạn miễn phí.',
  scopeSummary:
    'Trong phạm vi: quản lý tổ chức/dự án/công việc, WBS và phạm vi PMBOK, Kanban, Gantt, sprint, rủi ro, giao phẩm, báo cáo, lịch sử, thông báo, AI hỗ trợ, tích hợp Telegram, triển khai và vận hành. Ngoài phạm vi (giai đoạn này): thanh toán/gói trả phí, ứng dụng di động gốc, SSO doanh nghiệp.',
  milestonesSummary:
    'M1 Nền tảng (15/9) · M2 MVP quản lý công việc (16/9) · M3 Khung PMBOK (20/9) · M4 Sẵn sàng phát hành miễn phí (21/9) · M5 Go-live nhóm dùng thử kín (28/9).',
  budgetSummary: 'Không có ngân sách tiền mặt ngoài tên miền và (tuỳ chọn) SMTP/AI; chi phí hạ tầng ≈ 0 khi chạy trên Mac mini + Cloudflare miễn phí.',
  assumptions:
    'Giai đoạn đầu chạy một bản API trên Mac mini; người dùng ít (nhóm dùng thử kín); Cloudflare Tunnel và gói miễn phí đủ dùng; có người rà soát pháp lý trước khi mở công khai.',
  constraints:
    'Một nhà phát triển (Grey) cùng trợ lý AI; phải kiểm thử đầy đủ trước mỗi lần đẩy; không bao giờ làm mất dữ liệu (kiểm tra số dòng trước/sau mọi migration); giai đoạn này miễn phí nên phải có hạn mức chống lạm dụng.',
  sponsorName: 'Grey (DGNA)',
};

export const SCOPE = {
  inScope:
    '• Đa tenant: tổ chức, dự án, vai trò hai lớp, dự án riêng tư.\n• Công việc/WBS PMBOK (giai đoạn, giao phẩm, gói công việc, hoạt động), từ điển WBS, phát biểu phạm vi.\n• Kanban, Gantt, sprint (backlog, burndown, review), báo cáo ngày.\n• Rủi ro/vấn đề, giao phẩm và mốc, điều lệ, bên liên quan, tài liệu, Artifact.\n• Lịch sử thay đổi và nhật ký kiểm toán; thông báo; nhập/xuất CSV.\n• Đăng nhập (email, Google), đặt lại mật khẩu, xuất/xoá dữ liệu cá nhân.\n• Triển khai Docker, sao lưu, giám sát cơ bản, tài liệu.',
  outOfScope:
    '• Thanh toán, gói trả phí (hoãn tới sau giai đoạn miễn phí).\n• Ứng dụng di động gốc.\n• SSO doanh nghiệp (SAML/OIDC ngoài Google).\n• Quản lý chi phí/EVM đầy đủ và ma trận truy vết yêu cầu (đã đưa vào backlog xa).',
  deliverablesSummary: 'Sản phẩm chạy được (web + API), bộ kiểm thử, tài liệu người dùng/kiến trúc/vận hành, tệp triển khai và bản chạy thật tại pm.dgna.vn.',
  acceptanceCriteria:
    '• Pipeline CI xanh (lint, typecheck, build, unit, integration, E2E).\n• Mọi migration được kiểm tra số dòng trước/sau.\n• Diễn tập khôi phục thành công (số dòng khớp).\n• pm.dgna.vn trả health/ready ok qua HTTPS.',
  assumptions: 'Người dùng chấp nhận giai đoạn miễn phí có hạn mức; nhóm dùng thử kín sẵn sàng phản hồi.',
  constraints: 'Một nhà phát triển; hạ tầng đặt tại nhà (Mac mini) qua Cloudflare Tunnel cho tới khi cần chuyển VPS.',
};
