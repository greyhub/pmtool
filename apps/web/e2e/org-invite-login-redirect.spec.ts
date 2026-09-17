import { test, expect } from '@playwright/test';
import { makeOrg, makeUser, registerUser, createOrganization } from './helpers';

// Regression test: an invite link opened while logged out used to bounce to
// /login and then land on the user's default dashboard/onboarding page,
// silently losing the invite — the user had no way to actually join. Fixed
// by threading a `redirect` query param through RequireAuth -> /login ->
// LoginForm so the user lands back on the exact page they started from.
test('opening an invite link while logged out returns to that invite after logging in', async ({
  browser,
}) => {
  const ownerCtx = await browser.newContext();
  const ownerPage = await ownerCtx.newPage();
  const owner = makeUser('inviteredirect');
  await registerUser(ownerPage, owner);
  const org = makeOrg('inviteredirect');
  await createOrganization(ownerPage, org);

  // The invitee already has an account, but their browser session (a fresh
  // context here) is logged out — the exact scenario that was broken.
  const inviteeCtx = await browser.newContext();
  const inviteePage = await inviteeCtx.newPage();
  const invitee = makeUser('inviteredirectee');
  await registerUser(inviteePage, invitee);
  await inviteeCtx.clearCookies();

  await ownerPage.goto(`/vi/${org.slug}/settings`);
  await ownerPage.getByLabel('Email').fill(invitee.email);
  await ownerPage.getByLabel('Vai trò').selectOption('MEMBER');
  await ownerPage.getByRole('button', { name: 'Gửi lời mời' }).click();
  const linkText = await ownerPage.getByText(/\/invite\/accept\?token=/).textContent();
  const token = linkText?.split('token=')[1]?.trim();
  expect(token).toBeTruthy();

  await inviteePage.goto(`/vi/invite/accept?token=${token}`);
  await inviteePage.waitForURL(/\/login\?redirect=/, { timeout: 10_000 });

  await inviteePage.getByLabel('Email').fill(invitee.email);
  await inviteePage.getByLabel('Mật khẩu').fill(invitee.password);
  await inviteePage.getByRole('button', { name: 'Đăng nhập' }).click();

  await inviteePage.waitForURL(/\/invite\/accept\?token=/, { timeout: 10_000 });
  await inviteePage.getByRole('button', { name: 'Chấp nhận lời mời' }).click();
  await inviteePage.waitForURL(new RegExp(`${org.slug}/dashboard`), { timeout: 10_000 });
});
