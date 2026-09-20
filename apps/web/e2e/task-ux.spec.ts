import { test, expect } from '@playwright/test';
import { makeUser, makeOrg, makeProject, registerUser, createOrganization, createProject } from './helpers';

test('filter the task list, change status inline, then edit title, dates and comment on the detail page', async ({ page }) => {
  const user = makeUser('taskux');
  await registerUser(page, user);
  const org = makeOrg('taskux');
  await createOrganization(page, org);
  const project = makeProject('TU');
  await page.goto(`/vi/${org.slug}/projects`);
  await createProject(page, project);

  for (const title of ['Thiết kế logo', 'Viết báo cáo']) {
    await page.getByRole('button', { name: 'Thêm công việc', exact: true }).click();
    await page.getByRole('dialog').getByLabel('Tiêu đề').fill(title);
    await page.getByRole('dialog').getByRole('button', { name: 'Tạo công việc' }).click();
    await expect(page.getByRole('link', { name: title })).toBeVisible();
  }

  // Search ignores diacritics and reports the match count.
  await page.getByPlaceholder('Tìm theo tên hoặc mã…').fill('thiet ke');
  await expect(page.getByRole('link', { name: 'Thiết kế logo' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Viết báo cáo' })).toHaveCount(0);
  await expect(page.getByText('1/2 công việc')).toBeVisible();
  await page.getByRole('button', { name: 'Xoá bộ lọc' }).click();
  await expect(page.getByRole('link', { name: 'Viết báo cáo' })).toBeVisible();

  // Status changes right on the row, and the status filter then finds it.
  await page.getByRole('combobox', { name: `Trạng thái ${project.key}-1` }).selectOption('IN_PROGRESS');
  await page.getByLabel('Lọc theo trạng thái').selectOption('IN_PROGRESS');
  await expect(page.getByRole('link', { name: 'Thiết kế logo' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Viết báo cáo' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Xoá bộ lọc' }).click();

  await page.getByRole('link', { name: 'Thiết kế logo' }).click();
  await page.waitForURL(/\/tasks\/.+/);

  // Title is editable in place.
  await page.getByRole('heading', { name: 'Thiết kế logo' }).getByRole('button').click();
  await page.getByLabel('Bấm để sửa tiêu đề').fill('Thiết kế logo mới');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Thiết kế logo mới' })).toBeVisible();
  await expect(page.getByText('✓ Đã lưu')).toBeVisible();

  // Dates: a milestone needs a due date first; then its start locks to it.
  const milestone = page.getByLabel('Là mốc quan trọng');
  await expect(milestone).toBeDisabled();
  await page.getByLabel('Đến hạn').fill('2030-05-20');
  await expect(milestone).toBeEnabled();
  await page.getByLabel('Bắt đầu').fill('2030-05-25');
  await expect(page.getByText('Ngày bắt đầu phải trước hoặc bằng ngày đến hạn.')).toBeVisible();
  await page.getByLabel('Bắt đầu').fill('2030-05-10');
  await expect(page.getByText('Ngày bắt đầu phải trước hoặc bằng ngày đến hạn.')).toHaveCount(0);
  await milestone.click();
  await expect(milestone).toBeChecked();
  await expect(page.getByLabel('Bắt đầu')).toBeDisabled();
  await expect(page.getByLabel('Bắt đầu')).toHaveValue('2030-05-20');

  // Ctrl+Enter sends a comment, shown as relative time.
  await page.getByPlaceholder('Viết bình luận...').fill('Đã xong bản đầu');
  await page.getByPlaceholder('Viết bình luận...').press('Control+Enter');
  await expect(page.getByText('Đã xong bản đầu')).toBeVisible();
  await expect(page.locator('time').first()).toContainText(/giây|bây giờ|phút/);
});

test('group the list by status, step between tasks with j/k, and see the change in the task history', async ({ page }) => {
  const user = makeUser('taskux2');
  await registerUser(page, user);
  const org = makeOrg('taskux2');
  await createOrganization(page, org);
  const project = makeProject('TW');
  await page.goto(`/vi/${org.slug}/projects`);
  await createProject(page, project);

  for (const title of ['Việc A', 'Việc B', 'Việc C']) {
    await page.getByRole('button', { name: 'Thêm công việc', exact: true }).click();
    await page.getByRole('dialog').getByLabel('Tiêu đề').fill(title);
    await page.getByRole('dialog').getByRole('button', { name: 'Tạo công việc' }).click();
    await expect(page.getByRole('link', { name: title })).toBeVisible();
  }

  await page.getByRole('combobox', { name: `Trạng thái ${project.key}-2` }).selectOption('IN_PROGRESS');
  await page.getByLabel('Nhóm').selectOption('STATUS');
  await expect(page.getByRole('heading', { name: /Đang làm · 1/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Cần làm · 2/ })).toBeVisible();
  await page.getByLabel('Nhóm').selectOption('NONE');

  // Detail: j moves to the next task in list order, k back.
  await page.getByRole('link', { name: 'Việc A' }).click();
  await page.waitForURL(/\/tasks\/.+/);
  await expect(page.getByRole('heading', { name: 'Việc A' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Công việc sau: .*Việc B/ })).toBeVisible();
  await page.keyboard.press('j');
  await expect(page.getByRole('heading', { name: 'Việc B' })).toBeVisible();
  await page.keyboard.press('k');
  await expect(page.getByRole('heading', { name: 'Việc A' })).toBeVisible();

  // The status change shows up in the history with its before/after.
  await expect(page.getByText('đã tạo công việc')).toBeVisible();
  await page.locator('main select').first().selectOption('DONE');
  await expect(page.getByText('Trạng thái: Cần làm → Hoàn thành')).toBeVisible();
});
