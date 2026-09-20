import { test, expect } from '@playwright/test';

test('the Google button appears only when the server enables it, and points at the API start URL', async ({ page }) => {
  // Not configured (the dev/CI default): no button.
  await page.goto('/vi/login');
  await expect(page.getByRole('button', { name: 'Đăng nhập' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Tiếp tục với Google' })).toHaveCount(0);

  // Configured: the button shows on both pages and carries the locale and safe redirect.
  await page.route('**/api/v1/auth/google/config', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { enabled: true } }) }),
  );
  await page.goto('/vi/login?redirect=%2Fvi%2Finvite%2Faccept%3Ftoken%3Dabc');
  const button = page.getByRole('link', { name: 'Tiếp tục với Google' });
  await expect(button).toBeVisible();
  const href = (await button.getAttribute('href'))!;
  expect(href).toContain('/api/v1/auth/google/start?');
  const params = new URL(href).searchParams;
  expect(params.get('locale')).toBe('vi');
  expect(params.get('redirect')).toBe('/vi/invite/accept?token=abc');

  await page.goto('/en/register');
  await expect(page.getByRole('link', { name: 'Sign up with Google' })).toBeVisible();

  // A failed Google round trip lands on the login page with an explanation.
  await page.goto('/vi/login?error=google');
  await expect(page.locator('p[role="alert"]')).toContainText('Đăng nhập bằng Google không thành công');

  // Opening the completion page without having gone through Google explains itself instead of hanging.
  await page.context().clearCookies();
  await page.goto('/vi/auth/google-done');
  await expect(page.locator('p[role="alert"]')).toContainText('Không hoàn tất được đăng nhập bằng Google');
});
