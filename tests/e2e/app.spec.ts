import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const resolved = Promise.resolve.bind(Promise)

    const mockApi = {
      minimizeWindow: () => {},
      maximizeWindow: () => {},
      closeWindow: () => {},
      isMaximized: async () => false,
      openFile: async () => null,
      openFolder: async () => null,
      listLogFiles: async () => ({ success: true, files: [] }),
      saveFile: async () => null,
      readFile: async (filePath: string) => {
        if (filePath.includes('app_config.json')) {
          const payload = {
            version: '1.1',
            config: {
              showWelcome: false,
              diagnosticsEnabled: true,
            },
          }
          return { success: true, data: btoa(JSON.stringify(payload)) }
        }
        return { success: false, error: 'mock' }
      },
      readTextFile: async () => ({ success: false, error: 'mock' }),
      readLargeTextFile: async () => ({ success: false, error: 'mock' }),
      countLines: async () => ({ success: false, error: 'mock' }),
      streamAnalyze: async () => ({
        success: true,
        totalLines: 0,
        matchedLines: 0,
        matches: [],
        summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        categoryStats: {},
      }),
      streamCancel: async () => ({ success: true }),
      onStreamProgress: () => () => {},
      writeFile: async () => ({ success: true }),
      getFileInfo: async () => ({ success: true, info: { size: 0 } }),
      deleteFile: async () => ({ success: true }),
      openExternal: () => {},
      getAppPath: async () => '/tmp/zhidun-test',
      getVersion: async () => '1.12.0',
      getMachineId: async () => 'mock-machine-id',
      secureEncryptSecret: async (secret: string) => ({ success: true, data: `safeStorage:${btoa(secret)}` }),
      secureDecryptSecret: async (payload: string) => ({ success: true, data: atob(payload.replace('safeStorage:', '')) }),
      secureStorageAvailable: async () => true,
      platform: 'linux',
      httpRequest: async (url: string) => {
        if (url.includes('paste.rs')) {
          return { success: true, status: 200, data: 'https://paste.rs/mock-diagnostics-url' }
        }
        return { success: false, error: 'mock' }
      },
      geoipLookup: async () => ({ success: true, results: {} }),
      emailSend: async () => ({ success: true }),
      showDesktopNotification: async () => {},
      playAlertSound: async () => {},
      onPlaySound: () => () => {},
      realtimeStart: async () => ({ success: false, error: 'mock' }),
      realtimeStop: async () => ({ success: true }),
      realtimeTestSSH: async () => ({ success: false, error: 'mock' }),
      onRealtimeData: () => () => {},
      onMenuAction: () => () => {},
      checkUpdate: async () => ({ hasUpdate: false }),
      downloadUpdate: async () => ({ success: true }),
      installUpdate: () => {},
      getUpdateVersion: async () => '1.12.0',
      onUpdateEvent: () => () => {},
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).electronAPI = mockApi
  })
})

test('home page opens settings and exports diagnostics', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('星川智盾').first()).toBeVisible()

  await page.getByRole('button', { name: '设置' }).click()
  await expect(page.getByRole('heading', { name: '设置' })).toBeVisible()
  await expect(page.getByRole('button', { name: '导出诊断' })).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出诊断' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toContain('zhidun-diagnostics')
})

test('home page uploads diagnostics from settings', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '设置' }).click()
  await expect(page.getByRole('heading', { name: '设置' })).toBeVisible()

  await page.getByRole('button', { name: '上传诊断' }).click()
  await expect(page.getByText('上传成功：https://paste.rs/mock-diagnostics-url')).toBeVisible()
})
