import { test, expect } from '@playwright/test';
import { makeUser, registerUser } from './helpers';

// TELEGRAM_BOT_TOKEN is not configured in the test/CI environment (same as
// ANTHROPIC_API_KEY for the AI features), so a live link-code round-trip
// isn't reachable here. This verifies the settings page renders outside the
// org-scoped route tree and that the connect flow surfaces the server's
// "not configured" error gracefully instead of crashing.
test('settings page renders and the Telegram card surfaces a graceful error when unconfigured', async ({ page }) => {
  const user = makeUser('settings');
  await registerUser(page, user);

  await page.goto('/vi/settings');
  await expect(page.getByRole('heading', { name: 'Telegram' })).toBeVisible();

  await page.getByRole('button', { name: 'Kết nối Telegram' }).click();
  await expect(page.getByText('Không thể tạo mã liên kết. Vui lòng thử lại.')).toBeVisible();
});
