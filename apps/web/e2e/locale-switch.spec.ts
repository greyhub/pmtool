import { test, expect } from '@playwright/test';
import { makeUser, makeOrg, registerUser, createOrganization } from './helpers';

test('switching locale updates the UI and persists across navigation', async ({ page }) => {
  const user = makeUser('locale');
  await registerUser(page, user);
  const org = makeOrg('locale');
  await createOrganization(page, org);

  await expect(page.getByText('Tổng quan tổ chức')).toBeVisible();

  await page.getByLabel('Ngôn ngữ / Language').selectOption('en');
  await expect(page).toHaveURL(new RegExp(`/en/${org.slug}/dashboard`));
  await expect(page.getByText('Organization dashboard')).toBeVisible();

  // Visiting a localeless URL should now redirect to the chosen locale via
  // the NEXT_LOCALE cookie next-intl's middleware sets on switch.
  await page.goto('/');
  await expect(page).toHaveURL(/\/en(\/|$)/);

  // Switching back to Vietnamese from the (still-authenticated) dashboard.
  await page.goto(`/en/${org.slug}/dashboard`);
  await page.getByLabel('Ngôn ngữ / Language').selectOption('vi');
  await expect(page.getByText('Tổng quan tổ chức')).toBeVisible();
});
