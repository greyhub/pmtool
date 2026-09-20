export type MailLocale = 'vi' | 'en';

export interface MailContent {
  subject: string;
  text: string;
  html: string;
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ] ?? c,
  );

function layout(
  locale: MailLocale,
  heading: string,
  paragraphs: string[],
  cta: { label: string; url: string },
  footer: string,
): MailContent['html'] {
  return `<!doctype html><html lang="${locale}"><body style="margin:0;background:#f5f5f4;font-family:Arial,Helvetica,sans-serif;color:#1c1917">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;padding:28px">
<tr><td><div style="font-size:13px;font-weight:bold;color:#a16207;letter-spacing:.04em">PMTOOL</div>
<h1 style="font-size:20px;margin:12px 0 16px">${esc(heading)}</h1>
${paragraphs.map((p) => `<p style="font-size:14px;line-height:1.55;margin:0 0 14px">${esc(p)}</p>`).join('')}
<p style="margin:22px 0"><a href="${esc(cta.url)}" style="background:#facc15;color:#1c1917;text-decoration:none;font-weight:bold;font-size:14px;padding:11px 20px;border-radius:8px;display:inline-block">${esc(cta.label)}</a></p>
<p style="font-size:12px;color:#57534e;line-height:1.5;margin:0 0 6px">${esc(cta.url)}</p>
<p style="font-size:12px;color:#78716c;line-height:1.5;margin:14px 0 0">${esc(footer)}</p>
</td></tr></table></td></tr></table></body></html>`;
}

const T = {
  vi: {
    reset: {
      subject: 'Đặt lại mật khẩu PMTool',
      heading: 'Đặt lại mật khẩu',
      body: (mins: number) => [
        `Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Liên kết dưới đây có hiệu lực trong ${mins} phút và chỉ dùng được một lần.`,
      ],
      cta: 'Đặt mật khẩu mới',
      footer:
        'Nếu bạn không yêu cầu, hãy bỏ qua email này — mật khẩu của bạn vẫn an toàn.',
    },
    verify: {
      subject: 'Xác minh email PMTool',
      heading: 'Xác minh địa chỉ email',
      body: (name: string) => [
        `Xin chào ${name}, chào mừng bạn đến với PMTool.`,
        'Hãy xác nhận địa chỉ email để dùng đầy đủ tính năng (trợ lý AI, mời thành viên) và khôi phục được tài khoản khi cần.',
      ],
      cta: 'Xác minh email',
      footer:
        'Liên kết có hiệu lực trong 24 giờ. Nếu bạn không tạo tài khoản, hãy bỏ qua email này.',
    },
    invite: {
      subject: (org: string) => `Lời mời tham gia "${org}" trên PMTool`,
      heading: (org: string) => `Bạn được mời vào ${org}`,
      body: (inviter: string, org: string, role: string) => [
        `${inviter} mời bạn tham gia tổ chức "${org}" với vai trò ${role}.`,
      ],
      cta: 'Chấp nhận lời mời',
      footer:
        'Lời mời có hiệu lực trong 7 ngày và chỉ dành cho địa chỉ email này.',
    },
  },
  en: {
    reset: {
      subject: 'Reset your PMTool password',
      heading: 'Reset your password',
      body: (mins: number) => [
        `We received a request to reset the password of your account. The link below is valid for ${mins} minutes and can be used once.`,
      ],
      cta: 'Set a new password',
      footer:
        'If you did not ask for this, ignore this email — your password is still safe.',
    },
    verify: {
      subject: 'Verify your PMTool email',
      heading: 'Verify your email address',
      body: (name: string) => [
        `Hi ${name}, welcome to PMTool.`,
        'Confirm your email address to use every feature (AI assistant, inviting people) and to be able to recover your account.',
      ],
      cta: 'Verify email',
      footer:
        'The link is valid for 24 hours. If you did not create an account, ignore this email.',
    },
    invite: {
      subject: (org: string) => `You are invited to "${org}" on PMTool`,
      heading: (org: string) => `You are invited to ${org}`,
      body: (inviter: string, org: string, role: string) => [
        `${inviter} invited you to the organization "${org}" as ${role}.`,
      ],
      cta: 'Accept invitation',
      footer:
        'The invitation is valid for 7 days and only for this email address.',
    },
  },
} as const;

export function passwordResetMail(
  locale: MailLocale,
  url: string,
  ttlMinutes: number,
): MailContent {
  const t = T[locale].reset;
  const body = t.body(ttlMinutes);
  return {
    subject: t.subject,
    text: `${body.join('\n\n')}\n\n${url}\n\n${t.footer}`,
    html: layout(locale, t.heading, body, { label: t.cta, url }, t.footer),
  };
}

export function verifyEmailMail(
  locale: MailLocale,
  url: string,
  fullName: string,
): MailContent {
  const t = T[locale].verify;
  const body = t.body(fullName);
  return {
    subject: t.subject,
    text: `${body.join('\n\n')}\n\n${url}\n\n${t.footer}`,
    html: layout(locale, t.heading, body, { label: t.cta, url }, t.footer),
  };
}

export function inviteMail(
  locale: MailLocale,
  url: string,
  inviter: string,
  orgName: string,
  role: string,
): MailContent {
  const t = T[locale].invite;
  const body = t.body(inviter, orgName, role);
  return {
    subject: t.subject(orgName),
    text: `${body.join('\n\n')}\n\n${url}\n\n${t.footer}`,
    html: layout(
      locale,
      t.heading(orgName),
      body,
      { label: t.cta, url },
      t.footer,
    ),
  };
}
