import { test, expect } from '@playwright/test';
import { makeUser, makeOrg, makeProject, registerUser, createOrganization, createProject } from './helpers';

test('creates a task, a subtask under it, and a dependency between two tasks', async ({ page }) => {
  const user = makeUser('wbs');
  await registerUser(page, user);
  const org = makeOrg('wbs');
  await createOrganization(page, org);
  const project = makeProject('WB');
  await page.goto(`/vi/${org.slug}/projects`);
  await createProject(page, project);

  // Root task
  await page.getByRole('button', { name: 'Thêm công việc', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Tiêu đề').fill('Thiết kế kiến trúc hệ thống');
  await dialog.getByRole('button', { name: 'Tạo công việc' }).click();
  await expect(page.getByText('Thiết kế kiến trúc hệ thống')).toBeVisible();

  // Second root task, used as the dependency's predecessor
  await page.getByRole('button', { name: 'Thêm công việc', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Tiêu đề').fill('Thu thập yêu cầu');
  await dialog.getByRole('button', { name: 'Tạo công việc' }).click();
  await expect(page.getByText('Thu thập yêu cầu')).toBeVisible();

  // Subtask, added inline from the row of the first task
  const row = page.locator('div.group', { hasText: 'Thiết kế kiến trúc hệ thống' }).first();
  await row.getByRole('button', { name: 'Thêm công việc con' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Tiêu đề').fill('Vẽ sơ đồ ERD');
  await dialog.getByRole('button', { name: 'Tạo công việc' }).click();
  await expect(page.getByText('Vẽ sơ đồ ERD')).toBeVisible();

  // Open the root task and add a dependency: "Thu thập yêu cầu" must finish before it
  await page.getByText('Thiết kế kiến trúc hệ thống').first().click();
  await page.waitForURL(/\/tasks\/.+/);

  await page.getByRole('button', { name: 'Thêm phụ thuộc' }).click();
  // The dependency form renders as its own bordered panel with two selects:
  // direction (defaults to "predecessors") and the other task.
  const addDepPanel = page.locator('div.rounded-md.border.border-line.p-3');
  const otherTaskSelect = addDepPanel.locator('select').nth(1);
  const otherTaskValue = await otherTaskSelect
    .locator('option', { hasText: 'Thu thập yêu cầu' })
    .getAttribute('value');
  await otherTaskSelect.selectOption(otherTaskValue!);
  await addDepPanel.getByRole('button', { name: 'Thêm phụ thuộc' }).click();

  await expect(page.getByText(/Thu thập yêu cầu/)).toBeVisible();

  // Subtask shows up under this task's own subtasks list too.
  await expect(page.getByText('Vẽ sơ đồ ERD')).toBeVisible();
});
