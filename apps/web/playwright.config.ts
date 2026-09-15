import { defineConfig, devices } from '@playwright/test';

/**
 * Assumes the API (with Postgres/Redis via `infra/docker-compose.yml`) is
 * already running on :3001 — matching this project's established local dev
 * workflow. `webServer` only manages the Next.js dev server; wiring a full
 * docker-composed stack for CI is Milestone J's job.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
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
