import { defineConfig, devices } from '@playwright/test';

/**
 * Assumes the API (with Postgres/Redis via `infra/docker-compose.yml`) is
 * already running on :3001 — matching this project's established local dev
 * workflow. `webServer` only manages the Next.js server: locally it starts
 * the dev server on demand; in CI (`.github/workflows/ci.yml`) the `e2e` job
 * starts a production server itself before this ever runs, and
 * `reuseExistingServer` means that one is reused rather than started twice.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'pnpm run dev',
    url: 'http://localhost:3000/vi',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
