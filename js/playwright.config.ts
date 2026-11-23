import { devHttps } from './vite.config';
import { defineConfig, devices } from '@playwright/test';
const baseURL = `${devHttps ? 'https' : 'http'}://localhost:5173/`;
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  use: { baseURL, ignoreHTTPSErrors: devHttps, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    ignoreHTTPSErrors: devHttps,
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
