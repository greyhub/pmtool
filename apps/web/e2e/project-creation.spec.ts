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
