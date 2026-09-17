import { test, expect } from '@playwright/test';
import { makeOrg, makeUser, registerUser, createOrganization } from './helpers';

test('edit org name, invite a member, then archive/unarchive removes and restores it in the org switcher', async ({ page }) => {
  const owner = makeUser('orgsettings');
  await registerUser(page, owner);
  const org = makeOrg('orgsettings');
  await createOrganization(page, org);

  await page.goto(`/vi/${org.slug}/settings`);
  await expect(page.getByRole('heading', { name: 'Cài đặt tổ chức' })).toBeVisible();

  // Edit the org name.
  const nameInput = page.getByLabel('Tên tổ chức');
  await nameInput.fill(`${org.name} (đã sửa)`);
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByRole('button', { name: `${org.name} (đã sửa)` })).toBeVisible();

  // Invite a member — a copyable accept link appears since there's no real email sending.
  const inviteeEmail = `invitee-${Date.now()}@example.com`;
  await page.getByLabel('Email').fill(inviteeEmail);
  await page.getByRole('button', { name: 'Gửi lời mời' }).click();
  await expect(page.getByText('/invite/accept?token=')).toBeVisible();
  await expect(page.getByText(inviteeEmail).first()).toBeVisible();

  // Before archiving: the org switcher lists this org (the only one this user has).
  const switcherTrigger = page.getByRole('button', { name: `${org.name} (đã sửa)` });
  await switcherTrigger.click();
  await expect(page.getByRole('menuitemradio')).toHaveCount(1);
  await switcherTrigger.click(); // close

  // Archive the org: confirm dialog, then it should disappear from the switcher's list.
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Lưu trữ tổ chức' }).click();
  await expect(page.getByText('Đã lưu trữ')).toBeVisible();
  await expect(page.getByText('Tổ chức này đã được lưu trữ')).toBeVisible();

  await switcherTrigger.click();
  await expect(page.getByRole('menuitemradio')).toHaveCount(0);
  await switcherTrigger.click(); // close

  // Unarchive restores it.
  await page.getByRole('button', { name: 'Bỏ lưu trữ' }).click();
  await expect(page.getByText('Đang hoạt động')).toBeVisible();
});
