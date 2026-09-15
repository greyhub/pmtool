import { test, expect } from '@playwright/test';
import { makeUser, makeOrg, registerUser, createOrganization } from './helpers';

test('creates an organization and lands on its dashboard', async ({ page }) => {
  const user = makeUser('orgcreate');
  await registerUser(page, user);

  const org = makeOrg('create');
  await createOrganization(page, org);

  await expect(page.getByText('Tổng quan tổ chức')).toBeVisible();
  await expect(page.getByText(org.name)).toBeVisible();

  // The org survives a reload — not just client-side onboarding state.
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`${org.slug}/dashboard`));
  await expect(page.getByText(org.name)).toBeVisible();
});
