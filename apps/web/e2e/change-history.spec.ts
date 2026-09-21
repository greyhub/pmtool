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

test('change history: per-item history, the project history page with filters, deleted items, and the organization audit trail', async ({
  page,
  request,
}) => {
  const user = makeUser('hist');
  await registerUser(page, user);
  const org = makeOrg('hist');
  await createOrganization(page, org);
  const project = makeProject('HI');
  await page.goto(`/vi/${org.slug}/projects`);
  await createProject(page, project);

  const { accessToken } = (
    (await (await request.post(`${API}/auth/login`, { data: user })).json()) as {
      data: { accessToken: string };
    }
  ).data;
  const headers = { Authorization: `Bearer ${accessToken}` };
  const base = `${API}/organizations/${org.slug}/projects/${project.key}`;
  const risk = (
    (await (
      await request.post(`${base}/risks`, {
        headers,
        data: { type: 'RISK', title: 'Nhà cung cấp giao trễ', probability: 3, impact: 4 },
      })
    ).json()) as { data: { id: string } }
  ).data;
  await request.patch(`${base}/risks/${risk.id}`, {
    headers,
    data: { status: 'MITIGATING', probability: 4 },
  });
  const gone = (
    (await (
      await request.post(`${base}/risks`, {
        headers,
        data: { type: 'ISSUE', title: 'Máy chủ thử nghiệm lỗi', probability: 1, impact: 1 },
      })
    ).json()) as { data: { id: string } }
  ).data;
  await request.delete(`${base}/risks/${gone.id}`, { headers });
  await request.post(`${base}/tasks`, { headers, data: { title: 'Viết tài liệu' } });

  // One item's history, from its row: created, then edited with before -> after.
  await page.goto(`/vi/${org.slug}/projects/${project.key}/risks`);
  await page.getByRole('row', { name: /Nhà cung cấp giao trễ/ }).hover();
  await page.getByRole('button', { name: 'Xem lịch sử của Nhà cung cấp giao trễ' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByTestId('history-UPDATE-RiskIssue')).toContainText('Trạng thái');
  await expect(dialog.getByTestId('history-UPDATE-RiskIssue')).toContainText('Đã xác định');
  await expect(dialog.getByTestId('history-UPDATE-RiskIssue')).toContainText('Đang xử lý');
  await expect(dialog.getByTestId('history-UPDATE-RiskIssue')).toContainText('Xác suất');
  await expect(dialog.getByTestId('history-CREATE-RiskIssue')).toBeVisible();
  await expect(dialog.getByTestId('history-CREATE-RiskIssue')).toContainText(
    'Nhà cung cấp giao trễ',
  );
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();

  // The project's whole history (Governance -> History), newest first, including the deleted item's content.
  await page.getByRole('link', { name: 'Quản trị', exact: true }).click();
  await page.getByRole('link', { name: 'Lịch sử', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${project.key}/history`));
  const list = page.getByTestId('history-list');
  await expect(list.getByTestId('history-DELETE-RiskIssue')).toContainText(
    'Máy chủ thử nghiệm lỗi',
  );
  await list.getByTestId('history-DELETE-RiskIssue').getByText('Nội dung đã xoá').click();
  await expect(list.getByTestId('history-DELETE-RiskIssue')).toContainText('Vấn đề'); // what it held survives
  await expect(list.getByTestId('history-CREATE-Task')).toContainText('Viết tài liệu');

  // Filters: only deletions.
  await page.getByLabel('Hành động').selectOption('DELETE');
  await expect(list.getByTestId('history-DELETE-RiskIssue')).toBeVisible();
  await expect(list.getByTestId('history-CREATE-Task')).toHaveCount(0);
  await page.getByRole('button', { name: 'Xoá bộ lọc' }).click();
  await expect(list.getByTestId('history-CREATE-Task')).toBeVisible();

  // The organization-wide audit trail (owners and admins) also knows the members and the projects.
  await page.getByRole('link', { name: 'Nhật ký kiểm toán' }).click();
  await expect(page).toHaveURL(new RegExp(`/${org.slug}/audit`));
  await expect(
    page.getByTestId('history-list').getByTestId('history-CREATE-Membership'),
  ).toBeVisible();
  await expect(
    page.getByTestId('history-list').getByTestId('history-CREATE-Project'),
  ).toContainText(project.key.toUpperCase());
});
