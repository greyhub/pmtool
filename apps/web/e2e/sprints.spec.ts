import { test, expect } from '@playwright/test';
import {
  makeOrg,
  makeProject,
  makeUser,
  registerUser,
  createOrganization,
  createProject,
} from './helpers';

const API = 'http://localhost:3001/api/v1';

test('plans a sprint: enable in settings, drag from backlog, start, board shows only the sprint, close carries work over', async ({
  page,
  request,
}) => {
  const user = makeUser('spr');
  await registerUser(page, user);
  const org = makeOrg('spr');
  await createOrganization(page, org);
  const project = makeProject('SP');
  await page.goto(`/vi/${org.slug}/projects`);
  await createProject(page, project);

  const { accessToken } = (
    (await (await request.post(`${API}/auth/login`, { data: user })).json()) as {
      data: { accessToken: string };
    }
  ).data;
  const headers = { Authorization: `Bearer ${accessToken}` };
  const base = `${API}/organizations/${org.slug}/projects/${project.key}`;
  for (const title of ['Đăng nhập', 'Đăng ký', 'Báo cáo']) {
    await request.post(`${base}/tasks`, { headers, data: { title, storyPoints: 3 } });
  }

  // Off by default: no tab. Enable it in settings and the tab appears.
  await page.goto(`/vi/${org.slug}/projects/${project.key}/settings`);
  await expect(page.getByRole('link', { name: 'Sprint', exact: true })).toHaveCount(0);
  await page.getByLabel('Làm việc theo sprint').click();
  await expect(page.getByLabel('Làm việc theo sprint')).toBeChecked();
  await expect(page.getByRole('link', { name: 'Sprint', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Sprint', exact: true }).click();
  await page.getByRole('button', { name: 'Tạo sprint' }).click();
  await page.getByLabel('Tên sprint').fill('Sprint 1');
  await page.getByLabel('Bắt đầu').fill('2026-10-01');
  await page.getByLabel('Kết thúc').fill('2026-10-14');
  await page.getByRole('button', { name: 'Tạo', exact: true }).click();
  const zone = page.getByTestId('sprint-zone-Sprint 1');
  await expect(zone).toBeVisible();

  // Drag two backlog items into the sprint; the load bar totals their points.
  const backlogRow = (t: string) =>
    page.getByTestId('backlog-zone').locator('li').filter({ hasText: t });
  await backlogRow('Đăng nhập').dragTo(zone);
  await expect(zone).toContainText('Kế hoạch 3');
  await backlogRow('Đăng ký').dragTo(zone);
  await expect(zone).toContainText('Kế hoạch 6');
  await expect(page.getByTestId('backlog-zone')).not.toContainText('Đăng nhập');

  await zone.getByRole('button', { name: 'Bắt đầu sprint' }).click();
  await expect(zone).toContainText('Đang chạy');

  // Board is filtered to the running sprint by default.
  await page.getByRole('link', { name: 'Bảng', exact: true }).click();
  await expect(page.getByText('Đăng nhập')).toBeVisible();
  await expect(page.getByText('Báo cáo')).toHaveCount(0);
  await page.getByLabel(/Chỉ hiện việc của Sprint 1/).click();
  await expect(page.getByText('Báo cáo')).toBeVisible();

  // Close: unfinished work goes back to the backlog and the history records commitment vs done.
  await page.getByRole('link', { name: 'Sprint', exact: true }).click();
  await zone.getByRole('button', { name: 'Đóng sprint' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Đóng sprint' }).click();
  await expect(page.getByText('cam kết 6 → xong 0')).toBeVisible();
  await expect(backlogRow('Đăng nhập')).toBeVisible();
});
