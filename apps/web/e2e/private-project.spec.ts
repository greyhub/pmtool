import { test, expect } from '@playwright/test';
import { makeOrg, makeProject, makeUser, registerUser, createOrganization } from './helpers';

test('creates a private project from the dialog, sees the badge, and can switch it back in settings', async ({
  page,
}) => {
  await registerUser(page, makeUser('priv'));
  const org = makeOrg('priv');
  await createOrganization(page, org);
  const project = makeProject('PV');
  await page.goto(`/vi/${org.slug}/projects`);

  await page.getByRole('button', { name: 'Tạo dự án' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Tên dự án').fill(project.name);
  await dialog.getByLabel('Mã dự án').fill(project.key);
  await dialog.getByLabel('Dự án riêng tư').check();
  await dialog.getByRole('button', { name: 'Tạo dự án' }).click();
  await page.waitForURL(new RegExp(project.key), { timeout: 15_000 });

  await page.goto(`/vi/${org.slug}/projects`);
  await expect(page.getByRole('row', { name: new RegExp(project.name) })).toContainText('Riêng tư');

  await page.goto(`/vi/${org.slug}/projects/${project.key}/settings`);
  const toggle = page.getByLabel('Dự án riêng tư');
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await page.getByRole('button', { name: 'Lưu' }).first().click();
  await page.goto(`/vi/${org.slug}/projects`);
  await expect(page.getByRole('row', { name: new RegExp(project.name) })).not.toContainText(
    'Riêng tư',
  );
});
