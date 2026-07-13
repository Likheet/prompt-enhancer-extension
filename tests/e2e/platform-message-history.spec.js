const path = require('path');
const { buildSync } = require('esbuild');
const { expect, test } = require('@playwright/test');

const projectRoot = path.resolve(__dirname, '..', '..');
const domObserverBundle = buildSync({
  entryPoints: [path.join(projectRoot, 'src', 'content', 'dom-observer.js')],
  bundle: true,
  format: 'iife',
  globalName: 'APE_HISTORY_TEST',
  platform: 'browser',
  write: false,
  logLevel: 'silent'
}).outputFiles[0].text;

function platformMessage({ tag = 'div', content, classes = '', attributes = '' }) {
  return `<${tag} class="${classes}" ${attributes}>${content}</${tag}>`;
}

const platformFixtures = [
  {
    name: 'ChatGPT',
    platform: 'chatgpt',
    url: 'https://chatgpt.com/__ape-history-fixture',
    root: (history, composer) => `<main>${history}${composer}</main>`,
    composer: `
      <form data-type="unified-composer">
        <div id="prompt-textarea" class="ProseMirror" contenteditable="true" role="textbox">
          Unsent ChatGPT composer draft
        </div>
      </form>`,
    message: (role, content, options = {}) => platformMessage({
      role,
      content,
      classes: options.classes,
      attributes: `data-message-author-role="${role}" ${options.attributes || ''}`
    })
  },
  {
    name: 'Claude',
    platform: 'claude',
    url: 'https://claude.ai/__ape-history-fixture',
    root: (history, composer) => `
      <main><div data-testid="conversation">${history}</div>${composer}</main>`,
    composer: `
      <div data-testid="chat-input-grid-container">
        <div class="ProseMirror" contenteditable="true" role="textbox">
          Unsent Claude composer draft
        </div>
      </div>`,
    message: (role, content, options = {}) => platformMessage({
      role,
      content,
      classes: role === 'assistant'
        ? `font-claude-response ${options.classes || ''}`
        : options.classes,
      attributes: role === 'user'
        ? `data-testid="user-message" ${options.attributes || ''}`
        : options.attributes
    }),
    streaming: (message) => `<div data-is-streaming="">${message}</div>`,
    completedAttributes: 'data-is-streaming="false"'
  },
  {
    name: 'Gemini',
    platform: 'gemini',
    url: 'https://gemini.google.com/__ape-history-fixture',
    root: (history, composer) => `
      <main><infinite-scroller class="chat-history">${history}</infinite-scroller>${composer}</main>`,
    composer: `
      <div class="ql-editor" contenteditable="true" role="textbox" aria-label="Enter a prompt">
        Unsent Gemini composer draft
      </div>`,
    message: (role, content, options = {}) => platformMessage({
      tag: role === 'user' ? 'user-query-content' : 'message-content',
      role,
      content,
      classes: options.classes,
      attributes: options.attributes
    })
  },
  {
    name: 'Perplexity',
    platform: 'perplexity',
    url: 'https://www.perplexity.ai/__ape-history-fixture',
    root: (history, composer) => `<main>${history}${composer}</main>`,
    composer: `
      <div id="ask-input" contenteditable="true" role="textbox">
        Unsent Perplexity composer draft
      </div>`,
    message: (role, content, options = {}) => platformMessage({
      role,
      content,
      classes: `message ${role}-message ${options.classes || ''}`,
      attributes: options.attributes
    })
  },
  {
    name: 'Google AI Studio',
    platform: 'aistudio',
    url: 'https://aistudio.google.com/__ape-history-fixture',
    root: (history, composer) => `<main>${history}${composer}</main>`,
    composer: `
      <div contenteditable="true" role="textbox" aria-label="Enter a prompt">
        Unsent AI Studio composer draft
      </div>`,
    message: (role, content, options = {}) => platformMessage({
      role,
      content,
      classes: `message ${options.classes || ''}`,
      attributes: `data-role="${role}" ${options.attributes || ''}`
    })
  },
  {
    name: 'Kimi',
    platform: 'kimi',
    url: 'https://www.kimi.com/__ape-history-fixture',
    root: (history, composer) => `<main class="chat-container">${history}${composer}</main>`,
    composer: `
      <div class="chat-input-editor" contenteditable="true" role="textbox">
        Unsent Kimi composer draft
      </div>`,
    message: (role, content, options = {}) => platformMessage({
      role,
      content,
      classes: `message ${role} ${options.classes || ''}`,
      attributes: options.attributes
    })
  },
  {
    name: 'DeepSeek',
    platform: 'deepseek',
    url: 'https://chat.deepseek.com/__ape-history-fixture',
    root: (history, composer) => `<main class="chat-container">${history}${composer}</main>`,
    composer: '<textarea>Unsent DeepSeek composer draft</textarea>',
    message: (role, content, options = {}) => platformMessage({
      role,
      content,
      classes: `message ${role} ${options.classes || ''}`,
      attributes: options.attributes
    })
  }
];

const expectedHistory = [
  { role: 'user', content: 'Plan alpha.' },
  { role: 'assistant', content: 'Alpha answer.' },
  { role: 'user', content: 'Plan beta.' },
  { role: 'assistant', content: 'Beta answer.' }
];

function historyDocument(fixture) {
  const message = fixture.message;
  const streamingMessage = message('assistant', 'Incomplete streamed answer.', {
    attributes: 'data-state="streaming"'
  });
  const streaming = fixture.streaming
    ? fixture.streaming(message('assistant', 'Incomplete Claude ancestor stream.'))
    : streamingMessage;
  const history = [
    message('user', 'Plan alpha.'),
    message(
      'assistant',
      'Alpha answer.<button type="button">Copy</button><span aria-hidden="true">Rate answer</span>'
    ),
    message('assistant', 'Hidden history must not be extracted.', { attributes: 'hidden' }),
    message('assistant', 'Message-shaped toolbar must not be extracted.', {
      classes: 'toolbar'
    }),
    streaming,
    message('user', 'Plan beta.'),
    message(
      'assistant',
      'Beta answer.<button type="button">Retry</button>',
      { attributes: fixture.completedAttributes || '' }
    )
  ].join('');

  const sidebarMessage = message('assistant', 'Sidebar history must not be extracted.');
  return `<!doctype html>
    <html>
      <head><title>${fixture.name} history fixture</title></head>
      <body>
        <nav>${sidebarMessage}</nav>
        ${fixture.root(history, fixture.composer)}
      </body>
    </html>`;
}

for (const fixture of platformFixtures) {
  test(`${fixture.name} extracts only completed conversation turns in chronology`, async ({ page }) => {
    await page.route(fixture.url, (route) => route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: historyDocument(fixture)
    }));
    await page.goto(fixture.url);
    await page.addScriptTag({ content: domObserverBundle });

    const result = await page.evaluate(() => {
      const Observer = window.APE_HISTORY_TEST.default;
      const observer = new Observer();
      return {
        platform: observer.platform,
        history: observer.extractMessages().map(({ role, content }) => ({ role, content }))
      };
    });

    expect(result.platform).toBe(fixture.platform);
    expect(result.history).toEqual(expectedHistory);
  });
}

test('ChatGPT recovers canonical wrapper turns whose role markers are nested', async ({ page }) => {
  const url = 'https://chatgpt.com/__ape-nested-history-fixture';
  const body = `<!doctype html>
    <main>
      <div data-testid="conversation-turn-user-1" class="group w-full">
        <span data-message-author-role="user"></span>
        Preserve the existing public API.
        <button type="button">Edit</button>
      </div>
      <div data-testid="conversation-turn-assistant-1" class="group w-full">
        <span data-message-author-role="assistant"></span>
        I will preserve the public API.
        <button type="button">Copy</button>
      </div>
      <div data-testid="conversation-turn-assistant-stream" class="group w-full" data-state="streaming">
        <span data-message-author-role="assistant"></span>
        Incomplete streamed response.
      </div>
      <form data-type="unified-composer">
        <div id="prompt-textarea" contenteditable="true" role="textbox">Unsent composer draft</div>
      </form>
    </main>`;
  await page.route(url, (route) => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body
  }));
  await page.goto(url);
  await page.addScriptTag({ content: domObserverBundle });

  const result = await page.evaluate(() => {
    const Observer = window.APE_HISTORY_TEST.default;
    const observer = new Observer();
    return {
      history: observer.extractMessages().map(({ role, content }) => ({ role, content })),
      diagnostics: observer.getMessageExtractionDiagnostics()
    };
  });

  expect(result.history).toEqual([
    { role: 'user', content: 'Preserve the existing public API.' },
    { role: 'assistant', content: 'I will preserve the public API.' }
  ]);
  expect(result.diagnostics).toMatchObject({
    canonicalTurnCount: 2,
    returnedMessageCount: 2,
    rejectionCounts: { streaming: 1 }
  });
});
