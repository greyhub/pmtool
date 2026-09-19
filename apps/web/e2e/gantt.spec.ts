import { test, expect } from '@playwright/test';
import { makeUser, makeOrg, makeProject, registerUser, createOrganization, createProject } from './helpers';

test('shows an empty-state message for a project with no tasks, and Vietnamese column headers once a task exists', async ({
  page,
}) => {
  const user = makeUser('ganttempty');
  await registerUser(page, user);
  const org = makeOrg('ganttempty');
  await createOrganization(page, org);
  const project = makeProject('GE');
  await page.goto(`/vi/${org.slug}/projects`);
  await createProject(page, project);

  await page.goto(`/vi/${org.slug}/projects/${project.key}/gantt`);
  await expect(page.getByText('Chưa có công việc nào trong dự án này.')).toBeVisible();

  await page.goto(`/vi/${org.slug}/projects/${project.key}/tasks`);
  await page.getByRole('button', { name: 'Thêm công việc', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Tiêu đề').fill('Việc đầu tiên');
  await dialog.getByRole('button', { name: 'Tạo công việc' }).click();
  await expect(page.getByText('Việc đầu tiên')).toBeVisible();

  // SVAR renders some grid cells twice (once as a zero-size measurement
  // node) — filter to the actually-visible instance throughout this file.
  // Scoped to the Gantt grid itself (not `page`): "Công việc" also matches
  // the page's own "Công việc" tab link, which is ambiguous now that the
  // grid's header column is sized correctly (see the gridWidth fix in
  // GanttChart.tsx) and therefore counts as visible too.
  await page.goto(`/vi/${org.slug}/projects/${project.key}/gantt`);
  const ganttGrid = page.locator('.wx-grid');
  await expect(ganttGrid.getByText('Công việc', { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(ganttGrid.getByText('Bắt đầu', { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(ganttGrid.getByText('Trạng thái', { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(ganttGrid.getByText('Độ ưu tiên', { exact: true }).filter({ visible: true })).toBeVisible();
});

test('a dependency added from a task detail page renders as a link on the Gantt after reload, and clicking a task bar opens its detail page', async ({
  page,
}) => {
  const user = makeUser('ganttlink');
  await registerUser(page, user);
  const org = makeOrg('ganttlink');
  await createOrganization(page, org);
  const project = makeProject('GL');
  await page.goto(`/vi/${org.slug}/projects`);
  await createProject(page, project);

  await page.getByRole('button', { name: 'Thêm công việc', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Tiêu đề').fill('Công việc trước');
  await dialog.getByRole('button', { name: 'Tạo công việc' }).click();
  await expect(page.getByText('Công việc trước')).toBeVisible();

  await page.getByRole('button', { name: 'Thêm công việc', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Tiêu đề').fill('Công việc sau');
  await dialog.getByRole('button', { name: 'Tạo công việc' }).click();
  await expect(page.getByText('Công việc sau')).toBeVisible();

  // Open "Công việc sau" and add "Công việc trước" as its predecessor.
  await page.getByText('Công việc sau').first().click();
  await page.waitForURL(/\/tasks\/.+/);
  const taskId = page.url().split('/tasks/')[1];

  await page.getByRole('button', { name: 'Thêm phụ thuộc' }).click();
  const addDepPanel = page.locator('div.rounded-md.border.border-line.p-3');
  const otherTaskSelect = addDepPanel.locator('select').nth(1);
  const otherTaskValue = await addDepPanel
    .locator('select')
    .nth(1)
    .locator('option', { hasText: 'Công việc trước' })
    .getAttribute('value');
  await otherTaskSelect.selectOption(otherTaskValue!);
  await addDepPanel.getByRole('button', { name: 'Thêm phụ thuộc' }).click();
  await expect(page.getByText(/Công việc trước/)).toBeVisible();

  // The Gantt should render the dependency as a connecting line ("g.wx-line
  // [data-link-id]" — distinct from ".wx-link", which is the hover-only
  // connector-handle class, always present regardless of any real link),
  // and it must survive a reload.
  await page.goto(`/vi/${org.slug}/projects/${project.key}/gantt`);
  await expect(page.getByText('Công việc trước', { exact: false }).filter({ visible: true }).first()).toBeVisible();
  await expect(page.locator('[data-link-id]')).toHaveCount(1);

  await page.reload();
  await expect(page.getByText('Công việc trước', { exact: false }).filter({ visible: true }).first()).toBeVisible();
  await expect(page.locator('[data-link-id]')).toHaveCount(1);

  // Clicking a task's bar/grid-row opens its detail page.
  const taskCell = page.getByText('Công việc sau', { exact: false }).filter({ visible: true }).first();
  await taskCell.click();
  await page.waitForURL(new RegExp(`tasks/${taskId}`), { timeout: 10_000 });
});
