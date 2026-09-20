import { test, expect } from '@playwright/test';
import { makeOrg, makeUser, registerUser, createOrganization } from './helpers';

test('exports a project as CSV and imports it into another; a bad file is explained line by line', async ({ page }) => {
  await registerUser(page, makeUser('csv'));
  const org = makeOrg('csv');
  await createOrganization(page, org);

  // Source project from a template, destination empty.
  for (const [key, template] of [
    ['SRCE', 'Dự án phần mềm'],
    ['DEST', 'Dự án trống'],
  ] as const) {
    await page.goto(`/vi/${org.slug}/projects`);
    await page.getByRole('button', { name: 'Tạo dự án' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Tên dự án').fill(`Dự án ${key}`);
    await dialog.getByLabel('Mã dự án').fill(key);
    await dialog.getByRole('radio', { name: new RegExp(template) }).click();
    await dialog.getByRole('button', { name: 'Tạo dự án' }).click();
    await page.waitForURL(new RegExp(key));
  }

  // Export the source.
  await page.goto(`/vi/${org.slug}/projects/SRCE/tasks`);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Xuất CSV' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^SRCE-wbs-\d{4}-\d{2}-\d{2}\.csv$/);
  const path = (await download.path())!;

  // Import it into the destination: everything valid, nothing created until confirmed.
  await page.goto(`/vi/${org.slug}/projects/DEST/tasks`);
  await expect(page.getByText('Khảo sát nghiệp vụ')).toHaveCount(0);
  await page.getByRole('button', { name: 'Nhập CSV' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Chọn tệp CSV').setInputFiles(path);
  const result = dialog.getByTestId('import-result');
  await expect(result).toContainText('0 lỗi');
  await expect(result).toContainText('Khảo sát nghiệp vụ');
  await dialog.getByRole('button', { name: /^Nhập \d+ công việc$/ }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Khảo sát nghiệp vụ').first()).toBeVisible();

  // A bad file: each problem is listed with its line, and import stays disabled.
  await page.getByRole('button', { name: 'Nhập CSV' }).click();
  const second = page.getByRole('dialog');
  await second.getByLabel('Chọn tệp CSV').setInputFiles({
    name: 'loi.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('title,due,status\nỔn,2026-10-01,\n,2026-10-02,\nSai,2026-10-03,Xong xuôi\n', 'utf-8'),
  });
  const bad = second.getByTestId('import-result');
  await expect(bad).toContainText('1 công việc hợp lệ · 2 lỗi');
  await expect(second.getByRole('alert')).toContainText('Dòng 3');
  await expect(second.getByRole('alert')).toContainText('Dòng 4');
  await expect(second.getByRole('button', { name: /^Nhập 1 công việc$/ })).toBeDisabled();
});
