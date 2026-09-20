export type LegalLocale = 'vi' | 'en';

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface LegalDocument {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}

/** Who runs the service and how to reach them — set per deployment, never hard-coded. */
export function operatorInfo() {
  return {
    name: process.env.NEXT_PUBLIC_OPERATOR_NAME || '[Tên đơn vị vận hành — cần cấu hình NEXT_PUBLIC_OPERATOR_NAME]',
    email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || '[email liên hệ — cần cấu hình NEXT_PUBLIC_CONTACT_EMAIL]',
  };
}

const UPDATED = '2026-09-20';

export function termsDocument(locale: LegalLocale): LegalDocument {
  const { name, email } = operatorInfo();
  if (locale === 'en') {
    return {
      title: 'Terms of use',
      updated: UPDATED,
      intro: `These terms govern your use of PMTool, a project-management service operated by ${name} ("we"). By creating an account or using the service you agree to them.`,
      sections: [
        {
          heading: '1. The service',
          paragraphs: [
            'PMTool lets teams plan and track projects (scope, work breakdown, tasks, deliverables, risks) in shared workspaces called organizations. The service is currently offered free of charge.',
          ],
        },
        {
          heading: '2. Your account',
          bullets: [
            'You must give accurate information and keep your password confidential; you are responsible for activity under your account.',
            'One person per account. You may own a limited number of organizations, as shown in the product.',
            'Tell us at once if you suspect unauthorized access.',
          ],
        },
        {
          heading: '3. Your content',
          paragraphs: [
            'You keep all rights to what you put into PMTool (tasks, comments, documents, artifacts). You give us the limited permission needed to store, display and process it in order to run the service for you and the people you invite.',
            'Organization owners and admins control who can see and edit their organization. Anyone you invite can see the organization content their role allows.',
          ],
        },
        {
          heading: '4. Acceptable use',
          bullets: [
            'Do not break the law, infringe others’ rights, or upload content you have no right to share.',
            'Do not attack, overload or probe the service, bypass limits, or use automated means to create accounts or consume the AI assistant.',
            'Custom HTML/JS "artifacts" must not try to escape their sandbox, collect other people’s data, or run malicious code.',
            'We may suspend accounts that abuse the service.',
          ],
        },
        {
          heading: '5. AI assistant and integrations',
          paragraphs: [
            'AI features send the text you choose (for example a task title and description) to our AI provider to produce a suggestion. Suggestions may be wrong; you decide what to accept. Usage is capped per organization per day.',
            'If you link Telegram, notifications about your tasks are sent through it.',
          ],
        },
        {
          heading: '6. Free service, availability and changes',
          paragraphs: [
            'The service is provided free and "as is". We work to keep it available and your data safe, but we do not promise uninterrupted service. We may change or stop features, and may introduce paid plans in the future; we will give reasonable notice before any change that affects features you use, and you can always export your data.',
          ],
        },
        {
          heading: '7. Ending your use',
          paragraphs: [
            'You can export your data and delete your account at any time from Settings. We may suspend or close accounts that break these terms.',
          ],
        },
        {
          heading: '8. Liability',
          paragraphs: [
            'To the extent the law allows, we are not liable for indirect or consequential losses, or for loss of data or profit arising from use of the free service. Nothing here limits liability that cannot be limited by law.',
          ],
        },
        {
          heading: '9. Changes to these terms and governing law',
          paragraphs: [
            'We may update these terms; the date above shows the latest version, and material changes will be announced in the product. Continuing to use the service means you accept the update. These terms are governed by the laws of Vietnam.',
          ],
        },
        { heading: '10. Contact', paragraphs: [`${name} — ${email}`] },
      ],
    };
  }
  return {
    title: 'Điều khoản sử dụng',
    updated: UPDATED,
    intro: `Điều khoản này điều chỉnh việc bạn sử dụng PMTool — dịch vụ quản lý dự án do ${name} ("chúng tôi") vận hành. Khi tạo tài khoản hoặc sử dụng dịch vụ, bạn đồng ý với các điều khoản này.`,
    sections: [
      {
        heading: '1. Dịch vụ',
        paragraphs: [
          'PMTool giúp nhóm lập kế hoạch và theo dõi dự án (phạm vi, cấu trúc phân rã công việc, công việc, giao phẩm, rủi ro) trong các không gian làm việc chung gọi là tổ chức. Hiện tại dịch vụ được cung cấp miễn phí.',
        ],
      },
      {
        heading: '2. Tài khoản của bạn',
        bullets: [
          'Bạn cung cấp thông tin chính xác và giữ bí mật mật khẩu; bạn chịu trách nhiệm về hoạt động dưới tài khoản của mình.',
          'Mỗi tài khoản dành cho một người. Bạn được sở hữu một số lượng tổ chức giới hạn như hiển thị trong sản phẩm.',
          'Hãy báo ngay cho chúng tôi nếu nghi ngờ tài khoản bị truy cập trái phép.',
        ],
      },
      {
        heading: '3. Nội dung của bạn',
        paragraphs: [
          'Bạn giữ mọi quyền đối với nội dung đưa vào PMTool (công việc, bình luận, tài liệu, artifact). Bạn cấp cho chúng tôi quyền hạn chế cần thiết để lưu trữ, hiển thị và xử lý nội dung đó nhằm vận hành dịch vụ cho bạn và những người bạn mời.',
          'Owner và Admin của tổ chức quyết định ai được xem và chỉnh sửa tổ chức đó. Người bạn mời sẽ thấy nội dung tổ chức trong phạm vi vai trò của họ.',
        ],
      },
      {
        heading: '4. Sử dụng chấp nhận được',
        bullets: [
          'Không vi phạm pháp luật, xâm phạm quyền của người khác hoặc tải lên nội dung bạn không có quyền chia sẻ.',
          'Không tấn công, làm quá tải hay dò quét dịch vụ, vượt qua các giới hạn, hoặc dùng công cụ tự động để tạo tài khoản hay tiêu thụ trợ lý AI.',
          'Các "artifact" HTML/JS tự viết không được tìm cách thoát khỏi môi trường cách ly, thu thập dữ liệu của người khác hoặc chạy mã độc.',
          'Chúng tôi có thể tạm khoá tài khoản lạm dụng dịch vụ.',
        ],
      },
      {
        heading: '5. Trợ lý AI và tích hợp',
        paragraphs: [
          'Tính năng AI gửi đoạn văn bản bạn chọn (ví dụ tiêu đề và mô tả công việc) tới nhà cung cấp AI của chúng tôi để tạo gợi ý. Gợi ý có thể sai; bạn quyết định chấp nhận gì. Lượt dùng có hạn mức theo tổ chức mỗi ngày.',
          'Nếu bạn liên kết Telegram, thông báo về công việc của bạn được gửi qua Telegram.',
        ],
      },
      {
        heading: '6. Dịch vụ miễn phí, tính sẵn sàng và thay đổi',
        paragraphs: [
          'Dịch vụ được cung cấp miễn phí và "nguyên trạng". Chúng tôi nỗ lực giữ dịch vụ hoạt động và dữ liệu an toàn nhưng không cam kết dịch vụ không gián đoạn. Chúng tôi có thể thay đổi hoặc ngừng tính năng và có thể giới thiệu gói trả phí trong tương lai; chúng tôi sẽ báo trước hợp lý về mọi thay đổi ảnh hưởng đến tính năng bạn đang dùng, và bạn luôn có thể xuất dữ liệu của mình.',
        ],
      },
      {
        heading: '7. Chấm dứt sử dụng',
        paragraphs: [
          'Bạn có thể xuất dữ liệu và xoá tài khoản bất cứ lúc nào trong phần Cài đặt. Chúng tôi có thể tạm khoá hoặc đóng tài khoản vi phạm điều khoản này.',
        ],
      },
      {
        heading: '8. Giới hạn trách nhiệm',
        paragraphs: [
          'Trong phạm vi pháp luật cho phép, chúng tôi không chịu trách nhiệm về thiệt hại gián tiếp, hệ quả, mất dữ liệu hay mất lợi nhuận phát sinh từ việc sử dụng dịch vụ miễn phí. Không nội dung nào ở đây giới hạn trách nhiệm mà pháp luật không cho phép giới hạn.',
        ],
      },
      {
        heading: '9. Thay đổi điều khoản và luật áp dụng',
        paragraphs: [
          'Chúng tôi có thể cập nhật điều khoản; ngày ở trên là phiên bản mới nhất và thay đổi quan trọng sẽ được thông báo trong sản phẩm. Tiếp tục sử dụng dịch vụ nghĩa là bạn chấp nhận bản cập nhật. Điều khoản này chịu sự điều chỉnh của pháp luật Việt Nam.',
        ],
      },
      { heading: '10. Liên hệ', paragraphs: [`${name} — ${email}`] },
    ],
  };
}

export function privacyDocument(locale: LegalLocale): LegalDocument {
  const { name, email } = operatorInfo();
  if (locale === 'en') {
    return {
      title: 'Privacy policy',
      updated: UPDATED,
      intro: `This policy explains what personal data PMTool collects, why, who receives it and what rights you have. The data controller is ${name}.`,
      sections: [
        {
          heading: '1. Data we collect',
          bullets: [
            'Account data: name, email, password (stored only as a salted hash), language and theme preferences, chosen mascot, avatar if any.',
            'Content you create: organizations, projects, tasks, comments, risks, documents, artifacts and similar records, plus who created or changed them.',
            'Usage data: activity log entries (who did what, when), points and streaks, and technical data such as IP address and browser type for security and abuse prevention.',
            'Telegram data if you link it: your chat identifier, used only to send you notifications.',
          ],
        },
        {
          heading: '2. Why we use it',
          bullets: [
            'To provide the service you asked for (contract).',
            'To keep the service secure and prevent abuse, including rate limiting (legitimate interest).',
            'To send service emails such as password reset, email verification and invitations.',
            'To improve the product using aggregate usage information — we do not sell personal data or show ads.',
          ],
        },
        {
          heading: '3. Who receives data',
          bullets: [
            'People in your organizations, according to their role.',
            'Infrastructure providers that host the service and send email.',
            'Our AI provider, only when you use an AI feature: the text you submit for that request.',
            'Telegram, only if you link it, to deliver notifications.',
            'Authorities, when the law requires it.',
          ],
        },
        {
          heading: '4. Cookies and local storage',
          paragraphs: [
            'We use only what the service needs: a secure session cookie (refresh token), your language and theme choice, and interface preferences stored in your browser. We do not use advertising or cross-site tracking cookies.',
          ],
        },
        {
          heading: '5. Retention',
          paragraphs: [
            'We keep your data while your account exists. When you delete your account we remove you from all organizations, erase your personal records and anonymize your profile; content you wrote in shared workspaces remains under "Deleted user" so that other people’s projects stay intact. Organizations where you are the only member are deleted. Backups are overwritten on their normal rotation.',
          ],
        },
        {
          heading: '6. Your rights',
          bullets: [
            'Access and portability: download your data from Settings → Data & privacy (organization owners/admins can export the organization).',
            'Correction: edit your profile and content in the product.',
            'Erasure: delete your account from the same page.',
            'Withdraw consent, object or ask for restriction: contact us below.',
          ],
        },
        {
          heading: '7. Security',
          paragraphs: [
            'Passwords are hashed with argon2id; sessions use short-lived tokens; each organization’s data is isolated at the application level; user-written HTML runs in a sandbox. No system is perfectly secure — please use a strong, unique password.',
          ],
        },
        {
          heading: '8. International transfers',
          paragraphs: [
            'Some providers (hosting, email, AI) may process data outside Vietnam. We choose providers that protect data appropriately and use them only for the purposes above.',
          ],
        },
        {
          heading: '9. Children',
          paragraphs: ['PMTool is not intended for children under 16.'],
        },
        {
          heading: '10. Changes and contact',
          paragraphs: [
            'We will announce material changes in the product. Questions or requests: ' + `${name} — ${email}.`,
          ],
        },
      ],
    };
  }
  return {
    title: 'Chính sách quyền riêng tư',
    updated: UPDATED,
    intro: `Chính sách này giải thích PMTool thu thập dữ liệu cá nhân nào, vì sao, ai nhận dữ liệu và bạn có những quyền gì. Bên kiểm soát dữ liệu là ${name}.`,
    sections: [
      {
        heading: '1. Dữ liệu chúng tôi thu thập',
        bullets: [
          'Dữ liệu tài khoản: họ tên, email, mật khẩu (chỉ lưu dạng băm có muối), tuỳ chọn ngôn ngữ và giao diện, nhân vật đồng hành, ảnh đại diện nếu có.',
          'Nội dung bạn tạo: tổ chức, dự án, công việc, bình luận, rủi ro, tài liệu, artifact và các bản ghi tương tự, kèm ai tạo/sửa.',
          'Dữ liệu sử dụng: nhật ký hoạt động (ai làm gì, khi nào), điểm và chuỗi ngày, cùng dữ liệu kỹ thuật như địa chỉ IP và loại trình duyệt để bảo mật và chống lạm dụng.',
          'Dữ liệu Telegram nếu bạn liên kết: mã định danh cuộc trò chuyện, chỉ dùng để gửi thông báo cho bạn.',
        ],
      },
      {
        heading: '2. Mục đích sử dụng',
        bullets: [
          'Cung cấp dịch vụ bạn yêu cầu (thực hiện hợp đồng).',
          'Giữ dịch vụ an toàn và ngăn lạm dụng, bao gồm giới hạn tốc độ (lợi ích chính đáng).',
          'Gửi email dịch vụ như đặt lại mật khẩu, xác minh email và lời mời.',
          'Cải thiện sản phẩm từ thông tin sử dụng tổng hợp — chúng tôi không bán dữ liệu cá nhân và không hiển thị quảng cáo.',
        ],
      },
      {
        heading: '3. Ai nhận dữ liệu',
        bullets: [
          'Những người trong tổ chức của bạn, theo vai trò của họ.',
          'Nhà cung cấp hạ tầng lưu trữ dịch vụ và gửi email.',
          'Nhà cung cấp AI của chúng tôi, chỉ khi bạn dùng tính năng AI: đoạn văn bản bạn gửi cho yêu cầu đó.',
          'Telegram, chỉ khi bạn liên kết, để chuyển thông báo.',
          'Cơ quan có thẩm quyền khi pháp luật yêu cầu.',
        ],
      },
      {
        heading: '4. Cookie và lưu trữ cục bộ',
        paragraphs: [
          'Chúng tôi chỉ dùng những gì dịch vụ cần: cookie phiên bảo mật (refresh token), lựa chọn ngôn ngữ và giao diện, và tuỳ chọn giao diện lưu trong trình duyệt. Chúng tôi không dùng cookie quảng cáo hay theo dõi chéo trang.',
        ],
      },
      {
        heading: '5. Thời gian lưu trữ',
        paragraphs: [
          'Chúng tôi lưu dữ liệu của bạn khi tài khoản còn tồn tại. Khi bạn xoá tài khoản, chúng tôi gỡ bạn khỏi mọi tổ chức, xoá bản ghi cá nhân và ẩn danh hồ sơ; nội dung bạn đã viết trong không gian chung được giữ dưới tên "Người dùng đã xoá" để dự án của người khác không bị hỏng. Tổ chức chỉ có mình bạn sẽ bị xoá. Bản sao lưu được ghi đè theo chu kỳ luân phiên thông thường.',
        ],
      },
      {
        heading: '6. Quyền của bạn',
        bullets: [
          'Truy cập và di chuyển dữ liệu: tải dữ liệu tại Cài đặt → Dữ liệu & quyền riêng tư (Owner/Admin có thể xuất dữ liệu tổ chức).',
          'Chỉnh sửa: sửa hồ sơ và nội dung ngay trong sản phẩm.',
          'Xoá: xoá tài khoản tại cùng trang đó.',
          'Rút lại đồng ý, phản đối hoặc yêu cầu hạn chế xử lý: liên hệ chúng tôi theo thông tin bên dưới.',
        ],
      },
      {
        heading: '7. Bảo mật',
        paragraphs: [
          'Mật khẩu được băm bằng argon2id; phiên dùng token ngắn hạn; dữ liệu mỗi tổ chức được cách ly ở tầng ứng dụng; HTML do người dùng viết chạy trong môi trường cách ly. Không hệ thống nào an toàn tuyệt đối — hãy dùng mật khẩu mạnh và riêng biệt.',
        ],
      },
      {
        heading: '8. Chuyển dữ liệu ra nước ngoài',
        paragraphs: [
          'Một số nhà cung cấp (lưu trữ, email, AI) có thể xử lý dữ liệu ngoài Việt Nam. Chúng tôi chọn nhà cung cấp bảo vệ dữ liệu phù hợp và chỉ dùng cho các mục đích nêu trên.',
        ],
      },
      { heading: '9. Trẻ em', paragraphs: ['PMTool không dành cho trẻ em dưới 16 tuổi.'] },
      {
        heading: '10. Thay đổi và liên hệ',
        paragraphs: [
          `Chúng tôi sẽ thông báo thay đổi quan trọng trong sản phẩm. Câu hỏi hoặc yêu cầu: ${name} — ${email}.`,
        ],
      },
    ],
  };
}
