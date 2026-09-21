import { test, expect } from '@playwright/test';
import { makeOrg, makeProject, makeUser, registerUser, createOrganization, createProject } from './helpers';

const API = 'http://localhost:3001/api/v1';

test('tidies legacy tasks into WBS levels: by depth with a preview, and by selection with validation', async ({
  page,
  request,
}) => {
  const user = makeUser('bulk');
  await registerUser(page, user);
  const org = makeOrg('bulk');
  await createOrganization(page, org);
  const project = makeProject('BK');
  await page.goto(`/vi/${org.slug}/projects`);
  await createProject(page, project);

  // Older-style data: a tree created without levels, plus a loose task.
  const { accessToken } = (
    (await (await request.post(`${API}/auth/login`, { data: user })).json()) as { data: { accessToken: string } }
  ).data;
  const headers = { Authorization: `Bearer ${accessToken}` };
  const add = async (title: string, parentTaskId?: string) =>
    (
      (await (
        await request.post(`${API}/organizations/${org.slug}/projects/${project.key}/tasks`, {
          headers,
          data: { title, parentTaskId },
        })
      ).json()) as { data: { id: string } }
    ).data.id;
  const root = await add('Gốc cũ');
  const child = await add('Nhánh cũ', root);
  await add('Lá cũ', child);
  await add('Việc lẻ cũ');

  await page.goto(`/vi/${org.slug}/projects/${project.key}/wbs`);
  const tree = page.getByTestId('wbs-tree');
  await expect(tree.getByText('Gốc cũ')).toBeVisible();

  // By depth: preview first, then apply.
  await page.getByRole('button', { name: 'Gán cấp theo độ sâu' }).click();
  const dialog = page.getByRole('dialog');
  const preview = dialog.getByTestId('auto-level-preview');
  await expect(preview).toContainText('công việc sẽ đổi cấp');
  await expect(preview.getByText('Giai đoạn')).toBeVisible();
  await dialog.getByRole('button', { name: /^Đổi \d+ công việc$/ }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Mở hết' }).click();
  await expect(tree.locator(':scope > li').filter({ hasText: 'Gốc cũ' })).toContainText('Giai đoạn');
  await expect(tree.locator(':scope > li').filter({ hasText: 'Nhánh cũ' })).toContainText('Giao phẩm');
  await expect(tree.locator(':scope > li').filter({ hasText: 'Lá cũ' })).toContainText('Hoạt động');

  // Nothing left to change.
  await page.getByRole('button', { name: 'Gán cấp theo độ sâu' }).click();
  await expect(page.getByTestId('auto-level-preview')).toContainText('không có gì thay đổi');
  await page.getByRole('dialog').getByRole('button', { name: 'Huỷ' }).click();

  // Selection mode: an invalid change is refused with the reason, a valid one applies.
  await page.getByRole('button', { name: 'Chọn nhiều' }).click();
  const bar = page.getByTestId('bulk-bar');
  await tree.getByRole('checkbox', { name: /Gốc cũ/ }).check();
  await bar.getByLabel('Đổi cấp thành').selectOption('ACTIVITY');
  await bar.getByRole('button', { name: 'Áp dụng' }).click();
  await expect(bar.getByRole('alert')).toContainText('không thể nằm trong');

  await tree.getByRole('checkbox', { name: /Gốc cũ/ }).uncheck();
  await tree.getByRole('checkbox', { name: /Việc lẻ cũ/ }).check();
  await bar.getByLabel('Đổi cấp thành').selectOption('DELIVERABLE');
  await bar.getByRole('button', { name: 'Áp dụng' }).click();
  await expect(page.getByTestId('bulk-bar')).toHaveCount(0);
  await expect(tree.locator(':scope > li').filter({ hasText: 'Việc lẻ cũ' })).toContainText('Giao phẩm');
});
