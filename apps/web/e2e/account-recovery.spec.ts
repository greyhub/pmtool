import { test, expect } from '@playwright/test';
import { makeOrg, makeUser, registerUser, createOrganization } from './helpers';

const SHOTS = process.env.E2E_SHOTS_DIR;

test('a new account sees the verify-email reminder; forgot-password answers generically; bad links explain themselves', async ({
  page,
}) => {
  const user = makeUser('recover');
  await registerUser(page, user);
  await createOrganization(page, makeOrg('recover'));

  // Unverified accounts get a reminder with a resend button.
  const banner = page.getByRole('status').filter({ hasText: 'xác minh email' });
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(user.email);
  await banner.getByRole('button', { name: 'Gửi lại email' }).click();
  await expect(banner.getByText('Đã gửi')).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/verify-banner.png` });

  // Forgot password: the same message whether or not the address has an account.
  await page.context().clearCookies();
  await page.goto('/vi/login');
  await page.getByRole('link', { name: 'Quên mật khẩu?' }).click();
  await expect(page).toHaveURL(/forgot-password/);
  await page.getByLabel('Email').fill('nobody-at-all@example.com');
  await page.getByRole('button', { name: 'Gửi liên kết' }).click();
  await expect(page.getByRole('status')).toContainText('Nếu email này có tài khoản');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/forgot-sent.png` });

  // A bogus reset link is refused, and password rules are checked before submitting.
  await page.goto('/vi/reset-password?token=not-a-real-token');
  await page.getByLabel('Mật khẩu mới').fill('short');
  await page.getByLabel('Nhập lại mật khẩu').fill('short');
  await page.getByRole('button', { name: 'Đặt mật khẩu' }).click();
  await expect(page.locator('p[role="alert"]')).toBeVisible();
  await page.getByLabel('Mật khẩu mới').fill('GoodPass123');
  await page.getByLabel('Nhập lại mật khẩu').fill('GoodPass123');
  await page.getByRole('button', { name: 'Đặt mật khẩu' }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('không hợp lệ hoặc đã hết hạn');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/reset-error.png` });

  await page.goto('/vi/verify-email?token=not-a-real-token');
  await expect(page.locator('p[role="alert"]')).toContainText('không hợp lệ hoặc đã hết hạn');

  await page.goto('/vi/reset-password');
  await expect(page.locator('p[role="alert"]')).toContainText('thiếu mã');
});
