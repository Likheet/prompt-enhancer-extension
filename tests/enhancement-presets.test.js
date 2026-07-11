const { loadBundledModule } = require('./helpers/load-module');

function createChromeMock(settings = {}) {
  return {
    runtime: {
      id: 'test-extension',
      lastError: null,
      sendMessage: (_message, callback) => callback({ type: 'free', active: true })
    },
    storage: {
      local: {
        get: (_keys, callback) => callback({ enhancerSettings: settings }),
        set: (_items, callback) => callback()
      }
    }
  };
}

describe('EnhancementPresets', () => {
  test('honors the selected preset locally when no API key is configured', async () => {
    const { default: EnhancementPresets } = loadBundledModule(
      'src/content/enhancement-presets.js',
      { chrome: createChromeMock() }
    );
    const presets = new EnhancementPresets();

    const enhanced = await presets.enhanceWithPreset(
      {
        currentPrompt: 'write a function',
        conversationHistory: [],
        metadata: {}
      },
      'technical'
    );

    expect(enhanced).toMatch(/programming language/i);
    expect(enhanced).toMatch(/error handling/i);
    expect(enhanced).toMatch(/documentation/i);
  });

  test('falls back to local preset rules when Gemini is unavailable', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('Network unavailable'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const warningSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { default: EnhancementPresets } = loadBundledModule(
      'src/content/enhancement-presets.js',
      {
        chrome: createChromeMock({ geminiKey: 'configured-key' }),
        fetch: fetchMock
      }
    );
    const presets = new EnhancementPresets();

    try {
      const enhanced = await presets.enhanceWithPreset(
        {
          currentPrompt: 'write a function',
          conversationHistory: [],
          metadata: {}
        },
        'technical'
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(enhanced).toMatch(/programming language/i);
      expect(enhanced).toMatch(/error handling/i);
    } finally {
      errorSpy.mockRestore();
      warningSpy.mockRestore();
    }
  });

  test('uses the current Gemini endpoint and header authentication', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Enhanced prompt' }] } }]
      })
    });
    const { default: EnhancementPresets } = loadBundledModule(
      'src/content/enhancement-presets.js',
      {
        chrome: createChromeMock({ geminiKey: 'configured-key' }),
        fetch: fetchMock
      }
    );
    const presets = new EnhancementPresets();

    const enhanced = await presets.enhanceWithPreset(
      {
        currentPrompt: 'make this clearer',
        conversationHistory: [],
        metadata: {}
      },
      'balanced'
    );

    expect(enhanced).toBe('Enhanced prompt');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent'
    );
    expect(request.headers['x-goog-api-key']).toBe('configured-key');
  });
});
