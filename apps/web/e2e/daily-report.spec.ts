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

test('daily report: live numbers, an honest empty comparison, and moving between days', async ({
  page,
  request,
}) => {
  const user = makeUser('dr');
  await registerUser(page, user);
  const org = makeOrg('dr');
  await createOrganization(page, org);
  const project = makeProject('DR');
  await page.goto(`/vi/${org.slug}/projects`);
  await createProject(page, project);

  const { accessToken } = (
    (await (await request.post(`${API}/auth/login`, { data: user })).json()) as {
      data: { accessToken: string };
    }
  ).data;
  const headers = { Authorization: `Bearer ${accessToken}` };
  const base = `${API}/organizations/${org.slug}/projects/${project.key}`;
  const ids: string[] = [];
  for (const title of ['Việc A', 'Việc B', 'Việc C']) {
    const res = await request.post(`${base}/tasks`, { headers, data: { title } });
    ids.push(((await res.json()) as { data: { id: string } }).data.id);
  }
  await request.patch(`${base}/tasks/${ids[0]}`, { headers, data: { status: 'DONE' } });
  await request.patch(`${base}/tasks/${ids[1]}`, { headers, data: { status: 'BLOCKED' } });

  // Reach it through the navigation: Overview -> Daily report.
  await page.goto(`/vi/${org.slug}/projects/${project.key}/dashboard`);
  await page.getByRole('link', { name: 'Báo cáo ngày' }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${project.key}/reports`));

  await expect(page.getByText('Đang cập nhật')).toBeVisible();
  await expect(page.getByTestId('kpi-done')).toContainText('1');
  await expect(page.getByTestId('kpi-done')).toContainText('/ 3');
  await expect(page.getByTestId('kpi-blocked')).toContainText('1');
  await expect(page.getByTestId('kpi-completedCount')).toContainText('1');
  await expect(page.getByText('Việc A')).toBeVisible(); // completed today
  await expect(page.getByText('Việc B')).toBeVisible(); // blocked right now

  // First day of history: nothing to compare with, and it says so instead of inventing zeros.
  await expect(page.getByTestId('no-previous')).toBeVisible();
  await expect(page.getByTestId('kpi-done')).toContainText('chưa có ngày so sánh');

  // Yesterday has no closed numbers yet.
  await page.getByRole('button', { name: 'Ngày trước' }).click();
  await expect(page.getByTestId('no-data')).toBeVisible();
  await expect(page.getByText('Đã chốt', { exact: true })).toHaveCount(0);

  // And back to today, live again.
  await page.getByRole('button', { name: 'Hôm nay' }).click();
  await expect(page.getByText('Đang cập nhật')).toBeVisible();
  await page.getByLabel('So với').selectOption('week');
  await expect(page.getByTestId('no-previous')).toBeVisible();
});
