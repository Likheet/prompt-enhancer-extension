const { loadBundledModule } = require('./helpers/load-module');

const SETTINGS = {
  currentEnhancementType: 'balanced',
  conversationAwareness: false,
  geminiKey: 'test-gemini-key'
};

function createChromeMock(initialStorage = null) {
  const storage = initialStorage || {
    enhancerSettings: SETTINGS,
    subscription: {
      type: 'byok',
      active: true,
      apiKey: 'test-gemini-key'
    }
  };
  let messageListener;

  const chrome = {
    runtime: {
      id: 'test-extension',
      lastError: null,
      onInstalled: { addListener: jest.fn() },
      onConnect: { addListener: jest.fn() },
      onMessage: {
        addListener: jest.fn((listener) => {
          messageListener = listener;
        })
      },
      openOptionsPage: jest.fn()
    },
    storage: {
      local: {
        get: (keys, callback) => {
          const requestedKeys = Array.isArray(keys) ? keys : [keys];
          callback(Object.fromEntries(
            requestedKeys.map((key) => [key, storage[key]])
          ));
        },
        set: (items, callback) => {
          Object.assign(storage, items);
          callback();
        }
      }
    }
  };

  return {
    chrome,
    getMessageListener: () => messageListener
  };
}

function createFetchHarness() {
  const requests = [];
  const fetch = jest.fn((url, init = {}) => new Promise((resolve, reject) => {
    const request = {
      url,
      init,
      signal: init.signal,
      resolve(text) {
        const responseText = JSON.stringify({ enhanced_prompt: text });
        resolve({
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => String(url).includes('api.groq.com')
            ? { choices: [{ message: { content: responseText }, finish_reason: 'stop' }] }
            : { candidates: [{ content: { parts: [{ text: responseText }] } }] }
        });
      }
    };

    const rejectForAbort = () => {
      const error = new Error('fetch aborted');
      error.name = 'AbortError';
      reject(error);
    };

    if (init.signal?.aborted) {
      rejectForAbort();
    } else {
      init.signal?.addEventListener('abort', rejectForAbort, { once: true });
    }
    requests.push(request);
  }));

  return { fetch, requests };
}

function createWorkerHarness(initialStorage = null) {
  const chromeHarness = createChromeMock(initialStorage);
  const fetchHarness = createFetchHarness();

  loadBundledModule('src/background/service-worker.js', {
    chrome: chromeHarness.chrome,
    fetch: fetchHarness.fetch,
    console: {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    }
  });

  const messageListener = chromeHarness.getMessageListener();
  if (!messageListener) throw new Error('Service worker did not register a message listener');

  return {
    requests: fetchHarness.requests,
    send(action, data, sender) {
      return new Promise((resolve) => {
        messageListener({ action, data }, sender, resolve);
      });
    }
  };
}

function enhance(worker, requestId, sender, prompt = requestId) {
  return worker.send('enhancePrompt', {
    requestId,
    context: { currentPrompt: prompt },
    enhancementType: 'balanced'
  }, sender);
}

async function waitForRequests(worker, count) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (worker.requests.length >= count) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error(`Expected ${count} fetch requests, received ${worker.requests.length}`);
}

describe('service worker enhancement cancellation', () => {
  test('never returns provider keys through public subscription messages', async () => {
    const worker = createWorkerHarness();
    const response = await worker.send('getSubscription', {}, { tab: { id: 5 }, frameId: 0 });
    const serialized = JSON.stringify(response);

    expect(response).toMatchObject({
      providers: { gemini: { configured: true }, groq: { configured: false } }
    });
    expect(serialized).not.toContain('test-gemini-key');
    expect(serialized).not.toMatch(/geminiApiKey|groqApiKey|apiKeyMasked/);
  });

  test('returns a configuration error without calling a provider when no key exists', async () => {
    const worker = createWorkerHarness({
      enhancerSettings: {
        currentEnhancementType: 'balanced',
        conversationAwareness: false
      },
      subscription: {
        type: 'free',
        active: true,
        providerStorageVersion: 2,
        providerMode: 'auto',
        preferredProvider: 'gemini'
      }
    });

    await expect(enhance(worker, 'missing-key', { tab: { id: 6 }, frameId: 0 })).resolves.toMatchObject({
      success: false,
      errorCode: 'provider_key_required',
      error: expect.stringMatching(/Gemini or Groq API key/i)
    });
    expect(worker.requests).toHaveLength(0);
  });

  test('uses Groq when it is the only configured key and sends exactly one request', async () => {
    const worker = createWorkerHarness({
      enhancerSettings: {
        currentEnhancementType: 'balanced',
        conversationAwareness: false
      },
      subscription: {
        type: 'byok',
        active: true,
        providerStorageVersion: 2,
        providerMode: 'gemini',
        preferredProvider: 'gemini',
        groqApiKey: 'groq-only-key'
      }
    });
    const response = enhance(worker, 'groq-only', { tab: { id: 6 }, frameId: 0 });
    await waitForRequests(worker, 1);
    worker.requests[0].resolve('Groq enhancement');

    await expect(response).resolves.toMatchObject({
      success: true,
      enhanced: 'Groq enhancement',
      providerUsed: 'groq',
      modelUsed: 'llama-3.1-8b-instant'
    });
    expect(worker.requests).toHaveLength(1);
    expect(worker.requests[0].url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(worker.requests[0].init.headers.Authorization).toBe('Bearer groq-only-key');
    expect(worker.requests[0].init.body).not.toContain('groq-only-key');
  });

  test('a newer enhancement from the same source aborts the older fetch', async () => {
    const worker = createWorkerHarness();
    const sender = { tab: { id: 7 }, frameId: 0 };

    const olderResponse = enhance(worker, 'older', sender);
    await waitForRequests(worker, 1);

    const newerResponse = enhance(worker, 'newer', sender);
    await waitForRequests(worker, 2);

    expect(worker.requests[0].signal.aborted).toBe(true);
    worker.requests[1].resolve('Newer enhancement');

    await expect(olderResponse).resolves.toMatchObject({
      success: false,
      errorCode: 'cancelled'
    });
    await expect(newerResponse).resolves.toMatchObject({
      success: true,
      requestId: 'newer',
      enhanced: 'Newer enhancement'
    });
  });

  test('an explicit cancellation aborts the active request', async () => {
    const worker = createWorkerHarness();
    const sender = { tab: { id: 8 }, frameId: 0 };

    const enhancementResponse = enhance(worker, 'cancel-me', sender);
    await waitForRequests(worker, 1);

    const cancelResponse = await worker.send(
      'cancelEnhancement',
      { requestId: 'cancel-me' },
      sender
    );

    expect(cancelResponse).toEqual({
      success: true,
      cancelled: true,
      requestId: 'cancel-me'
    });
    expect(worker.requests[0].signal.aborted).toBe(true);
    await expect(enhancementResponse).resolves.toMatchObject({
      success: false,
      errorCode: 'cancelled'
    });
  });

  test('requests and cancellation remain isolated by tab and frame', async () => {
    const worker = createWorkerHarness();
    const mainFrame = { tab: { id: 9 }, frameId: 0 };
    const childFrame = { tab: { id: 9 }, frameId: 1 };

    const mainResponse = enhance(worker, 'main-request', mainFrame);
    await waitForRequests(worker, 1);
    const childResponse = enhance(worker, 'child-request', childFrame);
    await waitForRequests(worker, 2);

    expect(worker.requests[0].signal.aborted).toBe(false);
    expect(worker.requests[1].signal.aborted).toBe(false);
    await expect(worker.send(
      'cancelEnhancement',
      { requestId: 'main-request' },
      childFrame
    )).resolves.toEqual({
      success: true,
      cancelled: false,
      requestId: 'main-request'
    });
    expect(worker.requests[0].signal.aborted).toBe(false);

    worker.requests[0].resolve('Main-frame enhancement');
    worker.requests[1].resolve('Child-frame enhancement');
    await expect(mainResponse).resolves.toMatchObject({
      success: true,
      enhanced: 'Main-frame enhancement'
    });
    await expect(childResponse).resolves.toMatchObject({
      success: true,
      enhanced: 'Child-frame enhancement'
    });
  });

  test('completed and cancelled entries are cleaned up before later requests', async () => {
    const worker = createWorkerHarness();
    const sender = { tab: { id: 10 }, frameId: 0 };

    const cancelledResponse = enhance(worker, 'first', sender);
    await waitForRequests(worker, 1);
    await worker.send('cancelEnhancement', { requestId: 'first' }, sender);
    await expect(cancelledResponse).resolves.toMatchObject({
      success: false,
      errorCode: 'cancelled'
    });

    const laterResponse = enhance(worker, 'later', sender);
    await waitForRequests(worker, 2);
    expect(worker.requests[1].signal.aborted).toBe(false);
    worker.requests[1].resolve('Later enhancement');

    await expect(laterResponse).resolves.toMatchObject({
      success: true,
      requestId: 'later',
      enhanced: 'Later enhancement'
    });
    await expect(worker.send(
      'cancelEnhancement',
      { requestId: 'later' },
      sender
    )).resolves.toEqual({
      success: true,
      cancelled: false,
      requestId: 'later'
    });
  });
});
