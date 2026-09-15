import { test, expect } from '@playwright/test';
import { makeUser, registerUser } from './helpers';

test('register, log out, then log back in with the same credentials', async ({ page }) => {
  const user = makeUser('auth');
  await registerUser(page, user);

  // Registering lands a brand-new account on onboarding (no org yet).
  await expect(page.getByText('Tạo tổ chức của bạn')).toBeVisible();

  await page.goto('/vi/login');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Mật khẩu').fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  // No org yet -> login redirects to onboarding too.
  await page.waitForURL(/onboarding\/create-organization/, { timeout: 15_000 });
});

test('rejects login with the wrong password', async ({ page }) => {
  const user = makeUser('authbad');
  await registerUser(page, user);

  await page.goto('/vi/login');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Mật khẩu').fill('WrongPassword123!');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(/\/login/);
});
