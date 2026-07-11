const path = require('path');
const { chromium, expect, test } = require('@playwright/test');

const extensionPath = path.resolve(__dirname, '..', '..');

test('enhances a prompt inline and keeps extension pages healthy', async ({ browserName: _browserName }, testInfo) => {
  const context = await chromium.launchPersistentContext(testInfo.outputPath('profile'), {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  try {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }
    const extensionId = new URL(serviceWorker.url()).host;

    await serviceWorker.evaluate(async () => {
      await chrome.storage.local.set({
        managedSites: [{
          hostname: '127.0.0.1',
          name: 'Local fixture',
          enabled: true,
          placement: 'after-attach',
          addedAt: Date.now()
        }]
      });
    });

    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto('http://127.0.0.1:4173/tests/fixtures/ai-chat.html');

    const composer = page.locator('.composer');
    const promptInput = page.getByRole('textbox', { name: 'Message' });
    const enhanceButton = page.getByRole('button', { name: /Enhance Prompt/ });

    await expect(enhanceButton).toBeVisible({ timeout: 15_000 });
    await expect(enhanceButton).toHaveCount(1);
    await expect(composer.locator(enhanceButton)).toHaveCount(1);
    expect(await page.evaluate(() => {
      const attach = document.querySelector('[aria-label="Attach file"]');
      const enhancer = document.querySelector('[aria-label^="Enhance Prompt"]');
      const voice = document.querySelector('[aria-label="Voice mode"]');
      return attach.nextElementSibling === enhancer && enhancer.nextElementSibling === voice;
    })).toBe(true);

    await promptInput.fill('fix this code');
    await enhanceButton.click();
    await expect(promptInput).not.toHaveValue('fix this code');
    await expect(promptInput).toHaveValue(/comprehensive|structure/i);

    const inputBox = await promptInput.boundingBox();
    const buttonBox = await enhanceButton.boundingBox();
    expect(inputBox).not.toBeNull();
    expect(buttonBox).not.toBeNull();
    const overlapsInput = !(
      buttonBox.x + buttonBox.width <= inputBox.x ||
      inputBox.x + inputBox.width <= buttonBox.x ||
      buttonBox.y + buttonBox.height <= inputBox.y ||
      inputBox.y + inputBox.height <= buttonBox.y
    );
    expect(overlapsInput).toBe(false);

    const usageStats = await serviceWorker.evaluate(async () => {
      const result = await chrome.storage.local.get('usageStats');
      return result.usageStats;
    });
    expect(usageStats.totalEnhancements).toBe(1);
    expect(pageErrors).toEqual([]);

    await page.evaluate(() => {
      const previousComposer = document.querySelector('.composer');
      const replacement = document.createElement('form');
      replacement.className = 'composer';
      replacement.innerHTML = `
        <div class="editor-shell"><textarea aria-label="Message" placeholder="Message the assistant"></textarea></div>
      `;
      replacement.addEventListener('submit', (event) => event.preventDefault());
      previousComposer.replaceWith(replacement);

      const unrelatedEditor = document.createElement('div');
      unrelatedEditor.contentEditable = 'true';
      unrelatedEditor.setAttribute('role', 'textbox');
      unrelatedEditor.setAttribute('aria-label', 'Artifact editor');
      unrelatedEditor.style.cssText = 'width: 400px; min-height: 60px';
      document.body.appendChild(unrelatedEditor);

      setTimeout(() => {
        const toolbar = document.createElement('div');
        toolbar.className = 'toolbar';
        toolbar.innerHTML = `
          <button type="button" aria-label="Attach file">+</button>
          <button type="button" aria-label="Voice mode">●</button>
          <button type="submit" aria-label="Send">➜</button>
        `;
        replacement.appendChild(toolbar);
      }, 300);
    });

    await expect(enhanceButton).toBeVisible({ timeout: 5_000 });
    await expect(composer.locator(enhanceButton)).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => {
      const attach = document.querySelector('.composer [aria-label="Attach file"]');
      const enhancer = document.querySelector('[aria-label^="Enhance Prompt"]');
      const voice = document.querySelector('.composer [aria-label="Voice mode"]');
      return Boolean(attach && enhancer && voice &&
        attach.nextElementSibling === enhancer && enhancer.nextElementSibling === voice);
    })).toBe(true);

    await promptInput.focus();
    await page.keyboard.press('Alt+1');
    await expect.poll(() => serviceWorker.evaluate(async () => {
      const result = await chrome.storage.local.get('enhancerSettings');
      return result.enhancerSettings.currentEnhancementType;
    })).toBe('concise');

    await promptInput.fill('make this better');
    await page.keyboard.press('Alt+e');
    await expect(promptInput).toHaveValue(/specific examples|create this/i);

    await expect.poll(() => serviceWorker.evaluate(async () => {
      const result = await chrome.storage.local.get('usageStats');
      return result.usageStats.totalEnhancements;
    })).toBe(2);

    await page.evaluate(() => {
      const previousComposer = document.querySelector('.composer');
      const replacement = document.createElement('form');
      replacement.className = 'composer';
      replacement.innerHTML = `
        <div contenteditable="true" role="textbox" aria-label="Message" data-placeholder="Message the assistant"></div>
        <button type="submit" aria-label="Send">➜</button>
      `;
      replacement.addEventListener('submit', (event) => event.preventDefault());
      previousComposer.replaceWith(replacement);
    });

    const richPromptInput = page.locator('[contenteditable="true"][aria-label="Message"]');
    await expect(enhanceButton).toBeVisible({ timeout: 5_000 });
    await richPromptInput.fill('improve this');
    await enhanceButton.click();
    await expect(richPromptInput).toContainText(/enhance and optimize|specific examples/i);

    await expect.poll(() => serviceWorker.evaluate(async () => {
      const result = await chrome.storage.local.get('usageStats');
      return result.usageStats.totalEnhancements;
    })).toBe(3);

    for (const relativeUrl of ['src/options/options.html', 'src/popup/popup.html']) {
      const extensionPage = await context.newPage();
      const extensionErrors = [];
      extensionPage.on('pageerror', (error) => extensionErrors.push(error.message));
      extensionPage.on('console', (message) => {
        if (message.type() === 'error') extensionErrors.push(message.text());
      });
      await extensionPage.goto(`chrome-extension://${extensionId}/${relativeUrl}`);
      await extensionPage.waitForLoadState('domcontentloaded');
      await expect(extensionPage.getByRole('heading', { name: /Prompt Enhancer/ }).first()).toBeVisible();
      if (relativeUrl.includes('options')) {
        await expect(extensionPage.locator('.enhancement-type-card')).toHaveCount(6);
      } else {
        await expect(extensionPage.locator('#site-placement option')).toHaveCount(4);
      }
      expect(extensionErrors).toEqual([]);
      await extensionPage.close();
    }
  } finally {
    await context.close();
  }
});
