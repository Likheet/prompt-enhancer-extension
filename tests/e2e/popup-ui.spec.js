const path = require('path');
const { chromium, expect, test } = require('@playwright/test');

const extensionPath = path.resolve(__dirname, '..', '..');

test('popup control center preserves settings and site workflows', async ({ browserName: _browserName }, testInfo) => {
  const context = await chromium.launchPersistentContext(testInfo.outputPath('popup-profile'), {
    channel: 'chromium',
    headless: true,
    viewport: { width: 420, height: 600 },
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  try {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) serviceWorker = await context.waitForEvent('serviceworker');
    const extensionId = new URL(serviceWorker.url()).host;

    await serviceWorker.evaluate(async () => {
      await chrome.storage.local.set({
        managedSites: [{
          hostname: 'chatgpt.com',
          name: 'ChatGPT',
          enabled: true,
          placement: 'auto',
          addedAt: 1
        }],
        usageStats: { totalEnhancements: 128, byokEnhancements: 47 }
      });
    });

    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') pageErrors.push(message.text());
    });
    await page.addInitScript(() => {
      Object.defineProperty(chrome.tabs, 'query', {
        value: async () => [{ id: 42, url: 'https://chatgpt.com/', title: 'ChatGPT' }]
      });
      Object.defineProperty(chrome.tabs, 'reload', { value: async () => {} });
    });

    await page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Prompt Enhancer' })).toBeVisible();
    await expect(page.getByRole('tab')).toHaveCount(3);
    await expect(page.locator('[role="tabpanel"]:visible')).toHaveCount(1);
    await expect(page.locator('#header-site-state')).toHaveText('Active on ChatGPT');
    expect(await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
      bodyOverflow: getComputedStyle(document.body).overflow
    }))).toEqual({ width: 420, height: 600, bodyOverflow: 'hidden' });

    await page.locator('#template-structured').check();
    await expect(page.locator('#save-bar')).toBeVisible();
    await page.getByRole('button', { name: 'Discard' }).click();
    await expect(page.locator('#template-standard')).toBeChecked();
    await expect(page.locator('#save-bar')).toBeHidden();

    const enhanceTab = page.getByRole('tab', { name: 'Enhance' });
    await enhanceTab.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Sites' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Website integration' })).toBeVisible();
    await expect(page.locator('#current-site-name')).toHaveText('ChatGPT');

    await page.locator('#site-placement').selectOption('before-send');
    await expect.poll(() => serviceWorker.evaluate(async () => {
      const { managedSites } = await chrome.storage.local.get('managedSites');
      return managedSites.find((site) => site.hostname === 'chatgpt.com')?.placement;
    })).toBe('before-send');

    await page.getByRole('tab', { name: 'API' }).click();
    await page.getByRole('button', { name: 'Configure' }).click();
    await expect(page.locator('#byok-config')).toBeVisible();
    await page.locator('#gemini-api-key').fill('not-a-real-key');
    await page.getByRole('button', { name: 'Show API key' }).click();
    await expect(page.locator('#gemini-api-key')).toHaveAttribute('type', 'text');
    await expect(page.getByRole('button', { name: 'Hide API key' })).toBeVisible();

    expect(pageErrors).toEqual([]);
  } finally {
    await context.close();
  }
});
