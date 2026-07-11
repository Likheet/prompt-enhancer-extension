const path = require('path');
const { chromium, expect, test } = require('@playwright/test');

const extensionPath = path.resolve(__dirname, '..', '..');

const platforms = [
  {
    name: 'ChatGPT',
    url: 'https://chatgpt.com/__ape-fixture',
    html: `
      <form data-type="unified-composer">
        <div id="prompt-textarea" class="ProseMirror" contenteditable="true" role="textbox" aria-label="Message ChatGPT"></div>
        <div data-testid="composer-actions" class="toolbar">
          <button aria-label="Add files">+</button>
          <button data-testid="model-selector-dropdown" aria-label="Model selector">Instant</button>
          <button id="composer-submit-button" aria-label="Send prompt">↑</button>
        </div>
      </form>`,
    reference: '[data-testid="model-selector-dropdown"]',
    order: 'before'
  },
  {
    name: 'Claude',
    url: 'https://claude.ai/__ape-fixture',
    html: `
      <div data-testid="chat-input-grid-container" class="composer">
        <div data-testid="chat-input-grid-area"><div class="ProseMirror" contenteditable="true" role="textbox" data-placeholder="Reply to Claude"></div></div>
        <div data-testid="composer-controls" class="toolbar">
          <button data-testid="composer-attachment-button" aria-label="Add content">+</button>
          <button data-testid="model-selector-dropdown" aria-label="Choose model">Sonnet</button>
          <button data-testid="send-button" aria-label="Send message">↑</button>
        </div>
      </div>`,
    reference: '[data-testid="composer-attachment-button"]',
    order: 'after'
  },
  {
    name: 'Gemini',
    url: 'https://gemini.google.com/__ape-fixture',
    html: `
      <div class="text-input-field simplified-input-area composer">
        <div class="leading-actions-wrapper"><button aria-label="Upload & tools">+</button></div>
        <div class="ql-editor" contenteditable="true" role="textbox" aria-label="Enter a prompt for Gemini"></div>
        <div class="trailing-actions-wrapper toolbar">
          <div class="model-picker-container"><button data-test-id="bard-mode-menu-button" aria-label="Open mode picker, currently Flash">Flash</button></div>
          <button aria-label="Microphone">●</button>
        </div>
      </div>`,
    reference: '.model-picker-container',
    order: 'before'
  },
  {
    name: 'Perplexity',
    url: 'https://www.perplexity.ai/__ape-fixture',
    html: `
      <div data-testid="query-box" class="composer">
        <div id="ask-input" contenteditable="true" role="textbox" data-placeholder="Ask anything"></div>
        <div class="toolbar">
          <button aria-label="Attach file">+</button>
          <button aria-label="Search">Search</button>
          <button type="submit" aria-label="Submit question">↑</button>
        </div>
      </div>`,
    reference: '[aria-label="Attach file"]',
    order: 'after'
  },
  {
    name: 'Google AI Studio',
    url: 'https://aistudio.google.com/__ape-fixture',
    html: `
      <div class="prompt-input-wrapper-container composer">
        <div contenteditable="true" role="textbox" aria-label="Enter a prompt"></div>
        <div class="prompt-toolbar toolbar">
          <div class="button-wrapper"><button iconname="add_circle" aria-label="Insert assets">+</button></div>
          <div class="button-wrapper"><button aria-label="Run prompt">Run</button></div>
        </div>
      </div>`,
    reference: 'button[iconname="add_circle"]',
    order: 'before'
  }
];

function documentFor(body) {
  return `<!doctype html>
    <html><head><title>AI Chat Fixture</title><style>
      body { padding: 40px; font-family: system-ui; }
      form, .composer { width: 680px; padding: 12px; border: 1px solid #ddd; border-radius: 22px; }
      [contenteditable="true"] { display: block; width: 100%; min-height: 56px; }
      .toolbar { display: flex; align-items: center; gap: 8px; min-height: 40px; }
      .toolbar button { min-width: 36px; height: 36px; border: 0; border-radius: 9999px; }
    </style></head><body>${body}</body></html>`;
}

test('built extension docks once in each native composer', async ({ browserName: _browserName }, testInfo) => {
  const context = await chromium.launchPersistentContext(testInfo.outputPath('native-profile'), {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  try {
    if (!context.serviceWorkers().length) await context.waitForEvent('serviceworker');
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    for (const platform of platforms) {
      await page.route(platform.url, (route) => route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: documentFor(platform.html)
      }));
      await page.goto(platform.url);

      const enhancer = page.getByRole('button', { name: /Enhance Prompt/ });
      await expect(enhancer, `${platform.name} enhancer`).toBeVisible({ timeout: 10_000 });
      await expect(enhancer).toHaveCount(1);
      await expect(page.locator('.composer, form').locator(enhancer)).toHaveCount(1);

      const appearance = await enhancer.evaluate((button) => {
        const rect = button.getBoundingClientRect();
        const style = getComputedStyle(button);
        return {
          width: rect.width,
          height: rect.height,
          radius: parseFloat(style.borderRadius),
          hasVectorIcon: Boolean(button.querySelector('svg.ape-icon-enhance')),
          hasBitmapIcon: Boolean(button.querySelector('img'))
        };
      });
      expect(appearance.radius).toBeGreaterThanOrEqual(Math.min(appearance.width, appearance.height) / 2 - 1);
      expect(appearance.hasVectorIcon).toBe(true);
      expect(appearance.hasBitmapIcon).toBe(false);

      expect(await page.evaluate(({ selector, order }) => {
        const button = document.querySelector('[aria-label^="Enhance Prompt"]');
        const reference = document.querySelector(selector);
        const dockNode = button.closest('[data-ape-button-wrapper="true"]') || button;
        return order === 'after'
          ? reference.nextElementSibling === dockNode
          : dockNode.nextElementSibling === reference || dockNode.nextElementSibling?.contains(reference);
      }, { selector: platform.reference, order: platform.order }), `${platform.name} native order`).toBe(true);

      await page.unroute(platform.url);
    }

    expect(pageErrors).toEqual([]);
  } finally {
    await context.close();
  }
});
