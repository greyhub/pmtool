import { test, expect } from '@playwright/test';
import { makeUser, makeOrg, registerUser, createOrganization } from './helpers';

// ThemeSwitcher only lives in the authenticated org shell's TopBar, and
// next-themes' `system` default would otherwise depend on the OS color
// scheme — pin it so the starting state is deterministic.
test.use({ colorScheme: 'light' });

test('toggling to dark theme persists across a reload', async ({ page }) => {
  const user = makeUser('theme');
  await registerUser(page, user);
  const org = makeOrg('theme');
  await createOrganization(page, org);

  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'light');

  await page.getByRole('button', { name: 'Chuyển sang giao diện tối' }).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');

  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');

  // Toggling back to light also persists.
  await page.getByRole('button', { name: 'Chuyển sang giao diện sáng' }).click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'light');
});
