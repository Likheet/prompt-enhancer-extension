const fs = require('fs');
const path = require('path');
const { buildSync } = require('esbuild');
const { expect, test } = require('@playwright/test');

const projectRoot = path.resolve(__dirname, '..', '..');
const inlineStyles = fs.readFileSync(
  path.join(projectRoot, 'assets', 'styles', 'inline-ui.css'),
  'utf8'
);
const dockingBundle = buildSync({
  entryPoints: [path.join(projectRoot, 'src', 'content', 'docking-strategies.js')],
  bundle: true,
  format: 'iife',
  globalName: 'APE_DOCKING_TEST',
  platform: 'browser',
  write: false,
  logLevel: 'silent'
}).outputFiles[0].text;

const fixtures = {
  chatgpt: `
    <form data-testid="composer">
      <textarea id="prompt-textarea" aria-label="Message ChatGPT"></textarea>
      <div data-testid="composer-actions" class="toolbar">
        <button data-testid="composer-attachment-button" aria-label="Add files">+</button>
        <button data-testid="model-selector-dropdown" aria-label="Model selector">Instant</button>
        <button data-testid="send-button" aria-label="Send prompt">↑</button>
      </div>
    </form>`,
  claude: `
    <fieldset data-testid="composer">
      <div contenteditable="true" role="textbox" data-placeholder="Reply to Claude"></div>
      <div data-testid="composer-controls" class="toolbar">
        <button data-testid="composer-attachment-button" aria-label="Add content">+</button>
        <button data-testid="model-selector-dropdown" aria-label="Choose model">Sonnet</button>
        <button data-testid="composer-send-button" aria-label="Send message">↑</button>
      </div>
    </fieldset>`,
  gemini: `
    <div class="text-input-field simplified-input-area">
      <div class="leading-actions-wrapper">
        <button aria-label="Upload & tools">+</button>
      </div>
      <div class="ql-editor textarea" contenteditable="true" role="textbox" aria-label="Enter a prompt for Gemini"></div>
      <div class="trailing-actions-wrapper with-model-picker toolbar">
        <div class="model-picker-container">
          <button data-test-id="bard-mode-menu-button" aria-label="Open mode picker, currently Flash">Flash</button>
        </div>
        <button aria-label="Microphone">●</button>
      </div>
    </div>`,
  perplexity: `
    <div data-testid="query-box" class="composer">
      <div id="ask-input" contenteditable="true" role="textbox" data-placeholder="Ask anything"></div>
      <div data-cplx-component="query-box-pplx-right-toolbar-components-wrapper" class="toolbar">
        <button data-testid="sources-switcher-button" aria-label="Sources">◎</button>
        <button type="submit" aria-label="Submit question">↑</button>
      </div>
    </div>`,
  aistudio: `
    <div class="prompt-input-wrapper-container composer">
      <div contenteditable="true" role="textbox" aria-label="Enter a prompt"></div>
      <div class="prompt-toolbar toolbar">
        <div class="button-wrapper"><button iconname="add_circle" aria-label="Insert assets">+</button></div>
        <div class="button-wrapper"><button aria-label="Run prompt">Run</button></div>
      </div>
    </div>`,
  generic: `
    <form class="composer">
      <div class="editor-shell"><textarea aria-label="Ask the assistant"></textarea></div>
      <div class="toolbar">
        <button aria-label="Attach file">+</button>
        <button type="submit" aria-label="Send message">↑</button>
      </div>
    </form>`
};

const expectations = {
  chatgpt: '[data-testid="model-selector-dropdown"]',
  claude: '[data-testid="model-selector-dropdown"]',
  gemini: '.model-picker-container',
  perplexity: '[data-testid="sources-switcher-button"]',
  aistudio: 'button[iconname="add_circle"]',
  generic: 'button[type="submit"]'
};

async function dockTestButton(page, platform) {
  await page.setContent(`
    <style>
      body { font-family: system-ui; padding: 40px; }
      .composer, form, fieldset, .text-input-field { width: 680px; padding: 12px; border: 1px solid #ddd; border-radius: 22px; }
      textarea, [contenteditable="true"] { display: block; width: 100%; min-height: 56px; }
      .toolbar { display: flex; align-items: center; gap: 8px; min-height: 40px; }
      .toolbar button { min-width: 36px; height: 36px; border: 0; border-radius: 9999px; }
    </style>
    ${fixtures[platform]}
  `);
  await page.addStyleTag({ content: inlineStyles });
  await page.addScriptTag({ content: dockingBundle });

  return page.evaluate((currentPlatform) => {
    const strategies = window.APE_DOCKING_TEST.DOCKING_STRATEGIES;
    const strategy = strategies[currentPlatform];
    const input = document.querySelector('textarea, [contenteditable="true"][role="textbox"]');
    const anchor = strategy.findAnchor(input, { placement: 'auto' });
    if (!anchor?.container) return null;

    const button = document.createElement('button');
    button.id = 'ape-platform-test-button';
    button.className = 'ape-inline-button';
    button.type = 'button';
    strategy.applyStyles(button, anchor.container, anchor);

    let node = button;
    if (anchor.needsWrapper) {
      const wrapper = document.createElement(anchor.wrapperTag || 'span');
      wrapper.className = anchor.wrapperClass || '';
      wrapper.appendChild(button);
      node = wrapper;
    }

    if (anchor.position === 'before' && anchor.referenceNode) {
      anchor.container.insertBefore(node, anchor.referenceNode);
    } else if (anchor.position === 'after' && anchor.referenceNode) {
      anchor.container.insertBefore(node, anchor.referenceNode.nextSibling);
    } else {
      anchor.container.appendChild(node);
    }

    const rect = button.getBoundingClientRect();
    const style = getComputedStyle(button);
    return {
      containerClass: String(anchor.container.className || ''),
      parentClass: String(button.parentElement?.className || ''),
      width: rect.width,
      height: rect.height,
      radius: parseFloat(style.borderRadius) || 0
    };
  }, platform);
}

for (const platform of Object.keys(fixtures)) {
  test(`${platform} docks a round control beside its native composer action`, async ({ page }) => {
    const result = await dockTestButton(page, platform);
    expect(result).not.toBeNull();

    const button = page.locator('#ape-platform-test-button');
    const reference = page.locator(expectations[platform]);
    await expect(button).toBeVisible();
    await expect(reference).toBeVisible();
    expect(result.radius).toBeGreaterThanOrEqual(Math.min(result.width, result.height) / 2 - 1);

    const order = await page.evaluate(({ platformName, referenceSelector }) => {
      const buttonNode = document.querySelector('#ape-platform-test-button');
      const referenceNode = document.querySelector(referenceSelector);
      const dockNode = buttonNode.parentElement?.classList.contains('button-wrapper')
        ? buttonNode.parentElement
        : buttonNode;
      if (platformName === 'claude') {
        const attach = document.querySelector('[data-testid="composer-attachment-button"]');
        return attach.nextElementSibling === dockNode && dockNode.nextElementSibling === referenceNode;
      }
      if (platformName === 'aistudio') {
        return dockNode.nextElementSibling?.contains(referenceNode) || dockNode.nextElementSibling === referenceNode;
      }
      return dockNode.nextElementSibling === referenceNode;
    }, { platformName: platform, referenceSelector: expectations[platform] });
    expect(order).toBe(true);
  });
}
