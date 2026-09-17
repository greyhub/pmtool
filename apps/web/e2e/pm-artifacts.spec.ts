import { test, expect } from '@playwright/test';
import { makeUser, makeOrg, makeProject, registerUser, createOrganization, createProject } from './helpers';

test('fills and approves a project charter, adds a stakeholder, and logs a document', async ({ page }) => {
  const user = makeUser('pmartifacts');
  await registerUser(page, user);
  const org = makeOrg('pmartifacts');
  await createOrganization(page, org);
  const project = makeProject('PMA');
  await page.goto(`/vi/${org.slug}/projects`);
  await createProject(page, project);

  // --- Charter ---
  await page.goto(`/vi/${org.slug}/projects/${project.key}/charter`);
  await page.getByLabel('Mục đích & lý do (Business case)').fill('Ra mắt hệ thống quản lý dự án nội bộ.');
  await page.getByLabel('Nhà tài trợ (Sponsor)').fill('Giám đốc điều hành');
  await page.getByRole('button', { name: 'Lưu' }).click();
  await expect(page.getByText('Bản nháp')).toBeVisible();

  await page.getByRole('button', { name: 'Phê duyệt' }).click();
  await expect(page.getByText('Đã phê duyệt', { exact: true })).toBeVisible();
  await expect(page.getByText(/Đã phê duyệt bởi/)).toBeVisible();

  // --- Stakeholder ---
  await page.goto(`/vi/${org.slug}/projects/${project.key}/stakeholders`);
  await page.getByRole('button', { name: 'Thêm bên liên quan' }).click();
  const stakeholderDialog = page.getByRole('dialog');
  await stakeholderDialog.getByLabel('Họ và tên').fill('Nguyễn Văn Khách Hàng');
  await stakeholderDialog.getByLabel('Tổ chức/Công ty').fill('Công ty XYZ');
  await stakeholderDialog.getByRole('button', { name: 'Lưu' }).click();
  await expect(page.getByRole('table').getByText('Nguyễn Văn Khách Hàng')).toBeVisible();

  // --- Document ---
  await page.goto(`/vi/${org.slug}/projects/${project.key}/documents`);
  await page.getByRole('button', { name: 'Thêm tài liệu' }).click();
  const documentDialog = page.getByRole('dialog');
  await documentDialog.getByLabel('Tiêu đề').fill('Kế hoạch quản lý dự án');
  await documentDialog.getByLabel('Đường dẫn').fill('https://example.com/plan.pdf');
  await documentDialog.getByRole('button', { name: 'Lưu' }).click();
  await expect(page.getByText('Kế hoạch quản lý dự án')).toBeVisible();

  // --- Reload and confirm everything persisted ---
  await page.reload();
  await expect(page.getByText('Kế hoạch quản lý dự án')).toBeVisible();
  await page.goto(`/vi/${org.slug}/projects/${project.key}/stakeholders`);
  await expect(page.getByRole('table').getByText('Nguyễn Văn Khách Hàng')).toBeVisible();
  await page.goto(`/vi/${org.slug}/projects/${project.key}/charter`);
  await expect(page.getByText('Đã phê duyệt', { exact: true })).toBeVisible();
});
