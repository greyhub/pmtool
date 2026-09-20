import { test, expect } from '@playwright/test';
import { makeOrg, makeUser, registerUser, createOrganization } from './helpers';

const API = 'http://localhost:3001/api/v1';

test('being assigned work rings the bell, opens the task, and shows up in My tasks', async ({ browser, request }) => {
  // Member signs up in the browser; the owner sets everything up through the API.
  const memberCtx = await browser.newContext();
  const memberPage = await memberCtx.newPage();
  const member = makeUser('notifm');
  await registerUser(memberPage, member);

  const ownerCtx = await browser.newContext();
  const ownerPage = await ownerCtx.newPage();
  const owner = makeUser('notifo');
  await registerUser(ownerPage, owner);
  const org = makeOrg('notif');
  await createOrganization(ownerPage, org);

  const login = async (u: { email: string; password: string }) =>
    (
      (await (await request.post(`${API}/auth/login`, { data: u })).json()) as {
        data: { accessToken: string; user: { id: string } };
      }
    ).data;
  const ownerAuth = await login(owner);
  const memberAuth = await login(member);
  const h = (token: string) => ({ Authorization: `Bearer ${token}` });

  const invite = await (
    await request.post(`${API}/organizations/${org.slug}/invites`, {
      headers: h(ownerAuth.accessToken),
      data: { email: member.email, role: 'MEMBER' },
    })
  ).json();
  await request.post(`${API}/invites/accept`, {
    headers: h(memberAuth.accessToken),
    data: { token: invite.data.rawToken },
  });

  await request.post(`${API}/organizations/${org.slug}/projects`, {
    headers: h(ownerAuth.accessToken),
    data: { key: 'NTF', name: 'Thông báo' },
  });
  const due = new Date(Date.now() - 2 * 86_400_000).toISOString();
  await request.post(`${API}/organizations/${org.slug}/projects/NTF/tasks`, {
    headers: h(ownerAuth.accessToken),
    data: { title: 'Soạn báo cáo quý', assigneeId: memberAuth.user.id, dueDate: due },
  });

  // The bell shows one unread item; opening it goes to the task and clears the count.
  await memberPage.goto(`/vi/${org.slug}/dashboard`);
  const count = memberPage.getByTestId('notification-count');
  await expect(count).toHaveText('1');
  await memberPage.getByRole('button', { name: /Thông báo, 1 chưa đọc/ }).click();
  const panel = memberPage.getByRole('dialog', { name: 'Thông báo' });
  await expect(panel).toContainText(`${owner.fullName} giao cho bạn: Soạn báo cáo quý`);
  await panel.getByRole('link', { name: /Soạn báo cáo quý/ }).click();
  await expect(memberPage).toHaveURL(/\/projects\/NTF\/tasks\//);
  await expect(memberPage.getByTestId('notification-count')).toHaveCount(0);

  // My tasks lists it under Overdue, across projects.
  await memberPage.getByRole('link', { name: 'Việc của tôi' }).first().click();
  await expect(memberPage).toHaveURL(/my-tasks$/);
  const list = memberPage.getByTestId('my-tasks');
  await expect(list.getByRole('heading', { name: /Trễ hạn/ })).toBeVisible();
  await expect(list).toContainText('Soạn báo cáo quý');
  await expect(list).toContainText('Phụ trách');
});
