import { test, expect } from '@playwright/test';
import {
  makeOrg,
  makeProject,
  makeUser,
  registerUser,
  createOrganization,
  createProject,
} from './helpers';

test('editing project fields, granting a project-scoped role override, and the override actually changes what the member can do', async ({
  browser,
  page,
}) => {
  const owner = makeUser('projsettings');
  await registerUser(page, owner);
  const org = makeOrg('projsettings');
  await createOrganization(page, org);
  const projectA = makeProject('PSA');
  await page.goto(`/vi/${org.slug}/projects`);
  await createProject(page, projectA);
  const projectB = makeProject('PSB');
  await page.goto(`/vi/${org.slug}/projects`);
  await createProject(page, projectB);

  // Edit Project A's general info.
  await page.goto(`/vi/${org.slug}/projects/${projectA.key}/settings`);
  await expect(page.getByRole('heading', { name: 'Cài đặt dự án' })).toBeVisible();
  await page.getByLabel('Mô tả').fill('Mô tả cập nhật qua E2E');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByText('Mô tả cập nhật qua E2E')).toBeVisible();

  // Invite a second, real user into the org as a plain VIEWER (the strictest
  // role — excluded from every CAN_EDIT_* set — so any success below can
  // only come from the project-level override, not their org role).
  const memberCtx = await browser.newContext();
  const memberPage = await memberCtx.newPage();
  const member = makeUser('projsettingsmember');
  await registerUser(memberPage, member);

  await page.goto(`/vi/${org.slug}/settings`);
  await page.getByLabel('Email').fill(member.email);
  await page.getByLabel('Vai trò').selectOption('VIEWER');
  await page.getByRole('button', { name: 'Gửi lời mời' }).click();
  const linkText = await page.getByText(/\/invite\/accept\?token=/).textContent();
  const token = linkText?.split('token=')[1]?.trim();
  expect(token).toBeTruthy();

  await memberPage.goto(`/vi/invite/accept?token=${token}`);
  await memberPage.getByRole('button', { name: 'Chấp nhận lời mời' }).click();
  await memberPage.waitForURL(new RegExp(`${org.slug}/dashboard`), { timeout: 15_000 });

  // Grant the member a PM override on Project A only.
  await page.goto(`/vi/${org.slug}/projects/${projectA.key}/settings`);
  await expect(page.getByText('Vai trò riêng trong dự án')).toBeVisible();
  const memberOptionValue = await page
    .getByLabel('Thêm thành viên')
    .locator('option', { hasText: member.email })
    .getAttribute('value');
  expect(memberOptionValue).toBeTruthy();
  await page.getByLabel('Thêm thành viên').selectOption(memberOptionValue!);
  await page.getByLabel('Vai trò').selectOption('PM');
  await page.getByRole('button', { name: 'Thêm' }).click();
  await expect(page.getByText(member.email)).toBeVisible();
  await expect(page.locator('tr', { hasText: member.email }).getByRole('combobox')).toHaveValue('PM');

  // The member (plain org VIEWER) can now create a task on Project A...
  await memberPage.goto(`/vi/${org.slug}/projects/${projectA.key}/tasks`);
  await memberPage.getByRole('button', { name: 'Thêm công việc', exact: true }).click();
  await memberPage.getByLabel('Tiêu đề').fill('Task created via project-level PM override');
  await memberPage.getByRole('button', { name: 'Tạo công việc', exact: true }).click();
  await expect(memberPage.getByText('Task created via project-level PM override')).toBeVisible();

  // ...but is still blocked on Project B, where they have no override and
  // remain a plain org VIEWER — proves the grant is scoped to Project A only.
  // The UI reflects the role: no create button, and a read-only notice.
  await memberPage.goto(`/vi/${org.slug}/projects/${projectB.key}/tasks`);
  await expect(memberPage.getByText('Bạn chỉ có quyền xem trong dự án này.')).toBeVisible();
  await expect(memberPage.getByRole('button', { name: 'Thêm công việc', exact: true })).toHaveCount(0);

  // Removing the override reverts them to their org role (VIEWER) on Project A too.
  // (The project creator/owner keeps their own auto-created OWNER row — this
  // only removes the member's override, not the whole list. And once removed,
  // the member becomes a candidate again in the "Thêm thành viên" dropdown, so
  // scope this assertion to the table, not the whole page.)
  await page.goto(`/vi/${org.slug}/projects/${projectA.key}/settings`);
  await page.locator('tr', { hasText: member.email }).getByRole('button', { name: 'Xoá' }).click();
  await expect(page.locator('table').getByText(member.email)).toHaveCount(0);

  await memberPage.goto(`/vi/${org.slug}/projects/${projectA.key}/tasks`);
  await expect(memberPage.getByText('Bạn chỉ có quyền xem trong dự án này.')).toBeVisible();
  await expect(memberPage.getByRole('button', { name: 'Thêm công việc', exact: true })).toHaveCount(0);

  await memberCtx.close();
});
