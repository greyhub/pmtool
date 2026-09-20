import { test, expect, type Browser } from '@playwright/test';
import { makeOrg, makeProject, makeUser, registerUser, createOrganization, createProject } from './helpers';

/** Registers a second user, invites them with `role`, and returns their logged-in page. */
async function joinAs(browser: Browser, ownerPage: import('@playwright/test').Page, orgSlug: string, role: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const user = makeUser(role.toLowerCase());
  await registerUser(page, user);

  await ownerPage.goto(`/vi/${orgSlug}/settings`);
  await ownerPage.getByLabel('Email').fill(user.email);
  await ownerPage.getByLabel('Vai trò').selectOption(role);
  await ownerPage.getByRole('button', { name: 'Gửi lời mời' }).click();
  const linkText = await ownerPage.getByText(/\/invite\/accept\?token=/).textContent();
  const token = linkText?.split('token=')[1]?.trim();

  await page.goto(`/vi/invite/accept?token=${token}`);
  await page.getByRole('button', { name: 'Chấp nhận lời mời' }).click();
  await page.waitForURL(new RegExp(`${orgSlug}/dashboard`), { timeout: 10_000 });
  return page;
}

test('a taken character is marked and disabled, and a viewer sees a read-only project', async ({ browser }) => {
  const ownerCtx = await browser.newContext();
  const ownerPage = await ownerCtx.newPage();
  await registerUser(ownerPage, makeUser('roles'));
  const org = makeOrg('roles');
  await createOrganization(ownerPage, org);
  const project = makeProject('RL');
  await ownerPage.goto(`/vi/${org.slug}/projects`);
  await createProject(ownerPage, project);

  // Owner picks the bear: it is marked as in use for them.
  await ownerPage.goto('/vi/settings');
  await ownerPage.getByRole('button', { name: /^Gấu( —|$)/ }).click();
  await expect(ownerPage.getByRole('button', { name: /^Gấu( —|$)/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(ownerPage.getByText('Đang dùng')).toBeVisible();

  // A viewer joins the org: the bear is disabled and says so, everything else is still pickable.
  const viewerPage = await joinAs(browser, ownerPage, org.slug, 'VIEWER');
  await viewerPage.goto('/vi/settings');
  const bear = viewerPage.getByRole('button', { name: /^Gấu( —|$)/ });
  await expect(bear).toBeDisabled();
  await expect(bear).toContainText('Đã có người chọn');
  await expect(viewerPage.getByRole('button', { name: 'Thỏ', exact: true })).toBeEnabled();

  // Read-only project for the viewer: notice shown, no way to add work or edit management docs.
  const base = `/vi/${org.slug}/projects/${project.key}`;
  await viewerPage.goto(`${base}/tasks`);
  await expect(viewerPage.getByText('Bạn chỉ có quyền xem trong dự án này.')).toBeVisible();
  await expect(viewerPage.getByRole('button', { name: 'Thêm công việc', exact: true })).toHaveCount(0);

  await viewerPage.goto(`${base}/charter`);
  await expect(viewerPage.getByRole('button', { name: 'Lưu', exact: true })).toHaveCount(0);
  await expect(viewerPage.getByLabel('Mục đích')).toBeDisabled();

  await viewerPage.goto(`${base}/scope`);
  await expect(viewerPage.getByRole('button', { name: 'Phê duyệt phạm vi' })).toHaveCount(0);
  await expect(viewerPage.getByLabel('Trong phạm vi')).toBeDisabled();

  // The owner is not read-only.
  await ownerPage.goto(`${base}/scope`);
  await expect(ownerPage.getByText('Bạn chỉ có quyền xem')).toHaveCount(0);
  await expect(ownerPage.getByLabel('Trong phạm vi')).toBeEnabled();
});
