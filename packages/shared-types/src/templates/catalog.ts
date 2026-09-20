import { z } from 'zod';

/** A string in both interface languages. */
export interface L {
  vi: string;
  en: string;
}
const l = (vi: string, en: string): L => ({ vi, en });

export interface TemplateActivity {
  title: L;
  /** Working days, scheduled one after another inside the work package. */
  days: number;
}
export interface TemplateWorkPackage {
  title: L;
  scope: L;
  activities: TemplateActivity[];
}
export interface TemplateDeliverable {
  title: L;
  criteria: L;
  workPackages: TemplateWorkPackage[];
}
export interface TemplatePhase {
  title: L;
  deliverables: TemplateDeliverable[];
  /** A milestone due on the last day of the phase. */
  milestone: L;
}
export interface TemplateRisk {
  title: L;
  probability: number;
  impact: number;
}
export interface ProjectTemplate {
  id: string;
  name: L;
  description: L;
  scope: { inScope: L; outOfScope: L; acceptanceCriteria: L };
  phases: TemplatePhase[];
  risks: TemplateRisk[];
}

export const PROJECT_TEMPLATES: readonly ProjectTemplate[] = [
  {
    id: 'software',
    name: l('Dự án phần mềm', 'Software project'),
    description: l(
      'Khởi tạo → phân tích & thiết kế → phát triển & kiểm thử → triển khai. Có giao phẩm, mốc và rủi ro thường gặp.',
      'Initiate → analyse & design → build & test → release. Comes with deliverables, milestones and common risks.',
    ),
    scope: {
      inScope: l(
        'Phân tích yêu cầu, thiết kế, phát triển, kiểm thử và triển khai phiên bản đầu tiên của sản phẩm.',
        'Requirements analysis, design, development, testing and release of the first version of the product.',
      ),
      outOfScope: l(
        'Vận hành và hỗ trợ dài hạn sau bàn giao; các tính năng ngoài danh sách yêu cầu đã chốt.',
        'Long-term operation and support after hand-over; features outside the agreed requirement list.',
      ),
      acceptanceCriteria: l(
        'Khách hàng ký nghiệm thu tài liệu yêu cầu và bản chạy; ≥ 95% test case đạt; không còn lỗi mức nghiêm trọng.',
        'The client signs off the requirements and the release; ≥ 95% of test cases pass; no severe defects remain.',
      ),
    },
    phases: [
      {
        title: l('Khởi tạo và yêu cầu', 'Initiation and requirements'),
        milestone: l('Chốt yêu cầu', 'Requirements baselined'),
        deliverables: [
          {
            title: l('Tài liệu yêu cầu (SRS)', 'Requirements specification (SRS)'),
            criteria: l('Khách hàng ký duyệt SRS phiên bản 1.0.', 'The client signs off SRS version 1.0.'),
            workPackages: [
              {
                title: l('Khảo sát nghiệp vụ', 'Business discovery'),
                scope: l(
                  'Phỏng vấn các bên liên quan và tổng hợp danh sách yêu cầu có ưu tiên.',
                  'Interview stakeholders and consolidate a prioritised requirement list.',
                ),
                activities: [
                  { title: l('Lập danh sách bên liên quan cần phỏng vấn', 'List the stakeholders to interview'), days: 1 },
                  { title: l('Phỏng vấn và ghi nhận yêu cầu', 'Interview and capture requirements'), days: 4 },
                  { title: l('Tổng hợp và xếp ưu tiên yêu cầu', 'Consolidate and prioritise requirements'), days: 2 },
                ],
              },
              {
                title: l('Lập tài liệu SRS', 'Write the SRS'),
                scope: l('Viết, rà soát và chốt SRS.', 'Write, review and finalise the SRS.'),
                activities: [
                  { title: l('Viết bản nháp SRS', 'Draft the SRS'), days: 4 },
                  { title: l('Rà soát cùng khách hàng', 'Review with the client'), days: 2 },
                ],
              },
            ],
          },
        ],
      },
      {
        title: l('Thiết kế và phát triển', 'Design and build'),
        milestone: l('Bản chạy thử sẵn sàng', 'Release candidate ready'),
        deliverables: [
          {
            title: l('Bản thiết kế', 'Design pack'),
            criteria: l('Thiết kế giao diện và kiến trúc được khách hàng và trưởng kỹ thuật duyệt.', 'UI and architecture designs approved by the client and the tech lead.'),
            workPackages: [
              {
                title: l('Thiết kế giao diện', 'UI design'),
                scope: l('Wireframe và mockup các màn hình chính.', 'Wireframes and mockups of the main screens.'),
                activities: [
                  { title: l('Vẽ wireframe', 'Draw wireframes'), days: 4 },
                  { title: l('Thiết kế mockup', 'Design mockups'), days: 5 },
                ],
              },
              {
                title: l('Thiết kế kiến trúc', 'Architecture design'),
                scope: l('Kiến trúc hệ thống, mô hình dữ liệu, giao diện lập trình.', 'System architecture, data model and APIs.'),
                activities: [
                  { title: l('Thiết kế mô hình dữ liệu', 'Design the data model'), days: 3 },
                  { title: l('Thiết kế API', 'Design the APIs'), days: 3 },
                ],
              },
            ],
          },
          {
            title: l('Bản chạy thử', 'Working release candidate'),
            criteria: l('Toàn bộ tính năng trong phạm vi chạy được trên môi trường thử; test case chính đạt.', 'All in-scope features work in the test environment; the main test cases pass.'),
            workPackages: [
              {
                title: l('Phát triển tính năng', 'Feature development'),
                scope: l('Lập trình các tính năng theo SRS và thiết kế.', 'Implement the features defined in the SRS and design.'),
                activities: [
                  { title: l('Lập trình đợt 1', 'Build increment 1'), days: 10 },
                  { title: l('Lập trình đợt 2', 'Build increment 2'), days: 10 },
                ],
              },
              {
                title: l('Kiểm thử', 'Testing'),
                scope: l('Viết và chạy test case, sửa lỗi.', 'Write and run test cases, fix defects.'),
                activities: [
                  { title: l('Viết test case', 'Write test cases'), days: 3 },
                  { title: l('Chạy kiểm thử và sửa lỗi', 'Run tests and fix defects'), days: 7 },
                ],
              },
            ],
          },
        ],
      },
      {
        title: l('Triển khai và bàn giao', 'Release and hand-over'),
        milestone: l('Nghiệm thu và go-live', 'Acceptance and go-live'),
        deliverables: [
          {
            title: l('Hệ thống đã triển khai', 'Deployed system'),
            criteria: l('Hệ thống chạy ổn định trên môi trường thật, khách hàng ký nghiệm thu.', 'The system runs stably in production and the client signs acceptance.'),
            workPackages: [
              {
                title: l('Triển khai', 'Deployment'),
                scope: l('Cài đặt, cấu hình và chuyển dữ liệu lên môi trường thật.', 'Install, configure and migrate data to production.'),
                activities: [
                  { title: l('Chuẩn bị môi trường thật', 'Prepare the production environment'), days: 2 },
                  { title: l('Triển khai và kiểm tra sau triển khai', 'Deploy and smoke-test'), days: 2 },
                ],
              },
              {
                title: l('Hướng dẫn và bàn giao', 'Training and hand-over'),
                scope: l('Tài liệu hướng dẫn và đào tạo người dùng.', 'User documentation and training.'),
                activities: [
                  { title: l('Soạn tài liệu hướng dẫn', 'Write the user guide'), days: 3 },
                  { title: l('Đào tạo người dùng', 'Train the users'), days: 2 },
                ],
              },
            ],
          },
        ],
      },
    ],
    risks: [
      { title: l('Yêu cầu thay đổi liên tục (phình phạm vi)', 'Requirements keep changing (scope creep)'), probability: 4, impact: 4 },
      { title: l('Thiếu người có kỹ năng then chốt', 'Key skills are in short supply'), probability: 3, impact: 4 },
      { title: l('Khách hàng phản hồi/duyệt chậm', 'Slow client feedback and approvals'), probability: 3, impact: 3 },
    ],
  },
  {
    id: 'event',
    name: l('Tổ chức sự kiện', 'Event'),
    description: l(
      'Lập kế hoạch → chuẩn bị → tổ chức → tổng kết. Phù hợp hội nghị, lễ ra mắt, hội thảo.',
      'Plan → prepare → run → wrap up. Fits conferences, launches and workshops.',
    ),
    scope: {
      inScope: l(
        'Lên kế hoạch, chuẩn bị địa điểm, chương trình, truyền thông, đón tiếp và tổng kết sự kiện.',
        'Planning, venue, programme, promotion, guest handling and wrap-up of the event.',
      ),
      outOfScope: l('Các hoạt động sau sự kiện ngoài báo cáo tổng kết.', 'Follow-up activities beyond the wrap-up report.'),
      acceptanceCriteria: l(
        'Sự kiện diễn ra đúng chương trình, trong ngân sách; báo cáo tổng kết được ban tổ chức duyệt.',
        'The event runs to programme and within budget; the wrap-up report is approved by the organisers.',
      ),
    },
    phases: [
      {
        title: l('Lập kế hoạch', 'Planning'),
        milestone: l('Kế hoạch được duyệt', 'Plan approved'),
        deliverables: [
          {
            title: l('Kế hoạch sự kiện', 'Event plan'),
            criteria: l('Ban tổ chức duyệt kế hoạch, ngân sách và lịch trình.', 'Organisers approve the plan, budget and timeline.'),
            workPackages: [
              {
                title: l('Mục tiêu và ngân sách', 'Objectives and budget'),
                scope: l('Xác định mục tiêu, đối tượng, quy mô và ngân sách.', 'Set objectives, audience, size and budget.'),
                activities: [
                  { title: l('Chốt mục tiêu và đối tượng', 'Agree objectives and audience'), days: 2 },
                  { title: l('Lập ngân sách', 'Build the budget'), days: 3 },
                ],
              },
              {
                title: l('Lịch trình và nhân sự', 'Schedule and staffing'),
                scope: l('Lịch trình tổng thể và phân công ban tổ chức.', 'Overall timeline and organiser roles.'),
                activities: [
                  { title: l('Lập lịch trình tổng thể', 'Build the overall timeline'), days: 3 },
                  { title: l('Phân công ban tổ chức', 'Assign organiser roles'), days: 2 },
                ],
              },
            ],
          },
        ],
      },
      {
        title: l('Chuẩn bị', 'Preparation'),
        milestone: l('Sẵn sàng tổ chức', 'Ready to run'),
        deliverables: [
          {
            title: l('Địa điểm và nhà cung cấp', 'Venue and suppliers'),
            criteria: l('Địa điểm và các nhà cung cấp chính đã ký xác nhận.', 'Venue and key suppliers are confirmed in writing.'),
            workPackages: [
              {
                title: l('Địa điểm', 'Venue'),
                scope: l('Khảo sát, chọn và đặt địa điểm.', 'Scout, choose and book the venue.'),
                activities: [
                  { title: l('Khảo sát địa điểm', 'Scout venues'), days: 3 },
                  { title: l('Ký hợp đồng địa điểm', 'Sign the venue contract'), days: 2 },
                ],
              },
              {
                title: l('Nhà cung cấp', 'Suppliers'),
                scope: l('Âm thanh ánh sáng, ăn uống, trang trí.', 'AV, catering and décor.'),
                activities: [
                  { title: l('Yêu cầu báo giá', 'Request quotes'), days: 3 },
                  { title: l('Chốt nhà cung cấp', 'Select suppliers'), days: 2 },
                ],
              },
            ],
          },
          {
            title: l('Chương trình và truyền thông', 'Programme and promotion'),
            criteria: l('Chương trình chi tiết được duyệt; đạt số lượng đăng ký mục tiêu.', 'The detailed programme is approved; the registration target is met.'),
            workPackages: [
              {
                title: l('Chương trình', 'Programme'),
                scope: l('Kịch bản, diễn giả, thời lượng từng phần.', 'Run-of-show, speakers and timings.'),
                activities: [
                  { title: l('Xây dựng kịch bản chương trình', 'Draft the run-of-show'), days: 4 },
                  { title: l('Mời và xác nhận diễn giả', 'Invite and confirm speakers'), days: 5 },
                ],
              },
              {
                title: l('Truyền thông và đăng ký', 'Promotion and registration'),
                scope: l('Thông điệp, kênh truyền thông, trang đăng ký.', 'Messaging, channels and the registration page.'),
                activities: [
                  { title: l('Thiết kế ấn phẩm', 'Design collateral'), days: 4 },
                  { title: l('Truyền thông và theo dõi đăng ký', 'Promote and track registrations'), days: 10 },
                ],
              },
            ],
          },
        ],
      },
      {
        title: l('Tổ chức và tổng kết', 'Run and wrap-up'),
        milestone: l('Hoàn tất sự kiện', 'Event completed'),
        deliverables: [
          {
            title: l('Sự kiện được tổ chức', 'Event delivered'),
            criteria: l('Sự kiện diễn ra đúng chương trình; khảo sát hài lòng đạt mục tiêu.', 'The event runs to programme; satisfaction survey meets the target.'),
            workPackages: [
              {
                title: l('Vận hành ngày sự kiện', 'Event-day operations'),
                scope: l('Dựng, đón tiếp, điều phối và thu dọn.', 'Set-up, guest handling, coordination and teardown.'),
                activities: [
                  { title: l('Dựng và kiểm tra kỹ thuật', 'Set up and run tech checks'), days: 1 },
                  { title: l('Điều phối chương trình', 'Run the programme'), days: 1 },
                ],
              },
              {
                title: l('Tổng kết', 'Wrap-up'),
                scope: l('Báo cáo, quyết toán, bài học kinh nghiệm.', 'Report, reconciliation and lessons learned.'),
                activities: [
                  { title: l('Khảo sát người tham dự', 'Survey attendees'), days: 3 },
                  { title: l('Báo cáo và quyết toán', 'Report and reconcile costs'), days: 4 },
                ],
              },
            ],
          },
        ],
      },
    ],
    risks: [
      { title: l('Địa điểm/nhà cung cấp huỷ sát ngày', 'Venue or supplier cancels late'), probability: 2, impact: 5 },
      { title: l('Số người đăng ký thấp hơn mục tiêu', 'Registrations fall short of target'), probability: 3, impact: 4 },
      { title: l('Vượt ngân sách', 'Budget overrun'), probability: 3, impact: 3 },
    ],
  },
  {
    id: 'marketing',
    name: l('Chiến dịch marketing', 'Marketing campaign'),
    description: l(
      'Chiến lược → sản xuất nội dung → triển khai → đo lường. Có sẵn giao phẩm và tiêu chí nghiệm thu.',
      'Strategy → content production → launch → measurement. Deliverables and acceptance criteria included.',
    ),
    scope: {
      inScope: l(
        'Xây dựng chiến lược, sản xuất nội dung, chạy các kênh đã chọn và báo cáo kết quả chiến dịch.',
        'Build the strategy, produce content, run the chosen channels and report campaign results.',
      ),
      outOfScope: l('Phát triển sản phẩm; hoạt động bán hàng sau khi có khách hàng tiềm năng.', 'Product development; sales follow-up after leads are generated.'),
      acceptanceCriteria: l(
        'Nội dung được duyệt trước khi phát hành; báo cáo kết quả đối chiếu với chỉ tiêu đã đặt.',
        'Content is approved before publishing; the results report compares against the targets set.',
      ),
    },
    phases: [
      {
        title: l('Chiến lược', 'Strategy'),
        milestone: l('Chiến lược được duyệt', 'Strategy approved'),
        deliverables: [
          {
            title: l('Kế hoạch chiến dịch', 'Campaign plan'),
            criteria: l('Mục tiêu, thông điệp, kênh và ngân sách được duyệt.', 'Goals, messaging, channels and budget are approved.'),
            workPackages: [
              {
                title: l('Nghiên cứu và mục tiêu', 'Research and goals'),
                scope: l('Nghiên cứu khách hàng mục tiêu, đặt chỉ tiêu.', 'Research the target audience and set targets.'),
                activities: [
                  { title: l('Nghiên cứu khách hàng mục tiêu', 'Research the target audience'), days: 4 },
                  { title: l('Đặt mục tiêu và chỉ tiêu đo lường', 'Set goals and KPIs'), days: 2 },
                ],
              },
              {
                title: l('Kênh và ngân sách', 'Channels and budget'),
                scope: l('Chọn kênh triển khai và phân bổ ngân sách.', 'Choose the channels and allocate the budget.'),
                activities: [
                  { title: l('Chọn kênh triển khai', 'Choose the channels'), days: 2 },
                  { title: l('Phân bổ ngân sách', 'Allocate the budget'), days: 2 },
                ],
              },
            ],
          },
        ],
      },
      {
        title: l('Sản xuất nội dung', 'Content production'),
        milestone: l('Nội dung sẵn sàng phát hành', 'Content ready to publish'),
        deliverables: [
          {
            title: l('Bộ nội dung chiến dịch', 'Campaign content set'),
            criteria: l('Toàn bộ nội dung được người phụ trách thương hiệu duyệt.', 'All content is approved by the brand owner.'),
            workPackages: [
              {
                title: l('Nội dung văn bản', 'Copywriting'),
                scope: l('Bài viết, email, quảng cáo.', 'Articles, emails and ads.'),
                activities: [
                  { title: l('Viết nội dung', 'Write the copy'), days: 5 },
                  { title: l('Chỉnh sửa và duyệt', 'Edit and approve'), days: 2 },
                ],
              },
              {
                title: l('Hình ảnh và video', 'Visuals and video'),
                scope: l('Thiết kế và quay dựng.', 'Design and video production.'),
                activities: [
                  { title: l('Thiết kế hình ảnh', 'Design visuals'), days: 5 },
                  { title: l('Quay và dựng video', 'Shoot and edit video'), days: 6 },
                ],
              },
            ],
          },
        ],
      },
      {
        title: l('Triển khai và đo lường', 'Launch and measurement'),
        milestone: l('Kết thúc chiến dịch', 'Campaign closed'),
        deliverables: [
          {
            title: l('Chiến dịch đã chạy', 'Campaign launched'),
            criteria: l('Nội dung được phát hành đúng lịch trên các kênh đã chọn.', 'Content is published on schedule on the chosen channels.'),
            workPackages: [
              {
                title: l('Chạy các kênh', 'Run the channels'),
                scope: l('Đăng bài, chạy quảng cáo, theo dõi hằng ngày.', 'Publish, run ads and monitor daily.'),
                activities: [
                  { title: l('Phát hành theo lịch', 'Publish on schedule'), days: 10 },
                  { title: l('Tối ưu quảng cáo hằng tuần', 'Optimise ads weekly'), days: 10 },
                ],
              },
              {
                title: l('Báo cáo kết quả', 'Results report'),
                scope: l('Tổng hợp số liệu và bài học.', 'Consolidate results and lessons.'),
                activities: [
                  { title: l('Tổng hợp số liệu', 'Collect the numbers'), days: 3 },
                  { title: l('Viết báo cáo và bài học', 'Write the report and lessons'), days: 2 },
                ],
              },
            ],
          },
        ],
      },
    ],
    risks: [
      { title: l('Nội dung bị duyệt chậm', 'Content approval is slow'), probability: 3, impact: 3 },
      { title: l('Chi phí quảng cáo tăng ngoài dự kiến', 'Advertising costs rise unexpectedly'), probability: 3, impact: 3 },
      { title: l('Kết quả thấp hơn chỉ tiêu', 'Results fall below target'), probability: 2, impact: 4 },
    ],
  },
];

export const templateIdSchema = z.enum(['software', 'event', 'marketing']);

export function findTemplate(id: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES.find((t) => t.id === id);
}

/** Counts shown to the user before they pick a template. */
export function templateStats(t: ProjectTemplate) {
  let workPackages = 0;
  let activities = 0;
  let deliverables = 0;
  for (const p of t.phases)
    for (const d of p.deliverables) {
      deliverables += 1;
      for (const w of d.workPackages) {
        workPackages += 1;
        activities += w.activities.length;
      }
    }
  return { phases: t.phases.length, deliverables, workPackages, activities, milestones: t.phases.length, risks: t.risks.length };
}

/** Adds working days (Mon–Fri) to a date, never landing on a weekend. */
export function addWorkdays(from: Date, days: number): Date {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) left -= 1;
  }
  return d;
}

/** The next weekday on or after `from`. */
export function nextWorkday(from: Date): Date {
  const d = new Date(from);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}
