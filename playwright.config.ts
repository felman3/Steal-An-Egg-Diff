import { defineConfig, devices } from '@playwright/test';

/**
 * E2E tests. By default they build-preview the app locally against the
 * Supabase project in .env.local. Point them at a deployment with:
 *   E2E_BASE_URL=https://your-app.vercel.app npm run test:e2e
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:4173';
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'off',
    screenshot: 'only-on-failure',
    launchOptions: { proxy },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, testIgnore: /responsive\.spec\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /responsive\.spec\.ts/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: 'npm run build && npm run preview', url: baseURL, reuseExistingServer: true, timeout: 180_000 },
});
