import type { Page } from '@playwright/test';

export function uniqueSuffix(): string {
  return Math.random().toString(36).slice(2, 10);
}

export interface TestUser {
  email: string;
  password: string;
  fullName: string;
}

export function makeUser(label: string): TestUser {
  const suffix = uniqueSuffix();
  return {
    email: `${label}_${suffix}@example.com`,
    password: 'TestPass123!',
    fullName: `${label} Tester`,
  };
}

/** Registers a new user and lands on the create-organization onboarding page. */
export async function registerUser(page: Page, user: TestUser): Promise<void> {
  await page.goto('/vi/register');
  await page.getByLabel('Họ và tên').fill(user.fullName);
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Mật khẩu').fill(user.password);
  await page.getByRole('button', { name: 'Đăng ký' }).click();
  await page.waitForURL(/onboarding\/create-organization/, { timeout: 15_000 });
}

export interface TestOrg {
  name: string;
  slug: string;
}

export function makeOrg(label: string): TestOrg {
  const suffix = uniqueSuffix();
  return { name: `${label} Org ${suffix}`, slug: `${label.toLowerCase()}-org-${suffix}` };
}

/** From the onboarding page, creates an organization and lands on its dashboard. */
export async function createOrganization(page: Page, org: TestOrg): Promise<void> {
  await page.getByLabel('Tên tổ chức').fill(org.name);
  await page.getByLabel(/Slug/).fill(org.slug);
  await page.getByRole('button', { name: 'Tạo tổ chức' }).click();
  await page.waitForURL(new RegExp(`${org.slug}/dashboard`), { timeout: 15_000 });
}

export interface TestProject {
  key: string;
  name: string;
}

export function makeProject(label: string): TestProject {
  const suffix = uniqueSuffix().slice(0, 4).toUpperCase();
  return { key: `${label}${suffix}`, name: `${label} Project` };
}

/** From an org's projects list page, creates a project and lands on its tasks page. */
export async function createProject(page: Page, project: TestProject): Promise<void> {
  await page.getByRole('button', { name: 'Tạo dự án' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Tên dự án').fill(project.name);
  await dialog.getByLabel('Mã dự án').fill(project.key);
  await dialog.getByRole('button', { name: 'Tạo dự án' }).click();
  await page.waitForURL(new RegExp(`${project.key}`), { timeout: 15_000 });
}
