import { defineConfig } from '@playwright/test'

const E2E_PORT = 4173
const LOCAL_NO_PROXY = '127.0.0.1,localhost'

if (!process.env.NO_PROXY?.includes('127.0.0.1')) {
  process.env.NO_PROXY = process.env.NO_PROXY ? `${process.env.NO_PROXY},${LOCAL_NO_PROXY}` : LOCAL_NO_PROXY
}
if (!process.env.no_proxy?.includes('127.0.0.1')) {
  process.env.no_proxy = process.env.no_proxy ? `${process.env.no_proxy},${LOCAL_NO_PROXY}` : LOCAL_NO_PROXY
}

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: `http://127.0.0.1:${E2E_PORT}`,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `npm run preview -- --host 127.0.0.1 --port ${E2E_PORT} --strictPort`,
    url: `http://127.0.0.1:${E2E_PORT}/index.html`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
