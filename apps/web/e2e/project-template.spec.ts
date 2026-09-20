import { test, expect } from '@playwright/test';
import { makeOrg, makeProject, makeUser, registerUser, createOrganization } from './helpers';

test('a project started from a template arrives with scope, WBS and no coverage warnings', async ({ page }) => {
  await registerUser(page, makeUser('tpl'));
  const org = makeOrg('tpl');
  await createOrganization(page, org);
  const project = makeProject('TP');
  await page.goto(`/vi/${org.slug}/projects`);

  // A brand-new organization starts with the getting-started checklist.
  await page.goto(`/vi/${org.slug}/dashboard`);
  const checklist = page.getByTestId('onboarding-checklist');
  await expect(checklist).toContainText('Đã xong 0/5');
  await checklist.getByRole('link', { name: /Tạo dự án đầu tiên/ }).click();
  await expect(page).toHaveURL(new RegExp(`/${org.slug}/projects$`));

  await page.getByRole('button', { name: 'Tạo dự án' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Tên dự án').fill(project.name);
  await dialog.getByLabel('Mã dự án').fill(project.key);
  // Blank is the default; picking a template shows what it brings.
  await expect(dialog.getByRole('radio', { name: /Dự án trống/ })).toHaveAttribute('aria-checked', 'true');
  await dialog.getByRole('radio', { name: /Dự án phần mềm/ }).click();
  await expect(dialog.getByRole('radio', { name: /Dự án phần mềm/ })).toContainText('giai đoạn');
  if (process.env.E2E_SHOTS_DIR) await page.screenshot({ path: `${process.env.E2E_SHOTS_DIR}/template-modal.png` });
  await dialog.getByRole('button', { name: 'Tạo dự án' }).click();
  await page.waitForURL(new RegExp(project.key));

  // The WBS is there, with codes and levels.
  await page.goto(`/vi/${org.slug}/projects/${project.key}/wbs`);
  await expect(page.getByText('Khởi tạo và yêu cầu')).toBeVisible();
  await expect(page.getByText('Khảo sát nghiệp vụ')).toBeVisible();

  // Scope statement is filled in (as a draft).
  await page.goto(`/vi/${org.slug}/projects/${project.key}/scope`);
  await expect(page.getByLabel('Trong phạm vi')).toHaveValue(/Phân tích yêu cầu/);

  // The checklist moved on: everything except inviting a teammate is done.
  await page.goto(`/vi/${org.slug}/dashboard`);
  await expect(page.getByTestId('onboarding-checklist')).toContainText('Đã xong 4/5');
  await page.getByTestId('onboarding-checklist').getByRole('button', { name: 'Ẩn' }).click();
  await expect(page.getByTestId('onboarding-checklist')).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Tổng quan tổ chức')).toBeVisible();
  await expect(page.getByTestId('onboarding-checklist')).toHaveCount(0);

  // Nothing missing according to the PMBOK coverage checks.
  await page.goto(`/vi/${org.slug}/projects/${project.key}/dashboard`);
  await expect(page.getByTestId('scope-coverage')).toContainText('Cấu trúc đầy đủ');
});
