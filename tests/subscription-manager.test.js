const { loadBundledModule } = require('./helpers/load-module');

function createChromeMock(initialStorage = {}) {
  const storage = { ...initialStorage };

  const chrome = {
    runtime: {
      id: 'test-extension',
      lastError: null
    },
    storage: {
      local: {
        get: (keys, callback) => {
          const result = Array.isArray(keys)
            ? Object.fromEntries(keys.map((key) => [key, storage[key]]))
            : { [keys]: storage[keys] };
          callback(JSON.parse(JSON.stringify(result)));
        },
        set: (items, callback) => {
          Object.assign(storage, items);
          callback();
        }
      }
    }
  };

  Object.defineProperty(chrome, '__storage', { value: storage });
  return chrome;
}

describe('SubscriptionManager', () => {
  test('migrates the existing Gemini key once without resetting unrelated settings', async () => {
    const chrome = createChromeMock({
      subscription: {
        type: 'byok',
        active: true,
        apiKey: 'existing-gemini-key',
        provider: 'gemini',
        activatedAt: 123
      },
      enhancerSettings: {
        conversationAwareness: false,
        geminiKey: 'older-settings-key'
      }
    });
    const { default: subscriptionManager } = loadBundledModule(
      'src/background/subscription-manager.js',
      { chrome }
    );

    await subscriptionManager.initialize();

    expect(chrome.__storage.subscription).toMatchObject({
      geminiApiKey: 'existing-gemini-key',
      providerMode: 'auto',
      preferredProvider: 'gemini',
      providerStorageVersion: 2,
      activatedAt: 123
    });
    expect(chrome.__storage.subscription).not.toHaveProperty('apiKey');
    expect(chrome.__storage.enhancerSettings).toEqual({ conversationAwareness: false });

    await subscriptionManager.clearProviderKey('gemini');
    await subscriptionManager.initialize();
    expect(chrome.__storage.subscription.geminiApiKey).toBeUndefined();
  });

  test('stores provider keys separately and clearing Gemini preserves Groq', async () => {
    const chrome = createChromeMock();
    const fetchMock = jest.fn().mockResolvedValue({ status: 200 });
    const { default: subscriptionManager } = loadBundledModule(
      'src/background/subscription-manager.js',
      { chrome, fetch: fetchMock }
    );

    await subscriptionManager.initialize();
    await subscriptionManager.saveProviderKey('gemini', 'gemini-secret');
    await subscriptionManager.saveProviderKey('groq', 'groq-secret');
    await subscriptionManager.setProviderMode('groq');
    await subscriptionManager.clearProviderKey('gemini');

    expect(chrome.__storage.subscription).toMatchObject({
      groqApiKey: 'groq-secret',
      providerMode: 'groq',
      preferredProvider: 'groq',
      type: 'byok'
    });
    expect(chrome.__storage.subscription.geminiApiKey).toBeUndefined();
    expect(await subscriptionManager.getProviderConfiguration()).toMatchObject({
      provider: 'groq',
      apiKey: 'groq-secret'
    });
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer groq-secret');
  });

  test('clearing Groq preserves Gemini and provider selection survives reload', async () => {
    const chrome = createChromeMock();
    const fetchMock = jest.fn().mockResolvedValue({ status: 200 });
    const firstModule = loadBundledModule('src/background/subscription-manager.js', {
      chrome,
      fetch: fetchMock
    });

    await firstModule.default.initialize();
    await firstModule.default.saveProviderKey('gemini', 'gemini-secret');
    await firstModule.default.saveProviderKey('groq', 'groq-secret');
    await firstModule.default.setProviderMode('gemini');
    await firstModule.default.clearProviderKey('groq');

    const reloadedModule = loadBundledModule('src/background/subscription-manager.js', {
      chrome,
      fetch: fetchMock
    });
    const info = await reloadedModule.default.getSubscriptionInfo();
    expect(info).toMatchObject({
      providerMode: 'gemini',
      preferredProvider: 'gemini',
      actualProvider: 'gemini',
      providers: {
        gemini: { configured: true },
        groq: { configured: false }
      }
    });
    expect(chrome.__storage.subscription.geminiApiKey).toBe('gemini-secret');
    expect(chrome.__storage.subscription.groqApiKey).toBeUndefined();
  });

  test.each([
    ['gemini', 'Invalid Gemini API key or API access denied'],
    ['groq', 'Invalid Groq API key or API access denied']
  ])('keeps an invalid %s key out of storage', async (provider, expectedError) => {
    const chrome = createChromeMock();
    const fetchMock = jest.fn().mockResolvedValue({ status: 401 });
    const { default: subscriptionManager } = loadBundledModule(
      'src/background/subscription-manager.js',
      { chrome, fetch: fetchMock }
    );

    const result = await subscriptionManager.saveProviderKey(provider, 'invalid-secret');
    expect(result).toEqual({ success: false, error: expectedError });
    expect(chrome.__storage.subscription?.[`${provider}ApiKey`]).toBeUndefined();
  });

  test('accepts a rate-limited but authenticated key and bounds validation with an abort signal', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      status: 429,
      text: async () => 'quota exhausted'
    });
    const { default: subscriptionManager } = loadBundledModule(
      'src/background/subscription-manager.js',
      {
        chrome: createChromeMock(),
        fetch: fetchMock
      }
    );

    await subscriptionManager.reset();
    const result = await subscriptionManager.activateBYOK('AIza-test-key');

    expect(result.success).toBe(true);
    expect(result.message).toMatch(/rate limit|quota/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].signal).toBeDefined();
  });

  test('serializes concurrent usage updates so enhancement counts are not lost', async () => {
    const chrome = createChromeMock({
      usageStats: {
        events: [],
        totalEnhancements: 0,
        byokEnhancements: 0,
        freeEnhancements: 0
      }
    });
    const { default: subscriptionManager } = loadBundledModule(
      'src/background/subscription-manager.js',
      { chrome }
    );
    await subscriptionManager.reset();

    await Promise.all([
      subscriptionManager.trackEvent('prompt_enhanced'),
      subscriptionManager.trackEvent('prompt_enhanced')
    ]);

    expect(chrome.__storage.usageStats.totalEnhancements).toBe(2);
    expect(chrome.__storage.usageStats.freeEnhancements).toBe(2);
    expect(chrome.__storage.usageStats.events).toHaveLength(2);
  });

  test('rejects a missing replacement key without throwing an internal error', async () => {
    const chrome = createChromeMock({
      subscription: {
        type: 'byok',
        active: true,
        apiKey: 'existing-key'
      }
    });
    const { default: subscriptionManager } = loadBundledModule(
      'src/background/subscription-manager.js',
      { chrome }
    );
    await subscriptionManager.initialize();

    await expect(subscriptionManager.updateAPIKey(undefined)).resolves.toEqual({
      success: false,
      error: 'Gemini API key is required'
    });
  });
});
