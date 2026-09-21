import { test, expect } from '@playwright/test';
import { makeUser, makeOrg, makeProject, registerUser, createOrganization, createProject } from './helpers';

test('creates a milestone, adds a deliverable to it, and sees it accepted on the milestone', async ({ page }) => {
  const user = makeUser('dlv');
  await registerUser(page, user);
  const org = makeOrg('dlv');
  await createOrganization(page, org);
  const project = makeProject('DV');
  await page.goto(`/vi/${org.slug}/projects`);
  await createProject(page, project);

  // Milestone: a task flagged as one, needing a due date.
  await page.goto(`/vi/${org.slug}/projects/${project.key}/milestones`);
  await expect(page.getByText('Chưa có mốc nào.')).toBeVisible();
  await page.getByRole('button', { name: 'Thêm mốc', exact: true }).click();
  const milestoneDialog = page.getByRole('dialog');
  await milestoneDialog.getByRole('button', { name: 'Tạo mốc' }).click();
  await expect(milestoneDialog.getByText('Vui lòng nhập tên mốc')).toBeVisible();
  await expect(milestoneDialog.getByText('Vui lòng chọn ngày đến hạn')).toBeVisible();
  await milestoneDialog.getByLabel('Tên mốc').fill('Bàn giao giai đoạn 1');
  await milestoneDialog.getByLabel('Ngày đến hạn').fill('2030-05-20');
  await milestoneDialog.getByRole('button', { name: 'Tạo mốc' }).click();
  const card = page.locator('div', { hasText: 'Bàn giao giai đoạn 1' }).filter({ hasText: 'Ngày đến hạn' }).last();
  await expect(card.getByText('20/5/2030')).toBeVisible();

  // Deliverable added straight from the milestone row, pre-linked to it.
  await card.getByRole('button', { name: '+ Giao phẩm' }).click();
  const deliverableDialog = page.getByRole('dialog');
  await deliverableDialog.getByLabel('Tên giao phẩm').fill('Báo cáo tổng kết GĐ1');
  await deliverableDialog.getByRole('button', { name: 'Lưu' }).click();
  await expect(card.getByText('0/1')).toBeVisible();

  // Submit, then sign off on the Deliverables tab.
  await page.getByRole('link', { name: 'Kế hoạch', exact: true }).click();
  await page.getByRole('link', { name: 'Giao phẩm' }).click();
  const row = page.getByRole('row', { name: /Báo cáo tổng kết GĐ1/ });
  await expect(row.getByText('Kế hoạch')).toBeVisible();
  await expect(row.getByText(`◆ ${project.key}-1`)).toBeVisible();
  await row.getByRole('button', { name: 'Nộp' }).click();
  await expect(row.getByText('Đã nộp')).toBeVisible();

  // Reject needs a reason, then rework and resubmit.
  await row.getByRole('button', { name: 'Từ chối' }).click();
  const rejectDialog = page.getByRole('dialog');
  await expect(rejectDialog.getByRole('button', { name: 'Từ chối' })).toBeDisabled();
  await rejectDialog.getByLabel('Lý do từ chối').fill('Thiếu phụ lục');
  await rejectDialog.getByRole('button', { name: 'Từ chối' }).click();
  await expect(row.getByText('Bị từ chối')).toBeVisible();
  await expect(row.getByText('Lý do từ chối: Thiếu phụ lục')).toBeVisible();

  await row.getByRole('button', { name: 'Nộp' }).click();
  await row.getByRole('button', { name: 'Nghiệm thu' }).click();
  await expect(row.getByText('Đã nghiệm thu', { exact: true })).toBeVisible();
  await expect(row.getByText(new RegExp(`Nghiệm thu bởi ${user.fullName}`))).toBeVisible();

  // The milestone now shows the deliverable as accepted.
  await page.getByRole('link', { name: 'Lịch trình', exact: true }).click();
  await page.getByRole('link', { name: 'Mốc quan trọng' }).click();
  const after = page.locator('div', { hasText: 'Bàn giao giai đoạn 1' }).filter({ hasText: 'Giao phẩm đã nghiệm thu' }).last();
  await expect(after.getByText('1/1')).toBeVisible();
});
