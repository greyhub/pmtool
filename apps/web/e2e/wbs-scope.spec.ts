import { test, expect } from '@playwright/test';
import { makeUser, makeOrg, makeProject, registerUser, createOrganization, createProject } from './helpers';

const SHOTS = process.env.E2E_SHOTS_DIR;

test('builds a WBS with dictionary and scope, then sees the linkage map and coverage on the dashboard', async ({
  page,
}) => {
  const user = makeUser('wbs');
  await registerUser(page, user);
  const org = makeOrg('wbs');
  await createOrganization(page, org);
  const project = makeProject('WB');
  await page.goto(`/vi/${org.slug}/projects`);
  await createProject(page, project);
  const base = `/vi/${org.slug}/projects/${project.key}`;

  // --- WBS: phase > deliverable > work package > activity, each addable only one level down.
  await page.goto(`${base}/wbs`);
  await expect(page.getByText('Chưa có công việc nào.')).toBeVisible();
  await page.getByRole('button', { name: 'Thêm giai đoạn' }).click();
  await page.getByPlaceholder('Tên Giai đoạn').fill('Khởi động');
  await page.getByPlaceholder('Tên Giai đoạn').press('Enter');

  const tree = page.getByTestId('wbs-tree');
  const row = (title: string) => tree.locator(':scope > li').filter({ hasText: title }).first();
  await expect(row('Khởi động')).toContainText('1');

  await row('Khởi động').getByRole('button', { name: 'Thêm mục con' }).click();
  // The deliverable level is preselected under a phase; a phase itself can't be nested here.
  await expect(page.getByRole('combobox', { name: 'type' }).locator('option')).toHaveText([
    'Giao phẩm',
    'Gói công việc',
    'Hoạt động',
  ]);
  await page.getByPlaceholder('Tên Giao phẩm').fill('Tài liệu yêu cầu');
  await page.getByPlaceholder('Tên Giao phẩm').press('Enter');
  await expect(row('Tài liệu yêu cầu')).toContainText('1.1');

  await row('Tài liệu yêu cầu').getByRole('button', { name: 'Thêm mục con' }).click();
  await page.getByPlaceholder('Tên Gói công việc').fill('Khảo sát nghiệp vụ');
  await page.getByPlaceholder('Tên Gói công việc').press('Enter');
  await expect(row('Khảo sát nghiệp vụ')).toContainText('1.1.1');

  await row('Khảo sát nghiệp vụ').getByRole('button', { name: 'Thêm mục con' }).click();
  await page.getByPlaceholder('Tên Hoạt động').fill('Phỏng vấn khách hàng');
  await page.getByPlaceholder('Tên Hoạt động').press('Enter');
  await expect(row('Phỏng vấn khách hàng')).toContainText('1.1.1.1');
  // An activity is the lowest level: nothing can be added under it.
  await expect(row('Phỏng vấn khách hàng').getByRole('button', { name: 'Thêm mục con' })).toHaveCount(0);

  // --- WBS dictionary of the work package.
  await row('Khảo sát nghiệp vụ')
    .getByRole('button', { name: /Khảo sát nghiệp vụ/ })
    .click();
  const panel = page.getByTestId('wbs-dictionary');
  await expect(panel.getByText('Chưa mô tả')).toBeVisible();
  await panel.getByLabel('Mô tả phạm vi').fill('Thu thập yêu cầu từ 5 phòng ban.');
  await panel.getByLabel('Ước tính chi phí').fill('5000');
  await panel.getByRole('button', { name: 'Lưu từ điển' }).click();
  await expect(panel.getByText('Đã mô tả')).toBeVisible();
  if (SHOTS) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: `${SHOTS}/wbs-light.png`, fullPage: true });
    await panel.getByRole('link', { name: /Mở công việc/ }).click();
    await expect(page.getByLabel('Cấp WBS')).toHaveValue('WORK_PACKAGE');
    await page.screenshot({ path: `${SHOTS}/detail-light.png`, fullPage: true });
  }

  // --- Scope statement: save, then approve.
  await page.goto(`${base}/scope`);
  await page.getByLabel('Trong phạm vi').fill('Khảo sát và phân tích yêu cầu.');
  await page.getByLabel('Ngoài phạm vi').fill('Phát triển phần mềm.');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await page.getByRole('button', { name: 'Phê duyệt phạm vi' }).click();
  await expect(page.getByText('Đã phê duyệt', { exact: true })).toBeVisible();

  // --- Dashboard: the linkage map draws the chain, and coverage names the gaps.
  await page.goto(`${base}/dashboard`);
  const card = page.getByTestId('scope-map');
  await expect(card).toBeVisible();
  const map = card.locator('svg').first();
  await expect(map.getByRole('link', { name: /Khởi động/ })).toBeVisible();
  await expect(map.getByRole('link', { name: /Tài liệu yêu cầu/ })).toBeVisible();
  await expect(map.getByRole('link', { name: /Khảo sát nghiệp vụ/ })).toBeVisible();
  // Activities are folded into a counter until asked for.
  await expect(map.getByRole('link', { name: /Phỏng vấn khách hàng/ })).toHaveCount(0);
  await map.getByRole('button', { name: '1 hoạt động' }).click();
  await expect(map.getByRole('link', { name: /Phỏng vấn khách hàng/ })).toBeVisible();

  const coverage = page.getByTestId('scope-coverage');
  await expect(coverage.getByText('Giao phẩm chưa có bản ghi nghiệm thu')).toBeVisible();
  await expect(coverage.getByText('Giao phẩm chưa có tiêu chí nghiệm thu')).toBeVisible();
  // The work package has both a dictionary entry and an activity, so those checks pass.
  await expect(coverage.getByText('Gói công việc chưa có hoạt động')).toHaveCount(0);
  await expect(coverage.getByText('Gói công việc chưa có từ điển WBS')).toHaveCount(0);

  if (SHOTS) {
    await page.setViewportSize({ width: 1440, height: 1100 });
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/dashboard-light.png`, fullPage: true });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await page.screenshot({ path: `${SHOTS}/dashboard-dark.png`, fullPage: true });
    await page.goto(`${base}/wbs`);
    await tree.locator(':scope > li').first().waitFor();
    await page.screenshot({ path: `${SHOTS}/wbs-dark.png`, fullPage: true });
  }
});
