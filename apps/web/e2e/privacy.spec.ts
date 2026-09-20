import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

const SHOTS = process.env.E2E_SHOTS_DIR;
import { makeOrg, makeUser, registerUser, createOrganization } from './helpers';

test('legal pages are public, and a person can download their data and then delete their account', async ({ page }) => {
  // Public legal pages, linked from sign-up.
  await page.goto('/vi/register');
  await expect(page.getByText('Bằng việc đăng ký, bạn đồng ý với')).toBeVisible();
  await page.getByRole('link', { name: 'Điều khoản sử dụng' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Điều khoản sử dụng' })).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/terms.png`, fullPage: true });
  await page.goto('/vi/privacy');
  await expect(page.getByRole('heading', { level: 1, name: 'Chính sách quyền riêng tư' })).toBeVisible();
  await expect(page.getByText('Quyền của bạn')).toBeVisible();
  await page.goto('/en/terms');
  await expect(page.getByRole('heading', { level: 1, name: 'Terms of use' })).toBeVisible();

  const user = makeUser('privacy');
  await registerUser(page, user);
  await createOrganization(page, makeOrg('privacy'));

  // Export: a JSON file with the person's own data.
  await page.goto('/vi/settings');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/settings-privacy.png`, fullPage: true });
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Tải dữ liệu của tôi' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^pmtool-du-lieu-cua-toi-\d{4}-\d{2}-\d{2}\.json$/);
  const exported = JSON.parse(await readFile((await download.path())!, 'utf-8'));
  expect(exported.profile.email).toBe(user.email);
  expect(exported.organizations).toHaveLength(1);
  expect(JSON.stringify(exported)).not.toContain('passwordHash');

  // Delete: needs the password; a wrong one is refused with the account intact.
  await page.getByRole('button', { name: 'Xoá tài khoản' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Mật khẩu hiện tại').fill('WrongPass123');
  await dialog.getByRole('button', { name: 'Xoá vĩnh viễn' }).click();
  await expect(dialog.getByText('Mật khẩu không đúng')).toBeVisible();
  await dialog.getByLabel('Mật khẩu hiện tại').fill(user.password);
  await dialog.getByRole('button', { name: 'Xoá vĩnh viễn' }).click();
  await page.waitForURL(/\/vi\/?$/);

  // The account is gone: signing in fails.
  await page.goto('/vi/login');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Mật khẩu').fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('không đúng');
});
