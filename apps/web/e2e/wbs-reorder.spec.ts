import { test, expect } from '@playwright/test';
import { makeOrg, makeProject, makeUser, registerUser, createOrganization, createProject } from './helpers';

const API = 'http://localhost:3001/api/v1';

test('reorders and re-parents WBS items by drag and drop and by buttons, and it sticks after reload', async ({
  page,
  request,
}) => {
  const user = makeUser('dnd');
  await registerUser(page, user);
  const org = makeOrg('dnd');
  await createOrganization(page, org);
  const project = makeProject('DD');
  await page.goto(`/vi/${org.slug}/projects`);
  await createProject(page, project);

  const { accessToken } = (
    (await (await request.post(`${API}/auth/login`, { data: user })).json()) as { data: { accessToken: string } }
  ).data;
  const headers = { Authorization: `Bearer ${accessToken}` };
  const add = async (title: string, nodeType: string, parentTaskId?: string) =>
    (
      (await (
        await request.post(`${API}/organizations/${org.slug}/projects/${project.key}/tasks`, {
          headers,
          data: { title, nodeType, parentTaskId },
        })
      ).json()) as { data: { id: string } }
    ).data.id;
  const phaseA = await add('Giai đoạn A', 'PHASE');
  await add('Giai đoạn B', 'PHASE');
  await add('Việc 1', 'ACTIVITY', phaseA);
  await add('Việc 2', 'ACTIVITY', phaseA);
  await add('Việc 3', 'ACTIVITY', phaseA);

  await page.goto(`/vi/${org.slug}/projects/${project.key}/wbs`);
  const row = (title: string) => page.locator('[data-testid^="wbs-row-"]').filter({ hasText: title });
  await expect(row('Việc 3')).toContainText('1.3');

  // Drop on the top edge of "Việc 1": "Việc 2" now comes first.
  await row('Việc 2').dragTo(row('Việc 1'), { targetPosition: { x: 60, y: 2 } });
  await expect(row('Việc 2')).toContainText('1.1');
  await expect(row('Việc 1')).toContainText('1.2');

  // Drop in the middle of "Giai đoạn B": "Việc 3" becomes its child.
  await row('Việc 3').dragTo(row('Giai đoạn B'));
  await page.getByRole('button', { name: 'Mở hết' }).click();
  await expect(row('Việc 3')).toContainText('2.1');

  // Buttons do the same for keyboard users: move "Việc 1" up above "Việc 2".
  await row('Việc 1').hover();
  await page.getByRole('button', { name: 'Lên: Việc 1' }).click();
  await expect(row('Việc 1')).toContainText('1.1');
  await expect(row('Việc 2')).toContainText('1.2');

  // Outdent takes it out of the phase to the root level, after its parent.
  await row('Việc 1').hover();
  await page.getByRole('button', { name: 'Đưa ra ngoài một cấp: Việc 1' }).click();
  await expect(row('Việc 1')).toContainText('2Hoạt động');
  await expect(row('Giai đoạn B')).toContainText('3Giai đoạn');

  // A move that breaks the levels is not accepted (a phase into a phase).
  await row('Giai đoạn B').dragTo(row('Giai đoạn A'));
  await expect(row('Giai đoạn B')).toContainText('3Giai đoạn');

  // It all persists.
  await page.reload();
  await page.getByRole('button', { name: 'Mở hết' }).click();
  await expect(row('Việc 3')).toContainText('3.1');
  await expect(row('Việc 2')).toContainText('1.1');
});

test('the task list reorders by drag and by buttons, and stops offering it while a search is active', async ({
  page,
  request,
}) => {
  const user = makeUser('dndl');
  await registerUser(page, user);
  const org = makeOrg('dndl');
  await createOrganization(page, org);
  const project = makeProject('DL');
  await page.goto(`/vi/${org.slug}/projects`);
  await createProject(page, project);

  const { accessToken } = (
    (await (await request.post(`${API}/auth/login`, { data: user })).json()) as { data: { accessToken: string } }
  ).data;
  for (const title of ['Alpha', 'Bravo', 'Charlie']) {
    await request.post(`${API}/organizations/${org.slug}/projects/${project.key}/tasks`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { title },
    });
  }

  await page.goto(`/vi/${org.slug}/projects/${project.key}/tasks`);
  const rows = page.locator('[data-testid^="task-row-"]');
  const order = async () =>
    (await rows.allTextContents()).map((t) => ['Alpha', 'Bravo', 'Charlie'].find((n) => t.includes(n)));
  await expect.poll(order).toEqual(['Alpha', 'Bravo', 'Charlie']);

  // Drag "Charlie" onto the top edge of "Alpha".
  await rows
    .filter({ hasText: 'Charlie' })
    .dragTo(rows.filter({ hasText: 'Alpha' }), { targetPosition: { x: 80, y: 2 } });
  await expect.poll(order).toEqual(['Charlie', 'Alpha', 'Bravo']);

  // Buttons: move "Bravo" up one place.
  await rows.filter({ hasText: 'Bravo' }).hover();
  await page.getByRole('button', { name: 'Lên: Bravo' }).click();
  await expect.poll(order).toEqual(['Charlie', 'Bravo', 'Alpha']);

  await page.reload();
  await expect.poll(order).toEqual(['Charlie', 'Bravo', 'Alpha']);

  // While a search is active the order is partial, so rows are not draggable.
  await expect(rows.first()).toHaveAttribute('draggable', 'true');
  await page.getByPlaceholder(/Tìm/).fill('Alpha');
  await expect(rows.first()).toHaveAttribute('draggable', 'false');
});
