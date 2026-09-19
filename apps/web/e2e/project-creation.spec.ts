import { test, expect } from '@playwright/test';
import { makeUser, makeOrg, makeProject, registerUser, createOrganization, createProject } from './helpers';

test('creates a project and it appears in the project list', async ({ page }) => {
  const user = makeUser('projcreate');
  await registerUser(page, user);
  const org = makeOrg('proj');
  await createOrganization(page, org);

  await page.goto(`/vi/${org.slug}/projects`);
  await expect(page.getByText('Chưa có dự án nào')).toBeVisible();

  const project = makeProject('PC');
  await createProject(page, project);

  // Creating a project routes straight into its tasks page.
  await expect(page.getByText(project.name)).toBeVisible();
  await expect(page.getByText(project.key)).toBeVisible();

  await page.goto(`/vi/${org.slug}/projects`);
  await expect(page.getByRole('link', { name: project.name })).toBeVisible();
  await expect(page.getByText('Lên kế hoạch')).toBeVisible();
});

test('a nested project tab has a Home link back to the org dashboard', async ({ page }) => {
  const user = makeUser('projnav');
  await registerUser(page, user);
  const org = makeOrg('projnav');
  await createOrganization(page, org);
  const project = makeProject('PN');
  await page.goto(`/vi/${org.slug}/projects`);
  await createProject(page, project);

  await page.goto(`/vi/${org.slug}/projects/${project.key}/gantt`);
  const homeLink = page.getByRole('link', { name: 'Trang chủ' });
  await expect(homeLink).toHaveAttribute('href', `/vi/${org.slug}/dashboard`);
  await homeLink.click();
  await page.waitForURL(new RegExp(`${org.slug}/dashboard`), { timeout: 10_000 });
});
