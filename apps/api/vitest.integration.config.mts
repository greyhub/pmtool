import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import swc from 'unplugin-swc';

export default defineConfig({
  plugins: [tsconfigPaths(), swc.vite()],
  test: {
    globals: true,
    environment: 'node',
    include: ['test/integration/**/*.spec.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    // Set before any module loads: ConfigModule validates env at import time, so a
    // value assigned later in beforeAll would be ignored.
    env: {
      RATE_LIMIT_ENABLED: 'false',
      AI_DAILY_LIMIT_PER_ORG: '3',
      FEEDBACK_ADMIN_EMAILS: 'feedback-admin@example.com',
    },
  },
});
