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

test('updating a task\'s % complete finishes the progress-update quest, and logging back in finishes the login quest', async ({ page }) => {
  const user = makeUser('quests');
  await registerUser(page, user);
  const org = makeOrg('quests');
  await createOrganization(page, org);
  const project = makeProject('QE');
  await page.goto(`/vi/${org.slug}/projects`);
  await createProject(page, project);

  await page.getByRole('button', { name: 'Thêm công việc', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Tiêu đề').fill('Việc cần cập nhật tiến độ');
  await dialog.getByRole('button', { name: 'Tạo công việc' }).click();
  await expect(page.getByText('Việc cần cập nhật tiến độ')).toBeVisible();

  await page.getByText('Việc cần cập nhật tiến độ').first().click();
  await page.waitForURL(/\/tasks\/.+/);
  const percentInput = page.getByRole('spinbutton');
  await percentInput.fill('40');
  await percentInput.blur();

  await page.goto(`/vi/${org.slug}/leaderboard`);
  const questsPanel = page.getByText('Nhiệm vụ của tôi').locator('..');
  await expect(questsPanel.getByText('Cập nhật tiến độ')).toBeVisible();
  await expect(questsPanel.getByText('Đã hoàn thành').first()).toBeVisible();
  // The login quest is not yet complete — registering doesn't count as a login.
  await expect(questsPanel.getByText('Điểm danh')).toBeVisible();

  // Log out and back in through the real login form — this is what actually triggers the login quest.
  await page.getByLabel(/Menu tài khoản/).click();
  await page.getByRole('menuitem', { name: 'Đăng xuất' }).click();
  await page.waitForURL(/\/login/);
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Mật khẩu').fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL(/dashboard/, { timeout: 15_000 });

  await page.goto(`/vi/${org.slug}/leaderboard`);
  const questsAfterLogin = page.getByText('Nhiệm vụ của tôi').locator('..');
  // Both quests (progress update from before, login from just now) are now complete.
  await expect(questsAfterLogin.getByText('Đã hoàn thành')).toHaveCount(2);
});
