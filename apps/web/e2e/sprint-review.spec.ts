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

test('sprint review: a live preview, the team’s verdict and notes, the frozen outcome after closing, and a text copy', async ({
  page,
  context,
  request,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const user = makeUser('rv');
  await registerUser(page, user);
  const org = makeOrg('rv');
  await createOrganization(page, org);
  const project = makeProject('RV');
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
          goal: 'Ra mắt bản beta',
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
    data: { title: 'Việc phát sinh', storyPoints: 3, sprintId: sprint.id },
  });

  // From the running sprint's card: a preview.
  await page.goto(`/vi/${org.slug}/projects/${project.key}/sprints`);
  await page.getByRole('link', { name: 'Review', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/sprints/${sprint.id}/review`));
  await expect(page.getByTestId('review-preview')).toBeVisible();
  await expect(page.getByTestId('kpi-committed')).toContainText('15');
  await expect(page.getByTestId('kpi-completed')).toContainText('5 / 18');
  await expect(page.getByTestId('kpi-added')).toContainText('+3');
  await expect(page.getByText('Ra mắt bản beta')).toBeVisible();
  await expect(page.getByText('phát sinh', { exact: true })).toBeVisible();

  // The verdict on the goal and the notes are saved and survive a reload.
  await page.getByRole('button', { name: 'Đạt một phần' }).click();
  await expect(page.getByRole('button', { name: 'Đạt một phần' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByLabel('Nhận xét buổi review').fill('Demo tốt, cần thêm thời gian cho việc B.');
  await page.getByRole('button', { name: 'Lưu nhận xét' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Đạt một phần' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByLabel('Nhận xét buổi review')).toHaveValue(
    'Demo tốt, cần thêm thời gian cho việc B.',
  );

  // Copy as text.
  await page.getByRole('button', { name: 'Sao chép văn bản' }).click();
  await expect(page.getByRole('button', { name: 'Đã sao chép' })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('# Review sprint — Sprint 1');
  expect(copied).toContain('**Mục tiêu** → Đạt một phần');
  expect(copied).toContain('Việc A');

  // Close the sprint (leftovers back to the backlog): the review keeps the outcome, final now.
  await page.goto(`/vi/${org.slug}/projects/${project.key}/sprints`);
  await page.getByRole('button', { name: 'Đóng sprint' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Đóng sprint' }).click();
  await expect(page.getByText('Sprint đã đóng')).toBeVisible();
  await page.getByRole('link', { name: 'Review', exact: true }).click();
  await expect(page.getByText('Đã chốt', { exact: true })).toBeVisible();
  await expect(page.getByTestId('review-preview')).toHaveCount(0);
  await expect(page.getByTestId('kpi-completed')).toContainText('5 / 18');
  await expect(page.getByText('→ backlog').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Việc B' })).toBeVisible();
});
