const fs = require('fs');
const path = require('path');
const { loadBundledModule } = require('./helpers/load-module');

function createClassList(initial = []) {
  const values = new Set(initial);

  return {
    add: (...names) => names.forEach((name) => values.add(name)),
    remove: (...names) => names.forEach((name) => values.delete(name)),
    contains: (name) => values.has(name)
  };
}

function createChromeMock() {
  let disconnectListener;
  const port = {
    onDisconnect: {
      addListener: jest.fn((listener) => {
        disconnectListener = listener;
      })
    }
  };
  const chrome = {
    runtime: {
      id: 'test-extension',
      connect: jest.fn(() => port),
      sendMessage: jest.fn((_message, callback) => callback?.({ success: true }))
    }
  };

  return {
    chrome,
    port,
    disconnect: () => disconnectListener()
  };
}

function loadMainModule(chrome) {
  return loadBundledModule('src/content/main.js', {
    chrome,
    document: {
      title: 'Test page',
      readyState: 'complete',
      addEventListener: jest.fn()
    },
    window: {
      APE_Extension: { initialized: true },
      location: { hostname: 'example.test' }
    }
  });
}

function loadInlineUIModule(chrome, globals = {}) {
  return loadBundledModule('src/content/inline-ui.js', {
    chrome,
    document: {
      getElementById: jest.fn(() => null)
    },
    ...globals
  });
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

function createEnhancementHarness(InlineUI, overrides = {}) {
  const originalPrompt = 'Explain event delegation';
  const extractor = {
    setConversationAwareness: jest.fn(),
    setContextWindow: jest.fn(),
    extractFullContext: jest.fn(async () => ({
      currentPrompt: originalPrompt,
      conversationHistory: []
    }))
  };
  const domObserver = {
    platform: 'test',
    extractPromptText: jest.fn(() => originalPrompt),
    injectEnhancedPrompt: jest.fn(async () => true)
  };
  const ui = Object.assign(Object.create(InlineUI.prototype), {
    destroyed: false,
    isProcessing: false,
    currentButton: null,
    pageObserver: null,
    dockingObserver: null,
    reattachTimeout: null,
    retryTimeout: null,
    cachedInputElement: null,
    extractor,
    domObserver,
    settings: {},
    showLoading: jest.fn(),
    hideLoading: jest.fn(),
    showToast: jest.fn(),
    getSettings: jest.fn(async () => ({
      conversationAwareness: true,
      contextWindow: 10,
      currentEnhancementType: 'balanced'
    })),
    enhancePrompt: jest.fn(async () => 'Explain JavaScript event delegation with a concise example.'),
    trackEnhancement: jest.fn(async () => undefined)
  }, overrides);

  return { ui, extractor, domObserver, originalPrompt };
}

describe('content script lifecycle', () => {
  test('does not reconnect a lifecycle port after a normal disconnect', () => {
    const { chrome, disconnect } = createChromeMock();
    const { setupExtensionContextMonitor } = loadMainModule(chrome);
    const extension = {
      contextInvalidated: false,
      destroy: jest.fn()
    };

    setupExtensionContextMonitor(extension);
    disconnect();

    expect(chrome.runtime.connect).toHaveBeenCalledTimes(1);
    expect(extension.destroy).not.toHaveBeenCalled();
  });

  test('tears down an instance when its extension context becomes invalid', () => {
    const { chrome, disconnect } = createChromeMock();
    const { setupExtensionContextMonitor } = loadMainModule(chrome);
    const extension = {
      contextInvalidated: false,
      destroy: jest.fn()
    };

    setupExtensionContextMonitor(extension);
    chrome.runtime.id = undefined;
    disconnect();

    expect(extension.contextInvalidated).toBe(true);
    expect(extension.destroy).toHaveBeenCalledTimes(1);
  });

  test('aborts initialization when the context is invalidated while async setup is pending', async () => {
    const { chrome } = createChromeMock();
    const { AIPromptEnhancerExtension } = loadMainModule(chrome);
    const extension = new AIPromptEnhancerExtension();
    let resolveSitePreferences;

    extension.getSitePreferences = jest.fn(() => new Promise((resolve) => {
      resolveSitePreferences = resolve;
    }));
    extension.loadSettings = jest.fn();

    const initializePromise = extension.initialize();
    extension.contextInvalidated = true;
    resolveSitePreferences({ enabled: true, placement: 'auto' });
    await initializePromise;

    expect(extension.loadSettings).not.toHaveBeenCalled();
    expect(extension.initialized).toBe(false);
  });

  test('applies the saved conversation settings when creating the context extractor', () => {
    const mainSource = fs.readFileSync(
      path.resolve(__dirname, '..', 'src', 'content', 'main.js'),
      'utf8'
    );

    expect(mainSource).toContain(
      'this.contextExtractor.setContextWindow(this.settings.contextWindow);'
    );
    expect(mainSource).toContain(
      'this.contextExtractor.setConversationAwareness(this.settings.conversationAwareness);'
    );
  });

  test('does not attach a control after it is destroyed during an input lookup', async () => {
    const { chrome } = createChromeMock();
    const { default: InlineUI } = loadInlineUIModule(chrome);
    let resolveInput;
    const ui = Object.create(InlineUI.prototype);

    ui.destroyed = false;
    ui.buttonId = 'ape-inline-btn-test';
    ui.currentButton = null;
    ui.domObserver = {
      shouldSkipMount: () => false,
      findInputElement: () => new Promise((resolve) => {
        resolveInput = resolve;
      })
    };
    ui.createEnhanceButton = jest.fn(() => ({}));
    ui.dockButton = jest.fn(() => true);
    ui.applyFloatingFallback = jest.fn();

    const attachPromise = ui.performAttachButtonToChatbox();
    ui.destroyed = true;
    resolveInput({ tagName: 'TEXTAREA', className: 'composer' });
    await attachPromise;

    expect(ui.createEnhanceButton).not.toHaveBeenCalled();
    expect(ui.dockButton).not.toHaveBeenCalled();
  });
});

describe('inline loading state', () => {
  test('replaces the enhance icon with a visible spinner while processing', () => {
    const { chrome } = createChromeMock();
    const { default: InlineUI } = loadInlineUIModule(chrome);
    const icon = { classList: createClassList() };
    const spinner = { classList: createClassList(['ape-hidden']) };
    const button = {
      disabled: false,
      classList: createClassList(),
      setAttribute: jest.fn(),
      removeAttribute: jest.fn(),
      querySelector: jest.fn((selector) => {
        if (selector === '.ape-icon-enhance') return icon;
        if (selector === '.ape-spinner-inline') return spinner;
        return null;
      })
    };
    const ui = { currentButton: button };

    InlineUI.prototype.showLoading.call(ui);

    expect(button.disabled).toBe(true);
    expect(button.classList.contains('ape-processing')).toBe(true);
    expect(icon.classList.contains('ape-hidden')).toBe(true);
    expect(spinner.classList.contains('ape-hidden')).toBe(false);
    expect(button.setAttribute).toHaveBeenCalledWith('aria-busy', 'true');

    InlineUI.prototype.hideLoading.call(ui);

    expect(button.disabled).toBe(false);
    expect(button.classList.contains('ape-processing')).toBe(false);
    expect(icon.classList.contains('ape-hidden')).toBe(false);
    expect(spinner.classList.contains('ape-hidden')).toBe(true);
    expect(button.removeAttribute).toHaveBeenCalledWith('aria-busy');
  });

  test('the service worker registers a receiver for the lifecycle port', () => {
    const serviceWorkerSource = fs.readFileSync(
      path.resolve(__dirname, '..', 'src', 'background', 'service-worker.js'),
      'utf8'
    );

    expect(serviceWorkerSource).toMatch(/runtime\.onConnect\.addListener/);
    expect(serviceWorkerSource).toContain('ape-context-lifecycle');
  });
});

describe('inline enhancement request lifecycle', () => {
  test('prevents rapid duplicate clicks from starting overlapping requests', async () => {
    const { chrome } = createChromeMock();
    const { default: InlineUI } = loadInlineUIModule(chrome);
    const contextDeferred = createDeferred();
    const { ui, extractor } = createEnhancementHarness(InlineUI);
    extractor.extractFullContext.mockReturnValueOnce(contextDeferred.promise);

    const firstClick = ui.handleEnhanceClick();
    const secondClick = ui.handleEnhanceClick();
    await secondClick;
    await new Promise((resolve) => setImmediate(resolve));

    expect(ui.getSettings).toHaveBeenCalledTimes(1);
    expect(extractor.extractFullContext).toHaveBeenCalledTimes(1);

    contextDeferred.resolve({
      currentPrompt: 'Explain event delegation',
      conversationHistory: []
    });
    await firstClick;

    expect(ui.enhancePrompt).toHaveBeenCalledTimes(1);
  });

  test('applies fresh conversation settings before extracting context', async () => {
    const { chrome } = createChromeMock();
    const { default: InlineUI } = loadInlineUIModule(chrome);
    const freshSettings = {
      conversationAwareness: false,
      contextWindow: 4,
      currentEnhancementType: 'balanced'
    };
    const { ui, extractor } = createEnhancementHarness(InlineUI, {
      getSettings: jest.fn(async () => freshSettings)
    });

    await ui.handleEnhanceClick();

    expect(extractor.setConversationAwareness).toHaveBeenCalledWith(false);
    expect(extractor.setContextWindow).toHaveBeenCalledWith(4);
    expect(extractor.setConversationAwareness.mock.invocationCallOrder[0])
      .toBeLessThan(extractor.extractFullContext.mock.invocationCallOrder[0]);
    expect(extractor.setContextWindow.mock.invocationCallOrder[0])
      .toBeLessThan(extractor.extractFullContext.mock.invocationCallOrder[0]);
  });

  test('does not overwrite a draft that changed while enhancement was in flight', async () => {
    const { chrome } = createChromeMock();
    const { default: InlineUI } = loadInlineUIModule(chrome);
    const enhancementDeferred = createDeferred();
    const { ui, domObserver } = createEnhancementHarness(InlineUI, {
      enhancePrompt: jest.fn(() => enhancementDeferred.promise)
    });

    const enhancement = ui.handleEnhanceClick();
    await new Promise((resolve) => setImmediate(resolve));
    domObserver.extractPromptText.mockReturnValue('The user edited this draft');
    enhancementDeferred.resolve('An enhanced prompt that is now stale.');
    await enhancement;

    expect(domObserver.injectEnhancedPrompt).not.toHaveBeenCalled();
    expect(ui.showToast).toHaveBeenCalledWith(
      expect.stringMatching(/prompt changed/i),
      expect.stringMatching(/info|warning/)
    );
  });

  test('does not inject a same-text result after SPA navigation changes the conversation', async () => {
    const { chrome } = createChromeMock();
    const { default: InlineUI } = loadInlineUIModule(chrome);
    const enhancementDeferred = createDeferred();
    let route = 'https://chat.example/conversation/one';
    const { ui, domObserver } = createEnhancementHarness(InlineUI, {
      enhancePrompt: jest.fn(() => enhancementDeferred.promise),
      getRouteIdentity: jest.fn(() => route)
    });

    const enhancement = ui.handleEnhanceClick();
    await new Promise((resolve) => setImmediate(resolve));
    route = 'https://chat.example/conversation/two';
    enhancementDeferred.resolve('An enhanced result from the previous conversation.');
    await enhancement;

    expect(domObserver.injectEnhancedPrompt).not.toHaveBeenCalled();
    expect(ui.showToast).toHaveBeenCalledWith(
      expect.stringMatching(/prompt changed/i),
      'info'
    );
  });

  test('does not overwrite leading or trailing edits made while enhancement is running', async () => {
    const { chrome } = createChromeMock();
    const { default: InlineUI } = loadInlineUIModule(chrome);
    const enhancementDeferred = createDeferred();
    const { ui, domObserver } = createEnhancementHarness(InlineUI, {
      enhancePrompt: jest.fn(() => enhancementDeferred.promise)
    });

    const enhancement = ui.handleEnhanceClick();
    await new Promise((resolve) => setImmediate(resolve));
    domObserver.extractPromptText.mockReturnValue(' Explain event delegation ');
    enhancementDeferred.resolve('Explain event delegation with an example.');
    await enhancement;

    expect(domObserver.injectEnhancedPrompt).not.toHaveBeenCalled();
  });

  test('cancels the active worker request when destroyed', async () => {
    const { chrome } = createChromeMock();
    let resolveEnhancement;
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      if (message.action === 'enhancePrompt') {
        resolveEnhancement = callback;
        return;
      }
      callback?.({ success: true });
    });
    const { default: InlineUI } = loadInlineUIModule(chrome);
    const { ui } = createEnhancementHarness(InlineUI);

    const enhancement = InlineUI.prototype.enhancePrompt.call(
      ui,
      { currentPrompt: 'Explain event delegation', conversationHistory: [] },
      'balanced',
      {}
    );
    await new Promise((resolve) => setImmediate(resolve));
    const requestMessage = chrome.runtime.sendMessage.mock.calls
      .map(([message]) => message)
      .find((message) => message.action === 'enhancePrompt');

    expect(requestMessage.data.requestId).toEqual(expect.any(String));

    ui.destroy();

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'cancelEnhancement',
        data: { requestId: requestMessage.data.requestId }
      }),
      expect.any(Function)
    );

    resolveEnhancement({ success: false, error: 'Enhancement cancelled', code: 'cancelled' });
    await expect(enhancement).rejects.toMatchObject({ code: 'cancelled' });
  });

  test('always clears loading state after a backend error', async () => {
    const { chrome } = createChromeMock();
    const { default: InlineUI } = loadInlineUIModule(chrome);
    const backendError = Object.assign(new Error('Provider unavailable'), {
      code: 'server_error'
    });
    const { ui } = createEnhancementHarness(InlineUI, {
      enhancePrompt: jest.fn().mockRejectedValue(backendError)
    });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await ui.handleEnhanceClick();

      expect(ui.isProcessing).toBe(false);
      expect(ui.showLoading).toHaveBeenCalledTimes(1);
      expect(ui.hideLoading).toHaveBeenCalledTimes(1);
      expect(ui.showToast).toHaveBeenCalledWith(
        'The selected provider is temporarily unavailable. Please try again.',
        'warning'
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  test('always clears loading state after cancellation', async () => {
    const { chrome } = createChromeMock();
    const { default: InlineUI } = loadInlineUIModule(chrome);
    const cancellation = Object.assign(new Error('Enhancement cancelled'), {
      code: 'cancelled'
    });
    const { ui } = createEnhancementHarness(InlineUI, {
      enhancePrompt: jest.fn().mockRejectedValue(cancellation)
    });

    await ui.handleEnhanceClick();

    expect(ui.isProcessing).toBe(false);
    expect(ui.showLoading).toHaveBeenCalledTimes(1);
    expect(ui.hideLoading).toHaveBeenCalledTimes(1);
  });

  test('always clears loading state after applying a local fallback', async () => {
    const { chrome } = createChromeMock();
    const { default: InlineUI } = loadInlineUIModule(chrome);
    const { ui, domObserver } = createEnhancementHarness(InlineUI);
    ui.enhancePrompt.mockImplementation(async () => {
      ui.lastEnhancementUsedFallback = true;
      ui.lastFallbackReason = 'rate_limit';
      return 'Explain JavaScript event delegation with a concise example.';
    });

    await ui.handleEnhanceClick();

    expect(domObserver.injectEnhancedPrompt).toHaveBeenCalledTimes(1);
    expect(ui.isProcessing).toBe(false);
    expect(ui.showLoading).toHaveBeenCalledTimes(1);
    expect(ui.hideLoading).toHaveBeenCalledTimes(1);
    expect(ui.showToast).toHaveBeenCalledWith(
      'Gemini rate limit reached; used local enhancement',
      'warning'
    );
  });

  test('surfaces the classified provider failure when fallback makes no change', async () => {
    const { chrome } = createChromeMock();
    const { default: InlineUI } = loadInlineUIModule(chrome);
    const { ui, domObserver, originalPrompt } = createEnhancementHarness(InlineUI);
    ui.enhancePrompt.mockImplementation(async () => {
      ui.lastEnhancementUsedFallback = true;
      ui.lastFallbackReason = 'timeout';
      return originalPrompt;
    });

    await ui.handleEnhanceClick();

    expect(domObserver.injectEnhancedPrompt).not.toHaveBeenCalled();
    expect(ui.showToast).toHaveBeenCalledWith(
      'Gemini timed out; used local enhancement',
      'warning'
    );
  });
});
