import { defineConfig, devices } from '@playwright/test';

// Smoke tests against the production build (astro preview), in Chromium and WebKit (Safari's engine).
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: 1,
  use: { baseURL: 'http://localhost:4330' },
  webServer: {
    // A plain static server, like Vercel serves the build (astro preview allows only one instance)
    command: 'npm run build && npx --yes http-server@14.1.1 dist -p 4330 -s',
    url: 'http://localhost:4330',
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [
    { name: 'chromium-mobile', use: { ...devices['Pixel 7'] } },
    { name: 'webkit-iphone', use: { ...devices['iPhone 13'] } },
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
});
