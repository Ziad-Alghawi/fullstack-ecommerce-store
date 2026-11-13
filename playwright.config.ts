import { defineConfig, devices } from '@playwright/test';
import { STORE_URL } from './e2e/settings.ts';

export default defineConfig({
  testDir: 'e2e',
  // The tests share one database, so each uses its own products and visitors
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: STORE_URL,
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } }
  ],
  webServer: {
    command: 'node --experimental-strip-types e2e/server.ts',
    url: `${STORE_URL}/api/products`,
    // Building the frontend comes first
    timeout: 180_000,
    reuseExistingServer: !process.env.CI
  }
});
