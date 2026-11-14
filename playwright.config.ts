import { defineConfig, devices } from '@playwright/test'

/**
 * E2E flows for the PRD acceptance criteria. Uses the locally installed
 * Google Chrome by default (set PW_CHANNEL= to use Playwright's Chromium).
 */
const channel = process.env.PW_CHANNEL ?? 'chrome'

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173/',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: channel || undefined } },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 360, height: 780 }, channel: channel || undefined } },
  ],
  webServer: {
    command: 'npx vite --port 5173 --strictPort',
    url: 'http://localhost:5173/',
    reuseExistingServer: true,
  },
})
