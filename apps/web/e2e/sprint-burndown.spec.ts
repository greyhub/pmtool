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
const vnDay = (offset = 0) =>
  new Date(Date.now() + 7 * 3_600_000 + offset * 86_400_000).toISOString().slice(0, 10);

test('sprint burndown: commitment, progress and scope added mid-sprint, then the outcome after closing', async ({
  page,
  request,
}) => {
  const user = makeUser('bd');
  await registerUser(page, user);
  const org = makeOrg('bd');
  await createOrganization(page, org);
  const project = makeProject('BD');
  await page.goto(`/vi/${org.slug}/projects`);
  await createProject(page, project);

  const { accessToken } = (
    (await (await request.post(`${API}/auth/login`, { data: user })).json()) as {
      data: { accessToken: string };
    }
  ).data;
  const headers = { Authorization: `Bearer ${accessToken}` };
  const base = `${API}/organizations/${org.slug}/projects/${project.key}`;
  await request.patch(base, { headers, data: { sprintsEnabled: true } });
  const sprint = (
    (await (
      await request.post(`${base}/sprints`, {
        headers,
        data: {
          name: 'Sprint 1',
          startDate: `${vnDay()}T00:00:00.000Z`,
          endDate: `${vnDay(4)}T00:00:00.000Z`,
        },
      })
    ).json()) as { data: { id: string } }
  ).data;
  const ids: string[] = [];
  for (const title of ['Việc A', 'Việc B', 'Việc C']) {
    const res = await request.post(`${base}/tasks`, {
      headers,
      data: { title, storyPoints: 5, sprintId: sprint.id },
    });
    ids.push(((await res.json()) as { data: { id: string } }).data.id);
  }
  await request.post(`${base}/sprints/${sprint.id}/start`, { headers });
  await request.patch(`${base}/tasks/${ids[0]}`, { headers, data: { status: 'DONE' } });
  await request.post(`${base}/tasks`, {
    headers,
    data: { title: 'Việc phát sinh', storyPoints: 5, sprintId: sprint.id },
  });

  await page.goto(`/vi/${org.slug}/projects/${project.key}/sprints`);
  await page.getByRole('button', { name: 'Burndown' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByTestId('burndown')).toBeVisible();
  // Committed 15 at the start; 5 done; 5 added -> planned 20, remaining 15, scope +5.
  await expect(dialog.getByText('Cam kết lúc bắt đầu').locator('..')).toContainText('15');
  await expect(dialog.getByText('Đã xong', { exact: true }).locator('..')).toContainText('5');
  await expect(dialog.getByText('Còn lại', { exact: true }).locator('..')).toContainText('15');
  await expect(dialog.getByText('Phạm vi thay đổi').locator('..')).toContainText('+5');
  await expect(dialog.getByTestId('burndown-chart')).toBeVisible();
  await expect(dialog.getByTestId('burndown-verdict')).not.toBeEmpty();
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
  await expect(dialog).toBeHidden();

  // Close the sprint from the page: its burndown stays available under the history with the final outcome.
  await page.getByRole('button', { name: 'Đóng sprint' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Đóng sprint' }).click();
  await expect(page.getByText('Sprint đã đóng')).toBeVisible();
  await page.getByRole('button', { name: 'Burndown' }).click();
  await expect(page.getByRole('dialog').getByText('Đã đóng', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog').getByTestId('burndown-verdict')).toContainText(
    'xong 5 / 20',
  );
});
