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

test('a long task list is drawn in batches as you scroll, and the timeline calls no third-party server', async ({
  page,
  request,
}) => {
  const user = makeUser('perf');
  await registerUser(page, user);
  const org = makeOrg('perf');
  await createOrganization(page, org);
  const project = makeProject('PF');
  await page.goto(`/vi/${org.slug}/projects`);
  await createProject(page, project);

  const { accessToken } = (
    (await (await request.post(`${API}/auth/login`, { data: user })).json()) as {
      data: { accessToken: string };
    }
  ).data;
  const headers = { Authorization: `Bearer ${accessToken}` };
  const base = `${API}/organizations/${org.slug}/projects/${project.key}`;
  for (let batch = 0; batch < 6; batch++) {
    await Promise.all(
      Array.from({ length: 40 }, (_, i) =>
        request.post(`${base}/tasks`, {
          headers,
          data: {
            title: `Việc số ${batch * 40 + i + 1}`,
            startDate: '2026-09-22T00:00:00.000Z',
            dueDate: '2026-09-30T00:00:00.000Z',
          },
        }),
      ),
    );
  }

  await page.goto(`/vi/${org.slug}/projects/${project.key}/tasks`);
  const rows = page.locator('[data-testid^="task-row-"]');
  await expect(rows.first()).toBeVisible();
  // 240 tasks exist, but only the first batch is in the page until you scroll toward the rest.
  expect(await rows.count()).toBeLessThan(240);
  await expect(page.getByTestId('tree-more')).toBeVisible();
  await expect
    .poll(
      async () => {
        await page.mouse.wheel(0, 20000);
        return rows.count();
      },
      { timeout: 15_000 },
    )
    .toBe(240);
  await expect(page.getByTestId('tree-more')).toHaveCount(0);

  // The Gantt library defaults to loading its icon font from a CDN; we self-host it, so nothing leaves our origin.
  const foreign: string[] = [];
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (!['localhost'].includes(url.hostname) && url.protocol.startsWith('http'))
      foreign.push(r.url());
  });
  await page.goto(`/vi/${org.slug}/projects/${project.key}/gantt`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Việc số 1', { exact: false }).first()).toBeVisible();
  expect(foreign).toEqual([]);
});
