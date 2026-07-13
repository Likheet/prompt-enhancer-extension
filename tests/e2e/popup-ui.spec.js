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
        managedSites: [
          {
            hostname: 'chatgpt.com',
            name: 'ChatGPT',
            enabled: true,
            placement: 'auto',
            addedAt: 1
          },
          {
            hostname: 'chat.deepseek.com',
            name: 'chat.deepseek.com',
            enabled: true,
            placement: 'composer-end',
            addedAt: 2
          },
          {
            hostname: 'www.kimi.com',
            name: 'www.kimi.com',
            enabled: true,
            placement: 'before-attach',
            addedAt: 3
          }
        ],
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
    await expect(page.getByRole('tab')).toHaveCount(2);
    await expect(page.locator('[role="tabpanel"]:visible')).toHaveCount(1);
    await expect(page.locator('#header-site-state')).toHaveText('Active on ChatGPT');
    await expect(page.locator('#conversation-awareness')).toBeChecked();
    expect(await page.evaluate(() => ({
      width: document.querySelector('.popup-shell').getBoundingClientRect().width,
      height: document.querySelector('.popup-shell').getBoundingClientRect().height,
      bodyOverflow: getComputedStyle(document.body).overflow,
      colorScheme: getComputedStyle(document.documentElement).colorScheme,
      logoFilter: getComputedStyle(document.querySelector('.brand-icon')).filter,
      logoOpacity: getComputedStyle(document.querySelector('.brand-icon')).opacity
    }))).toEqual({
      width: 400,
      height: 500,
      bodyOverflow: 'hidden',
      colorScheme: 'dark',
      logoFilter: 'none',
      logoOpacity: '1'
    });

    await page.locator('label[for="template-structured"]').click();
    await expect(page.locator('#save-bar')).toBeVisible();
    await page.getByRole('button', { name: 'Discard' }).click();
    await expect(page.locator('#template-standard')).toBeChecked();
    await expect(page.locator('#save-bar')).toBeHidden();

    await page.locator('#conversation-awareness').uncheck();
    await expect(page.locator('#context-window')).toBeDisabled();
    await expect(page.locator('#save-bar')).toBeVisible();
    await page.getByRole('button', { name: 'Discard' }).click();
    await expect(page.locator('#conversation-awareness')).toBeChecked();
    await expect(page.locator('#context-window')).toBeEnabled();

    await page.locator('label[for="template-custom"]').click();
    const customTemplate = page.locator('#custom-template-input');
    await expect(customTemplate).toBeFocused();
    await customTemplate.pressSequentially('Keep the answer short.', { delay: 20 });
    await expect(customTemplate).toHaveValue('Keep the answer short.');
    await expect(customTemplate).toBeFocused();
    await page.getByRole('button', { name: 'Discard' }).click();
    await expect(page.locator('#save-bar')).toBeHidden();

    const enhanceTab = page.getByRole('tab', { name: 'Enhance' });
    await enhanceTab.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Sites' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#panel-sites')).toBeVisible();
    await expect(page.locator('#current-site-name')).toHaveText('ChatGPT');
    await expect(page.getByText('Site controls', { exact: true })).toHaveCount(0);
    await expect(page.locator('#current-site-card img, #current-site-card svg')).toHaveCount(0);
    await expect(page.locator('.managed-site-item')).toHaveCount(3);
    await expect(page.locator('.managed-site-item').filter({ hasText: 'chat.deepseek.com' }))
      .toContainText('On · Composer edge');
    await expect(page.locator('.managed-site-item').filter({ hasText: 'www.kimi.com' }))
      .toContainText('On · Before Attach');
    const compactMetrics = await page.evaluate(() => {
      const height = (selector) => document.querySelector(selector).getBoundingClientRect().height;
      const radius = (selector) => parseFloat(getComputedStyle(document.querySelector(selector)).borderRadius);
      return {
        tabHeight: height('.popup-tabs'),
        currentSiteHeight: height('.current-site'),
        placementHeight: height('.placement-row'),
        savedRowHeight: height('.managed-site-item'),
        removeButtonHeight: height('.btn-remove-site'),
        siteRadius: radius('.site-settings'),
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth
      };
    });
    expect(compactMetrics.overflowX).toBe(false);
    expect(compactMetrics.tabHeight).toBeLessThanOrEqual(40);
    expect(compactMetrics.currentSiteHeight).toBeLessThanOrEqual(58);
    expect(compactMetrics.placementHeight).toBeLessThanOrEqual(72);
    expect(compactMetrics.savedRowHeight).toBeLessThanOrEqual(52);
    expect(compactMetrics.removeButtonHeight).toBeLessThanOrEqual(30);
    expect(compactMetrics.siteRadius).toBeLessThanOrEqual(12);
    await page.locator('.popup-shell').screenshot({ path: testInfo.outputPath('sites-popup.png') });

    const logo = page.locator('.brand-icon');
    await expect(logo).toHaveAttribute('src', '../../assets/icons/icon-48.png');

    const removeButton = page.locator('.btn-remove-site').first();
    const removeRestingStyle = await removeButton.evaluate((element) => ({
      color: getComputedStyle(element).color,
      background: getComputedStyle(element).backgroundColor
    }));
    await removeButton.hover();
    const removeHoverStyle = await removeButton.evaluate((element) => ({
      color: getComputedStyle(element).color,
      background: getComputedStyle(element).backgroundColor
    }));
    expect(removeHoverStyle.color).not.toBe(removeRestingStyle.color);
    expect(removeHoverStyle.background).not.toBe(removeRestingStyle.background);

    await page.locator('#site-placement').selectOption('after-attach');
    await expect.poll(() => serviceWorker.evaluate(async () => {
      const { managedSites } = await chrome.storage.local.get('managedSites');
      return managedSites.find((site) => site.hostname === 'chatgpt.com')?.placement;
    })).toBe('after-attach');

    const siteToggle = page.locator('#toggle-site-btn');
    await siteToggle.click();
    await expect(siteToggle).toHaveText('Turn on');
    await expect.poll(() => serviceWorker.evaluate(async () => {
      const { managedSites } = await chrome.storage.local.get('managedSites');
      return managedSites.find((site) => site.hostname === 'chatgpt.com')?.enabled;
    })).toBe(false);
    await siteToggle.click();
    await expect(siteToggle).toHaveText('Turn off');

    await page.locator('.btn-remove-site').filter({ hasText: 'Remove' }).last().click();
    await expect(page.locator('.managed-site-item')).toHaveCount(2);
    await expect(page.locator('#managed-sites-count')).toHaveText('2');

    const settingsButton = page.getByRole('button', { name: 'Settings', exact: true });
    await settingsButton.click();
    const settingsDialog = page.getByRole('dialog', { name: 'Settings' });
    await expect(settingsDialog).toBeVisible();
    await expect(settingsButton).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#provider-mode')).toHaveValue('auto');
    await expect(page.getByText('Gemini 3.1 Flash-Lite')).toBeVisible();
    await expect(page.getByText('Llama 3.1 8B Instant')).toBeVisible();
    await settingsDialog.screenshot({ path: testInfo.outputPath('provider-settings.png') });
    await page.locator('#gemini-api-key').fill('not-a-real-key');
    await page.getByRole('button', { name: 'Show Gemini API key' }).click();
    await expect(page.locator('#gemini-api-key')).toHaveAttribute('type', 'text');
    await expect(page.getByRole('button', { name: 'Hide Gemini API key' })).toBeVisible();
    await expect(page.locator('#groq-api-key')).toHaveAttribute('type', 'password');
    await page.keyboard.press('Escape');
    await expect(settingsDialog).toBeHidden();
    await expect(settingsButton).toBeFocused();

    expect(pageErrors).toEqual([]);
  } finally {
    await context.close();
  }
});
