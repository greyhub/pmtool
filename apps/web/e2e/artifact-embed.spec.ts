import { test, expect } from '@playwright/test';
import { makeUser, makeOrg, makeProject, registerUser, createOrganization, createProject } from './helpers';

const SAMPLE_HTML = `<!doctype html>
<title>Test</title>
<body>
  <h1 id="hello">Xin chào</h1>
  <button id="btn" onclick="document.getElementById('hello').textContent='Đã bấm'">Bấm vào đây</button>
</body>
`;

test('creates an artifact and the sandboxed preview renders and runs its JS', async ({ page }) => {
  const user = makeUser('artifact');
  await registerUser(page, user);
  const org = makeOrg('artifact');
  await createOrganization(page, org);
  const project = makeProject('ART');
  await page.goto(`/vi/${org.slug}/projects`);
  await createProject(page, project);

  await page.goto(`/vi/${org.slug}/projects/${project.key}/artifacts`);
  await page.getByRole('link', { name: 'Tạo artifact mới' }).click();
  await page.waitForURL(/\/artifacts\/new/);

  await page.getByLabel('Tiêu đề').fill('Sơ đồ demo');
  await page.getByLabel('HTML/CSS/JS').fill(SAMPLE_HTML);

  const frame = page.frameLocator('iframe[title="Xem trước"]');
  await expect(frame.getByText('Xin chào')).toBeVisible();

  await page.getByRole('button', { name: 'Lưu' }).click();
  await page.waitForURL(/\/artifacts\/(?!new$)[a-z0-9]+$/);

  // Interactivity actually works inside the sandboxed iframe (allow-scripts).
  await frame.getByRole('button', { name: 'Bấm vào đây' }).click();
  await expect(frame.getByText('Đã bấm')).toBeVisible();

  // Persisted: reload and confirm both the editor and the list show it.
  await page.reload();
  await expect(page.getByLabel('Tiêu đề')).toHaveValue('Sơ đồ demo');
  await expect(frame.getByText('Xin chào')).toBeVisible();

  await page.goto(`/vi/${org.slug}/projects/${project.key}/artifacts`);
  await expect(page.getByText('Sơ đồ demo')).toBeVisible();
});
