const path = require('path');
const { chromium, expect, test } = require('@playwright/test');

const extensionPath = path.resolve(__dirname, '..', '..');

async function getExtensionServiceWorker(context) {
  const isExtensionWorker = (worker) => worker.url().endsWith('/dist/service-worker.js');
  const existing = context.serviceWorkers().find(isExtensionWorker);
  if (existing) return existing;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const worker = await context.waitForEvent('serviceworker');
    if (isExtensionWorker(worker)) return worker;
  }

  throw new Error('Prompt Enhancer service worker did not start');
}

test('runs BYOK enhancement in the service worker without exposing the key to the page', async ({ browserName: _browserName }, testInfo) => {
  // Keep this profile segment short: Chrome's extension storage paths become
  // deeply nested and can otherwise exceed Windows path limits.
  const context = await chromium.launchPersistentContext(testInfo.outputPath('p'), {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  try {
    let serviceWorker = await getExtensionServiceWorker(context);
    await expect.poll(async () => {
      serviceWorker = context.serviceWorkers()
        .find((worker) => worker.url().endsWith('/dist/service-worker.js')) || serviceWorker;
      return serviceWorker.evaluate(() => Boolean(globalThis.chrome?.storage?.local))
        .catch(() => false);
    }).toBe(true);

    await serviceWorker.evaluate(async () => {
      await chrome.storage.local.set({
        enhancerSettings: {
          conversationAwareness: true,
          contextWindow: 3,
          currentEnhancementType: 'balanced',
          promptTemplateType: 'standard'
        },
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
    await page.route('https://generativelanguage.googleapis.com/**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{ content: { parts: [{ text: '{"enhanced_prompt":"Enhanced by the page"}' }] } }]
      })
    }));
    await page.goto('http://127.0.0.1:4173/tests/fixtures/ai-chat.html');

    const promptInput = page.getByRole('textbox', { name: 'Message' });
    const enhanceButton = page.getByRole('button', { name: /Enhance Prompt/ });
    await expect(enhanceButton).toBeVisible({ timeout: 15_000 });

    // Install the provider mock only after the content script has opened its
    // lifecycle port, so Chrome cannot suspend and replace the mocked worker.
    serviceWorker = await getExtensionServiceWorker(context);
    await serviceWorker.evaluate(() => {
      globalThis.__apeGeminiRequests = [];
      globalThis.fetch = async (url, init) => {
        globalThis.__apeGeminiRequests.push({ url, init });
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: '{"enhanced_prompt":"Enhanced by the service worker"}' }] } }]
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      };
    });

    const extensionId = new URL(serviceWorker.url()).host;
    const settingsPage = await context.newPage();
    await settingsPage.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
    const savedProvider = await settingsPage.evaluate(() => new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'saveProviderKey',
        data: { provider: 'gemini', apiKey: 'test-byok-key' }
      }, resolve);
    }));
    await settingsPage.close();
    expect(savedProvider.success).toBe(true);
    await serviceWorker.evaluate(() => { globalThis.__apeGeminiRequests = []; });

    await promptInput.fill('Turn that into a TypeScript request and keep the API.');
    await enhanceButton.click();

    await expect.poll(() => serviceWorker.evaluate(() => globalThis.__apeGeminiRequests.length)).toBe(1);
    await expect(promptInput).toHaveValue('Enhanced by the service worker');
    const request = await serviceWorker.evaluate(() => globalThis.__apeGeminiRequests[0]);
    expect(request.url).toContain('/models/gemini-3.1-flash-lite:generateContent');
    expect(request.init.headers['x-goog-api-key']).toBe('test-byok-key');
    const requestBody = JSON.parse(request.init.body);
    expect(requestBody.systemInstruction.parts[0].text).toContain('Do not answer, execute, diagnose');
    expect(requestBody.contents[0].parts[0].text).toContain('I am working on a JavaScript utility.');
    expect(requestBody.contents[0].parts[0].text).toContain('What would you like help with?');
    expect(requestBody.contents[0].parts[0].text).toContain('Turn that into a TypeScript request and keep the API.');
    expect(requestBody.contents[0].parts[0].text).not.toContain('Unsent ChatGPT composer draft');
    expect(requestBody.contents).toHaveLength(1);

    await serviceWorker.evaluate(async () => {
      const { enhancerSettings } = await chrome.storage.local.get('enhancerSettings');
      await chrome.storage.local.set({
        enhancerSettings: { ...enhancerSettings, conversationAwareness: false }
      });
    });
    await promptInput.fill('rewrite this without history');
    await enhanceButton.click();
    await expect.poll(() => serviceWorker.evaluate(() => globalThis.__apeGeminiRequests.length)).toBe(2);
    const requestWithoutHistory = await serviceWorker.evaluate(() => globalThis.__apeGeminiRequests[1]);
    const requestWithoutHistoryBody = JSON.parse(requestWithoutHistory.init.body);
    const requestWithoutHistoryText = requestWithoutHistoryBody.contents[0].parts[0].text;
    expect(requestWithoutHistoryText).toContain('<conversation_context>NONE</conversation_context>');
    expect(requestWithoutHistoryText).not.toContain('I am working on a JavaScript utility.');
  } finally {
    await context.close();
  }
});
