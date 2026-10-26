import { defineConfig, devices } from "@playwright/test"

// E2E_BASE_URL permite apuntar a un Vite aislado (p. ej. un backend QA en otro puerto).
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:5173"

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "on",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "bun run dev",
    env: { VITE_API_URL: process.env.E2E_API_URL ?? "http://localhost:5285" },
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120000,
  },
})
