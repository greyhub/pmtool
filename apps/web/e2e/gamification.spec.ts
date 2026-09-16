import { test, expect } from '@playwright/test';
import { makeUser, makeOrg, makeProject, registerUser, createOrganization, createProject } from './helpers';

test('completing a task awards points visible on the leaderboard', async ({ page }) => {
  const user = makeUser('gamify');
  await registerUser(page, user);
  const org = makeOrg('gamify');
  await createOrganization(page, org);
  const project = makeProject('GF');
  await page.goto(`/vi/${org.slug}/projects`);
  await createProject(page, project);

  await page.getByRole('button', { name: 'Thêm công việc', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Tiêu đề').fill('Công việc tính điểm');
  await dialog.getByRole('button', { name: 'Tạo công việc' }).click();
  await expect(page.getByText('Công việc tính điểm')).toBeVisible();

  await page.getByText('Công việc tính điểm').first().click();
  await page.waitForURL(/\/tasks\/.+/);
  // Scope to <main> to avoid matching the TopBar's locale-switcher <select>.
  await page.locator('main select').first().selectOption('DONE');

  await page.goto(`/vi/${org.slug}/leaderboard`);
  const row = page.getByRole('row', { name: new RegExp(user.fullName) });
  await expect(row).toBeVisible();
  await expect(row.getByText('15')).toBeVisible();
});
