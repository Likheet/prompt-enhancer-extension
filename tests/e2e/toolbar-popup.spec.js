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

async function attachToTarget(cdp, targetId) {
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId });
  let requestId = 0;

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++requestId;
    const handleMessage = (event) => {
      if (event.sessionId !== sessionId) return;
      const message = JSON.parse(event.message);
      if (message.id !== id) return;
      cdp.off('Target.receivedMessageFromTarget', handleMessage);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    };

    cdp.on('Target.receivedMessageFromTarget', handleMessage);
    cdp.send('Target.sendMessageToTarget', {
      sessionId,
      message: JSON.stringify({ id, method, params })
    }).catch((error) => {
      cdp.off('Target.receivedMessageFromTarget', handleMessage);
      reject(error);
    });
  });

  return send;
}

test('toolbar action opens a fully visible popup document', async ({ browserName: _browserName }, testInfo) => {
  const context = await chromium.launchPersistentContext(testInfo.outputPath('p'), {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  try {
    const serviceWorker = await getExtensionServiceWorker(context);
    const hostPage = context.pages()[0] || await context.newPage();
    const cdp = await context.newCDPSession(hostPage);

    await serviceWorker.evaluate(() => chrome.action.openPopup());
    await expect.poll(async () => {
      const { targetInfos } = await cdp.send('Target.getTargets');
      return targetInfos.some((target) => target.url.endsWith('/src/popup/popup.html'));
    }).toBe(true);
    await hostPage.waitForTimeout(300);

    const { targetInfos } = await cdp.send('Target.getTargets');
    const popupTarget = targetInfos.find((target) => target.url.endsWith('/src/popup/popup.html'));
    const send = await attachToTarget(cdp, popupTarget.targetId);
    await send('Runtime.enable');
    const evaluation = await send('Runtime.evaluate', {
      expression: `JSON.stringify({
        readyState: document.readyState,
        textLength: document.body.innerText.length,
        viewport: { width: innerWidth, height: innerHeight },
        document: {
          scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight
        },
        shell: document.querySelector('.popup-shell')?.getBoundingClientRect().toJSON()
      })`,
      returnByValue: true
    });
    const metrics = JSON.parse(evaluation.result.value);

    expect(metrics.readyState).toBe('complete');
    expect(metrics.textLength).toBeGreaterThan(100);
    expect(metrics.shell.width).toBeGreaterThanOrEqual(380);
    expect(metrics.shell.height).toBeGreaterThanOrEqual(480);
    expect(metrics.document.scrollWidth).toBeLessThanOrEqual(metrics.viewport.width);
    expect(metrics.document.scrollHeight).toBeLessThanOrEqual(metrics.viewport.height);
  } finally {
    await context.close();
  }
});
