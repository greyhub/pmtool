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

test('Ctrl+K finds a task without diacritics and opens it; also jumps between project screens and to another project', async ({
  page,
  request,
}) => {
  const user = makeUser('pal');
  await registerUser(page, user);
  const org = makeOrg('pal');
  await createOrganization(page, org);
  const first = makeProject('PA');
  const second = makeProject('PB');
  await page.goto(`/vi/${org.slug}/projects`);
  await createProject(page, first);
  await page.goto(`/vi/${org.slug}/projects`);
  await createProject(page, second);

  const { accessToken } = (
    (await (await request.post(`${API}/auth/login`, { data: user })).json()) as {
      data: { accessToken: string };
    }
  ).data;
  await request.post(`${API}/organizations/${org.slug}/projects/${first.key}/tasks`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { title: 'Đăng nhập bằng Google' },
  });

  await page.goto(`/vi/${org.slug}/projects/${first.key}/tasks`);
  // The shortcut is wired once the shell has hydrated; the visible trigger button is the signal.
  await expect(page.getByRole('button', { name: /Mở tìm kiếm nhanh/ })).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog', { name: 'Tìm kiếm nhanh' });
  await expect(dialog).toBeVisible();
  await page.keyboard.type('dang nhap google');
  await expect(dialog.getByRole('option')).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/projects/${first.key}/tasks/`));
  await expect(page.getByText('Đăng nhập bằng Google').first()).toBeVisible();

  // A screen of the current project.
  await page.keyboard.press('Control+k');
  await expect(dialog).toBeVisible();
  await page.keyboard.type('wbs');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/projects/${first.key}/wbs`));

  // Another project, by name; Escape closes without navigating.
  await page.keyboard.press('Control+k');
  await expect(dialog).toBeVisible();
  await page.keyboard.type(second.key);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/projects/${second.key}/dashboard`));
  await page.keyboard.press('Control+k');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
