import {
  inviteMail,
  passwordResetMail,
  verifyEmailMail,
} from './mail-templates';

describe('mail templates', () => {
  it('puts the link in both the text and the HTML, in the requested language', () => {
    const vi = passwordResetMail(
      'vi',
      'https://app.example/vi/reset-password?token=abc',
      60,
    );
    expect(vi.subject).toContain('mật khẩu');
    expect(vi.text).toContain(
      'https://app.example/vi/reset-password?token=abc',
    );
    expect(vi.html).toContain(
      'href="https://app.example/vi/reset-password?token=abc"',
    );
    expect(vi.text).toContain('60 phút');

    const en = verifyEmailMail(
      'en',
      'https://app.example/en/verify-email?token=x',
      'Ann',
    );
    expect(en.subject).toContain('Verify');
    expect(en.text).toContain('Hi Ann');
  });

  it('escapes user-controlled text so a name cannot inject markup', () => {
    const mail = inviteMail(
      'en',
      'https://x.test/?a=1&b=2',
      '<script>alert(1)</script>',
      'Org "A" & Co',
      'MEMBER',
    );
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
    expect(mail.html).toContain('Org &quot;A&quot; &amp; Co');
    expect(mail.html).toContain('a=1&amp;b=2');
  });
});
