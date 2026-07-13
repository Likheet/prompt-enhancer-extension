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

function createGeminiResponse(payload, status = 200, headers = {}) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}

function enhancedPromptJson(prompt) {
  return JSON.stringify({ enhanced_prompt: prompt });
}

function createContext(overrides = {}) {
  return {
    currentPrompt: 'make this clearer',
    conversationHistory: [],
    metadata: {},
    ...overrides
  };
}

function createPresetHarness(fetchMock, settings = {}) {
  const { default: EnhancementPresets } = loadBundledModule(
    'src/content/enhancement-presets.js',
    {
      chrome: createChromeMock(settings),
      fetch: fetchMock
    }
  );

  return new EnhancementPresets();
}

function captureOutcome(promise) {
  return promise.then(
    value => ({ status: 'fulfilled', value }),
    error => ({ status: 'rejected', error })
  );
}

describe('EnhancementPresets', () => {
  test('keeps the source unchanged in the conservative local path', async () => {
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

    expect(enhanced).toBe('write a function');
  });

  test('surfaces a Gemini network failure instead of injecting local rules', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('Network unavailable'));
    const { default: EnhancementPresets } = loadBundledModule(
      'src/content/enhancement-presets.js',
      {
        chrome: createChromeMock({ geminiKey: 'configured-key' }),
        fetch: fetchMock
      }
    );
    const presets = new EnhancementPresets();

    await expect(presets.enhanceWithPreset(
      { currentPrompt: 'write a function', conversationHistory: [], metadata: {} },
      'technical'
    )).rejects.toMatchObject({ code: 'network' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('does not replace the prompt with generic local rules when a configured provider fails', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('Network unavailable'));
    const presets = createPresetHarness(fetchMock);
    const fallbackSpy = jest.spyOn(presets, 'enhanceWithRules');

    const outcome = await captureOutcome(presets.enhanceWithPreset(
      createContext({ currentPrompt: 'Keep the existing API and add validation.' }),
      'technical',
      null,
      { settings: {}, apiKey: 'configured-key', returnResult: true }
    ));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(outcome.status).toBe('rejected');
    expect(outcome.error).toMatchObject({ code: 'network' });
    expect(fallbackSpy).not.toHaveBeenCalled();
  });

  test('uses the current Gemini endpoint and header authentication', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: enhancedPromptJson('Enhanced prompt') }] } }]
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
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent'
    );
    expect(request.headers['x-goog-api-key']).toBe('configured-key');
  });

  test('rejects an empty Gemini response after assembling the bounded context window', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [] })
    });
    const { default: EnhancementPresets } = loadBundledModule(
      'src/content/enhancement-presets.js',
      {
        chrome: createChromeMock({ geminiKey: 'configured-key', contextWindow: 1 }),
        fetch: fetchMock
      }
    );
    const presets = new EnhancementPresets();

    await expect(presets.enhanceWithPreset(
      {
        currentPrompt: 'Continue with the latest function context.',
        conversationHistory: [
          { role: 'user', content: 'older context that must not be sent' },
          { role: 'assistant', content: 'latest context that should be sent' }
        ],
        metadata: {}
      },
      'technical'
    )).rejects.toMatchObject({ code: 'response_empty' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const requestText = body.contents[0].parts[0].text;
    expect(requestText).toContain('latest context that should be sent');
    expect(requestText).not.toContain('older context that must not be sent');
  });

  test('sends conversation history as delimited context with separate system instructions', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: enhancedPromptJson('Rewrite the parser without changing its public API.') }] } }]
      })
    });
    const { default: EnhancementPresets } = loadBundledModule(
      'src/content/enhancement-presets.js',
      {
        chrome: createChromeMock({
          geminiKey: 'configured-key',
          conversationAwareness: true,
          contextWindow: 4
        }),
        fetch: fetchMock
      }
    );
    const presets = new EnhancementPresets();

    await presets.enhanceWithPreset(
      {
        currentPrompt: 'Now rewrite it but keep the same API.',
        conversationHistory: [
          { role: 'user', content: 'The parser is failing on nested arrays.' },
          { role: 'assistant', content: 'The recursive branch mutates the token stream.' }
        ],
        metadata: {}
      },
      'balanced'
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.systemInstruction.parts[0].text).toMatch(/do not answer, execute, diagnose/i);
    expect(body.systemInstruction.parts[0].text).toMatch(/preserve intent/i);
    expect(body.contents).toHaveLength(1);
    expect(body.contents[0].role).toBe('user');
    const requestText = body.contents[0].parts[0].text;
    expect(requestText).toContain('<conversation_context>');
    expect(requestText).toContain('The parser is failing on nested arrays.');
    expect(requestText).toContain('The recursive branch mutates the token stream.');
    expect(requestText).toContain('<draft_prompt>');
    expect(requestText).toContain('Now rewrite it but keep the same API.');
  });

  test.each([
    ['standard', 'DIRECT'],
    ['structured', 'BLUEPRINT'],
    ['custom', 'CUSTOM']
  ])('builds a mode-specific %s request contract without the legacy preset layer', (promptTemplateType, expectedMode) => {
    const presets = createPresetHarness(jest.fn());
    const request = presets.buildEnhancementRequest(
      'Legacy balanced style that must not route the rewrite mode.',
      createContext({
        currentPrompt: 'Turn what I described earlier into a detailed implementation prompt for a coding AI.',
        conversationHistory: [{ role: 'user', content: 'Use ChatGPT, Claude, Gemini, Perplexity, Kimi, and DeepSeek.' }]
      }),
      {
        promptTemplateType,
        currentEnhancementType: 'balanced',
        conversationAwareness: true,
        customPromptTemplate: 'Keep every explicit constraint and preserve the requested format.'
      }
    );

    expect(request.userPrompt).toContain(`<mode>${expectedMode}</mode>`);
    expect(request.userPrompt).toContain('<conversation_context>');
    expect(request.userPrompt).toContain('<draft_prompt>');
    expect(request.userPrompt).not.toContain('<preset>');
    expect(request.userPrompt).not.toContain('<template_mode>');
    expect(request.systemInstruction).not.toContain('Legacy balanced style');
    expect(request.systemInstruction).toMatch(/preserve task type/i);

    if (expectedMode === 'DIRECT') {
      expect(request.systemInstruction).toMatch(/never automatically add.*role.*objective/i);
    }
    if (expectedMode === 'BLUEPRINT') {
      expect(request.systemInstruction).toMatch(/use a structured format/i);
    }
    if (expectedMode === 'CUSTOM') {
      expect(request.userPrompt).toContain('<custom_instructions>');
    }
  });

  test('uses a one-field structured response for Gemini and validates the same JSON-object shape from Groq', async () => {
    const geminiFetch = jest.fn().mockResolvedValue(createGeminiResponse({
      candidates: [{
        content: { parts: [{ text: '{"enhanced_prompt":"Keep the Tuesday university exam request polite."}' }] },
        finishReason: 'STOP'
      }]
    }));
    const groqFetch = jest.fn().mockResolvedValue(createGeminiResponse({
      choices: [{
        message: { content: '{"enhanced_prompt":"Keep the Tuesday university exam request polite."}' },
        finish_reason: 'stop'
      }]
    }));
    const context = createContext({ currentPrompt: 'Ask to swap my Tuesday shift for a university exam.' });

    const geminiResult = await createPresetHarness(geminiFetch).enhanceWithPreset(context, 'balanced', null, {
      provider: 'gemini', apiKey: 'gemini-key', settings: {}, returnResult: true
    });
    const groqResult = await createPresetHarness(groqFetch).enhanceWithPreset(context, 'balanced', null, {
      provider: 'groq', apiKey: 'groq-key', settings: {}, returnResult: true
    });

    const geminiBody = JSON.parse(geminiFetch.mock.calls[0][1].body);
    const groqBody = JSON.parse(groqFetch.mock.calls[0][1].body);
    expect(geminiBody.generationConfig).toMatchObject({
      responseMimeType: 'application/json',
      responseJsonSchema: {
        required: ['enhanced_prompt'],
        additionalProperties: false
      }
    });
    expect(groqBody.response_format).toEqual({ type: 'json_object' });
    expect(geminiResult.enhanced).toBe('Keep the Tuesday university exam request polite.');
    expect(groqResult.enhanced).toBe('Keep the Tuesday university exam request polite.');
  });

  test('rejects extra structured-response fields instead of injecting unvalidated provider output', async () => {
    const fetchMock = jest.fn().mockResolvedValue(createGeminiResponse({
      candidates: [{
        content: { parts: [{ text: '{"enhanced_prompt":"Keep the API stable.","analysis":"ignored"}' }] },
        finishReason: 'STOP'
      }]
    }));

    await expect(createPresetHarness(fetchMock).enhanceWithPreset(
      createContext(),
      'balanced',
      null,
      { provider: 'gemini', apiKey: 'gemini-key', settings: {}, returnResult: true }
    )).rejects.toMatchObject({ code: 'response_invalid' });
  });

  test('development diagnostics expose request shape without prompt text or keys', () => {
    const warningSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    global.__APE_DEBUG__ = true;
    try {
      createPresetHarness(jest.fn()).buildEnhancementRequest(
        createContext({
          currentPrompt: 'PRIVATE-DRAFT-DO-NOT-LOG',
          conversationHistory: [{ role: 'user', content: 'PRIVATE-HISTORY-DO-NOT-LOG' }]
        }),
        { promptTemplateType: 'standard', conversationAwareness: true }
      );
      const output = JSON.stringify(warningSpy.mock.calls);
      expect(output).toContain('request_assembled');
      expect(output).not.toContain('PRIVATE-DRAFT-DO-NOT-LOG');
      expect(output).not.toContain('PRIVATE-HISTORY-DO-NOT-LOG');
      expect(output).not.toContain('apiKey');
    } finally {
      delete global.__APE_DEBUG__;
      warningSpy.mockRestore();
    }
  });

  test('does not send conversation history when conversation awareness is disabled', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: enhancedPromptJson('Improve this prompt.') }] } }]
      })
    });
    const { default: EnhancementPresets } = loadBundledModule(
      'src/content/enhancement-presets.js',
      {
        chrome: createChromeMock({
          geminiKey: 'configured-key',
          conversationAwareness: false,
          contextWindow: 10
        }),
        fetch: fetchMock
      }
    );
    const presets = new EnhancementPresets();

    await presets.enhanceWithPreset(
      {
        currentPrompt: 'Improve this.',
        conversationHistory: [
          { role: 'user', content: 'private prior turn that should be excluded' }
        ],
        metadata: {}
      },
      'balanced'
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const requestText = body.contents[0].parts[0].text;
    expect(requestText).not.toContain('private prior turn that should be excluded');
    expect(requestText).toContain('<conversation_context>NONE</conversation_context>');
  });

  test('limits independent prompts to recent and keyword-relevant history', async () => {
    const fetchMock = jest.fn().mockResolvedValue(createGeminiResponse({
      candidates: [{ content: { parts: [{ text: enhancedPromptJson('Write a concise haiku about rain.') }] } }]
    }));
    const presets = createPresetHarness(fetchMock);
    const history = [
      { role: 'user', content: 'Private unrelated account discussion.' },
      { role: 'assistant', content: 'Unrelated account answer.' },
      { role: 'user', content: 'For the poem, use rain imagery.' },
      { role: 'assistant', content: 'Rain imagery can be quiet and reflective.' },
      { role: 'user', content: 'Another unrelated topic.' },
      { role: 'assistant', content: 'Another unrelated response.' },
      { role: 'user', content: 'Keep the next answer concise.' },
      { role: 'assistant', content: 'Understood.' }
    ];

    await presets.enhanceWithPreset(
      createContext({ currentPrompt: 'Draft a haiku about rain.', conversationHistory: history }),
      'creative',
      null,
      {
        settings: { conversationAwareness: true, contextWindow: 10 },
        apiKey: 'configured-key'
      }
    );

    const requestText = JSON.parse(fetchMock.mock.calls[0][1].body).contents[0].parts[0].text;
    expect(requestText).toContain('For the poem, use rain imagery.');
    expect(requestText).toContain('Keep the next answer concise.');
    expect(requestText).not.toContain('Private unrelated account discussion.');
  });

  test('does not send unrelated recent history for a self-contained prompt', async () => {
    const fetchMock = jest.fn().mockResolvedValue(createGeminiResponse({
      candidates: [{ content: { parts: [{ text: enhancedPromptJson('Create an accessible dark-mode toggle button.') }] } }]
    }));
    const presets = createPresetHarness(fetchMock);

    await presets.enhanceWithPreset(
      createContext({
        currentPrompt: 'Create a button that toggles dark mode.',
        conversationHistory: [
          { role: 'user', content: 'My private travel plans are unrelated.' },
          { role: 'assistant', content: 'Here is an unrelated itinerary.' }
        ]
      }),
      'technical',
      null,
      {
        settings: { conversationAwareness: true, contextWindow: 10 },
        apiKey: 'configured-key'
      }
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const requestText = body.contents[0].parts[0].text;
    expect(requestText).toContain('<conversation_context>NONE</conversation_context>');
    expect(requestText).not.toContain('private travel plans');
    expect(body.generationConfig.thinkingConfig.thinkingLevel).toBe('minimal');
  });

  test('does not treat a self-contained edit target as a conversation continuation', async () => {
    const fetchMock = jest.fn().mockResolvedValue(createGeminiResponse({
      candidates: [{ content: { parts: [{ text: enhancedPromptJson('Rewrite the supplied paragraph concisely.') }] } }]
    }));
    const presets = createPresetHarness(fetchMock);

    await presets.enhanceWithPreset(
      createContext({
        currentPrompt: 'Rewrite this paragraph: Product onboarding should feel effortless.',
        conversationHistory: [
          { role: 'user', content: 'Private unrelated financial discussion.' },
          { role: 'assistant', content: 'Unrelated financial answer.' }
        ]
      }),
      'concise',
      null,
      {
        settings: { conversationAwareness: true, contextWindow: 10 },
        apiKey: 'configured-key'
      }
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.contents[0].parts[0].text)
      .toContain('<conversation_context>NONE</conversation_context>');
    expect(body.generationConfig.thinkingConfig.thinkingLevel).toBe('minimal');
  });

  test('keeps recent history for an anaphoric follow-up without keyword overlap', async () => {
    const fetchMock = jest.fn().mockResolvedValue(createGeminiResponse({
      candidates: [{ content: { parts: [{ text: enhancedPromptJson('Convert the API to TypeScript and add validation.') }] } }]
    }));
    const presets = createPresetHarness(fetchMock);

    await presets.enhanceWithPreset(
      createContext({
        currentPrompt: 'Turn that into TypeScript and add validation.',
        conversationHistory: [
          { role: 'user', content: 'Build a small Node API for user profiles.' },
          { role: 'assistant', content: 'Use an Express route with an in-memory profile store.' }
        ]
      }),
      'technical',
      null,
      {
        settings: { conversationAwareness: true, contextWindow: 10 },
        apiKey: 'configured-key'
      }
    );

    const requestText = JSON.parse(fetchMock.mock.calls[0][1].body).contents[0].parts[0].text;
    expect(requestText).toContain('Build a small Node API for user profiles.');
    expect(requestText).toContain('Use an Express route with an in-memory profile store.');
  });

  test('uses a bounded rewrite contract rather than inviting open-ended output', () => {
    const presets = createPresetHarness(jest.fn());
    const request = presets.buildEnhancementRequest(
      presets.getPreset('balanced').systemPrompt,
      createContext({ currentPrompt: 'Write a launch email for the update.' }),
      { conversationAwareness: false }
    );

    expect(request.systemInstruction).toContain('Do not ask the user for clarification or offer options.');
    expect(request.systemInstruction).toContain('Do not broaden a defined task into an open-ended exploration');
  });

  test('combines every non-thought text part in a successful Gemini response', async () => {
    const fetchMock = jest.fn().mockResolvedValue(createGeminiResponse({
      candidates: [{
        content: {
          parts: [
            { text: 'Internal reasoning that must not be returned.', thought: true },
            { text: '{"enhanced_prompt":"Rewrite the parser ' },
            { text: 'without changing its public API."}' },
            { thoughtSignature: 'opaque-signature' }
          ]
        },
        finishReason: 'STOP'
      }]
    }));
    const presets = createPresetHarness(fetchMock);

    const result = await presets.enhanceWithPreset(
      createContext(),
      'balanced',
      null,
      {
        settings: { conversationAwareness: true },
        apiKey: 'configured-key',
        returnResult: true
      }
    );

    expect(result).toMatchObject({
      enhanced: 'Rewrite the parser without changing its public API.',
      method: 'gemini',
      fallback: false
    });
    expect(result.enhanced).not.toContain('Internal reasoning');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('uses a later valid candidate when the first candidate has no usable text', async () => {
    const fetchMock = jest.fn().mockResolvedValue(createGeminiResponse({
      candidates: [
        { content: { parts: [{ thought: true, text: 'Internal reasoning' }] }, finishReason: 'STOP' },
        { content: { parts: [{ text: enhancedPromptJson('A valid enhanced prompt.') }] }, finishReason: 'STOP' }
      ]
    }));
    const presets = createPresetHarness(fetchMock);

    const result = await presets.enhanceWithPreset(
      createContext(),
      'balanced',
      null,
      { settings: {}, apiKey: 'configured-key', returnResult: true }
    );

    expect(result).toMatchObject({
      enhanced: 'A valid enhanced prompt.',
      method: 'gemini',
      fallback: false
    });
  });

  test('classifies malformed JSON and does not retry it', async () => {
    const fetchMock = jest.fn().mockResolvedValue(createGeminiResponse('{not valid JSON'));
    const presets = createPresetHarness(fetchMock);

    await expect(presets.enhanceWithPreset(
      createContext({ currentPrompt: 'write a function' }),
      'technical',
      null,
      { settings: {}, apiKey: 'configured-key', returnResult: true }
    )).rejects.toMatchObject({
      code: 'response_parse',
      timings: {
        requestConstructionMs: expect.any(Number),
        networkApiMs: expect.any(Number),
        responseParsingMs: expect.any(Number),
        providerTotalMs: expect.any(Number)
      }
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test.each([
    [429, 'rate_limit'],
    [503, 'server_error']
  ])('does not repeat a foreground request after status %i', async (status, errorCode) => {
    jest.useFakeTimers();
    const fetchMock = jest.fn().mockImplementation(() => Promise.resolve(createGeminiResponse(
      { error: { code: status, message: 'temporary failure' } },
      status
    )));
    const presets = createPresetHarness(fetchMock);

    try {
      const resultPromise = captureOutcome(presets.enhanceWithPreset(
        createContext({ currentPrompt: 'write a function' }),
        'technical',
        null,
        {
          settings: {},
          apiKey: 'configured-key',
          returnResult: true
        }
      ));

      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({ status: 'rejected', error: { code: errorCode } });
    } finally {
      jest.useRealTimers();
    }
  });

  test('does not issue a second provider request after a transient failure', async () => {
    jest.useFakeTimers();
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(createGeminiResponse(
        { error: { code: 503, message: 'temporary failure' } },
        503
      ))
      .mockResolvedValueOnce(createGeminiResponse({
        candidates: [{
          content: { parts: [{ text: enhancedPromptJson('Enhanced after one retry.') }] },
          finishReason: 'STOP'
        }]
      }));
    const presets = createPresetHarness(fetchMock);
    const fallbackSpy = jest.spyOn(presets, 'enhanceWithRules');

    try {
      const resultPromise = captureOutcome(presets.enhanceWithPreset(
        createContext(),
        'balanced',
        null,
        {
          settings: {},
          apiKey: 'configured-key',
          returnResult: true
        }
      ));

      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({ status: 'rejected', error: { code: 'server_error', attempts: 1 } });
      expect(fallbackSpy).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  test('does not schedule a retry or local fallback after a rate limit', async () => {
    const fetchMock = jest.fn().mockResolvedValue(createGeminiResponse(
      { error: { code: 429, message: 'retry later' } },
      429,
      { 'Retry-After': '0.75' }
    ));
    const presets = createPresetHarness(fetchMock);
    const fallbackSpy = jest.spyOn(presets, 'enhanceWithRules');

    const outcome = await captureOutcome(presets.enhanceWithPreset(
      createContext(),
      'balanced',
      null,
      {
        settings: {},
        apiKey: 'configured-key',
        returnResult: true
      }
    ));

    expect(outcome).toMatchObject({ status: 'rejected', error: { code: 'rate_limit' } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fallbackSpy).not.toHaveBeenCalled();
  });

  test('classifies authentication failure and does not retry it', async () => {
    const fetchMock = jest.fn().mockResolvedValue(createGeminiResponse(
      { error: { code: 401, message: 'invalid key' } },
      401
    ));
    const presets = createPresetHarness(fetchMock);

    await expect(presets.enhanceWithPreset(
      createContext({ currentPrompt: 'write a function' }),
      'technical',
      null,
      { settings: {}, apiKey: 'configured-key', returnResult: true }
    )).rejects.toMatchObject({ code: 'auth', attempts: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('uses minimal thinking for simple and context-heavy prompt transformations', async () => {
    const fetchMock = jest.fn().mockImplementation(() => Promise.resolve(createGeminiResponse({
      candidates: [{
        content: { parts: [{ text: enhancedPromptJson('Enhanced prompt') }] },
        finishReason: 'STOP'
      }]
    })));
    const presets = createPresetHarness(fetchMock);

    await presets.enhanceWithPreset(
      createContext({ currentPrompt: 'make this clearer' }),
      'balanced',
      null,
      {
        settings: { conversationAwareness: true, contextWindow: 10 },
        apiKey: 'configured-key'
      }
    );

    const heavyHistory = Array.from({ length: 8 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `Conversation turn ${index + 1}: ${'relevant detail '.repeat(30)}`
    }));
    await presets.enhanceWithPreset(
      createContext({
        currentPrompt: 'Continue the previous work while preserving every decision and constraint.',
        conversationHistory: heavyHistory
      }),
      'balanced',
      null,
      {
        settings: { conversationAwareness: true, contextWindow: 10 },
        apiKey: 'configured-key'
      }
    );

    const simpleBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    const contextHeavyBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(simpleBody.generationConfig.thinkingConfig.thinkingLevel).toBe('minimal');
    expect(contextHeavyBody.generationConfig.thinkingConfig.thinkingLevel).toBe('minimal');
  });

  test('handles a long source prompt without truncating its requirements', async () => {
    const fetchMock = jest.fn().mockResolvedValue(createGeminiResponse({
      candidates: [{
        content: { parts: [{ text: enhancedPromptJson('A complete enhanced long-form request.') }] },
        finishReason: 'STOP'
      }]
    }));
    const presets = createPresetHarness(fetchMock);
    const longPrompt = `BEGIN-REQUIREMENTS\n${'Preserve this detailed requirement. '.repeat(600)}\nEND-REQUIREMENTS`;

    const enhanced = await presets.enhanceWithPreset(
      createContext({ currentPrompt: longPrompt }),
      'detailed',
      null,
      {
        settings: { conversationAwareness: true },
        apiKey: 'configured-key'
      }
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(enhanced).toBe('A complete enhanced long-form request.');
    expect(body.contents[0].parts[0].text).toContain('BEGIN-REQUIREMENTS');
    expect(body.contents[0].parts[0].text).toContain('END-REQUIREMENTS');
    expect(body.generationConfig.thinkingConfig.thinkingLevel).toBe('minimal');
    expect(body.generationConfig.maxOutputTokens).toBeGreaterThan(4096);
    expect(body.generationConfig.maxOutputTokens).toBeLessThanOrEqual(32768);
  });

  test('classifies a provider safety block without retrying', async () => {
    const fetchMock = jest.fn().mockResolvedValue(createGeminiResponse({
      promptFeedback: { blockReason: 'SAFETY' }
    }));
    const presets = createPresetHarness(fetchMock);

    const result = captureOutcome(presets.enhanceWithPreset(
      createContext({ currentPrompt: 'write a function' }),
      'technical',
      null,
      {
        settings: {},
        apiKey: 'configured-key',
        returnResult: true
      }
    ));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(result).resolves.toMatchObject({
      status: 'rejected', error: { code: 'content_blocked', attempts: 1 }
    });
  });

  test('surfaces a bounded timeout without local fallback', async () => {
    jest.useFakeTimers();
    const fetchMock = jest.fn().mockImplementation((_url, request) => new Promise((resolve, reject) => {
      request.signal.addEventListener('abort', () => {
        const error = new Error('request aborted');
        error.name = 'AbortError';
        reject(error);
      }, { once: true });
    }));
    const presets = createPresetHarness(fetchMock);
    const fallbackSpy = jest.spyOn(presets, 'enhanceWithRules');

    try {
      const resultPromise = captureOutcome(presets.enhanceWithPreset(
        createContext(),
        'balanced',
        null,
        {
          settings: {},
          apiKey: 'configured-key',
          returnResult: true
        }
      ));
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fallbackSpy).not.toHaveBeenCalled();
      expect(result).toMatchObject({ status: 'rejected', error: { code: 'timeout', attempts: 1 } });
    } finally {
      jest.useRealTimers();
    }
  });

  test('propagates caller cancellation without retrying or activating fallback', async () => {
    jest.useFakeTimers();
    const fetchMock = jest.fn().mockImplementation((_url, request) => new Promise((resolve, reject) => {
      request.signal.addEventListener('abort', () => {
        const error = new Error('request aborted');
        error.name = 'AbortError';
        reject(error);
      }, { once: true });
    }));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const warningSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const presets = createPresetHarness(fetchMock);
    const fallbackSpy = jest.spyOn(presets, 'enhanceWithRules');
    const controller = new AbortController();

    try {
      const resultPromise = presets.enhanceWithPreset(
        createContext(),
        'balanced',
        null,
        {
          settings: {},
          apiKey: 'configured-key',
          returnResult: true,
          signal: controller.signal
        }
      );
      const outcomePromise = captureOutcome(resultPromise);
      controller.abort();

      await jest.runAllTimersAsync();
      const outcome = await outcomePromise;
      expect(outcome.status).toBe('rejected');
      expect(outcome.error).toMatchObject({ code: 'cancelled' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fallbackSpy).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
      errorSpy.mockRestore();
      warningSpy.mockRestore();
    }
  });

  test('rejects a response that becomes empty after cleanup without altering the composer', async () => {
    const fetchMock = jest.fn().mockResolvedValue(createGeminiResponse({
      candidates: [{
        content: { parts: [{ text: '{"enhanced_prompt":"   "}' }] },
        finishReason: 'STOP'
      }]
    }));
    const presets = createPresetHarness(fetchMock);

    await expect(presets.enhanceWithPreset(
      createContext({ currentPrompt: 'write a function' }),
      'technical',
      null,
      { settings: {}, apiKey: 'configured-key', returnResult: true }
    )).rejects.toMatchObject({ code: 'output_invalid', attempts: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('sends Groq the shared prompt and parses its response metadata', async () => {
    const fetchMock = jest.fn().mockResolvedValue(createGeminiResponse({
      choices: [{
        message: { content: enhancedPromptJson('A clearer Groq enhancement.') },
        finish_reason: 'stop'
      }],
      usage: { prompt_tokens: 20, completion_tokens: 8, total_tokens: 28 }
    }));
    const presets = createPresetHarness(fetchMock);

    const result = await presets.enhanceWithPreset(
      createContext({
        currentPrompt: 'make this clearer using the earlier budget',
        conversationHistory: [{ role: 'user', content: 'The budget is $500.' }]
      }),
      'balanced',
      null,
      {
        provider: 'groq',
        apiKey: 'groq-secret-key',
        settings: { conversationAwareness: true },
        returnResult: true
      }
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(request.body);
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(request.headers.Authorization).toBe('Bearer groq-secret-key');
    expect(body).toMatchObject({
      model: 'llama-3.1-8b-instant',
      temperature: 0.1,
      stream: false
    });
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].content).toContain('The budget is $500.');
    expect(request.body).not.toContain('groq-secret-key');
    expect(result).toMatchObject({
      enhanced: 'A clearer Groq enhancement.',
      method: 'groq',
      provider: 'groq',
      model: 'llama-3.1-8b-instant',
      usage: { inputTokens: 20, outputTokens: 8, totalTokens: 28 },
      fallback: false,
      attempts: 1
    });
  });

  test('passes identical instructions and selected history to Gemini and Groq', async () => {
    const context = createContext({
      currentPrompt: 'make it more concise based on the previous answer',
      conversationHistory: [
        { role: 'user', content: 'Keep the date July 13, 2026.' },
        { role: 'assistant', content: 'I will preserve that date.' }
      ]
    });
    const settings = {
      conversationAwareness: true,
      promptTemplateType: 'structured',
      customPromptTemplate: ''
    };
    const geminiFetch = jest.fn().mockResolvedValue(createGeminiResponse({
      candidates: [{ content: { parts: [{ text: enhancedPromptJson('Gemini result') }] }, finishReason: 'STOP' }]
    }));
    const groqFetch = jest.fn().mockResolvedValue(createGeminiResponse({
      choices: [{ message: { content: enhancedPromptJson('Groq result') }, finish_reason: 'stop' }]
    }));

    await createPresetHarness(geminiFetch).enhanceWithPreset(context, 'balanced', null, {
      provider: 'gemini', apiKey: 'gemini-secret', settings
    });
    await createPresetHarness(groqFetch).enhanceWithPreset(context, 'balanced', null, {
      provider: 'groq', apiKey: 'groq-secret', settings
    });

    const geminiBody = JSON.parse(geminiFetch.mock.calls[0][1].body);
    const groqBody = JSON.parse(groqFetch.mock.calls[0][1].body);
    expect(groqBody.messages[0].content).toBe(geminiBody.systemInstruction.parts[0].text);
    expect(groqBody.messages[1].content).toBe(geminiBody.contents[0].parts[0].text);
    expect(JSON.stringify(geminiBody)).not.toContain('gemini-secret');
    expect(JSON.stringify(groqBody)).not.toContain('groq-secret');
  });

  test.each([
    [401, 'auth'],
    [429, 'rate_limit'],
    [503, 'server_error']
  ])('classifies Groq status %i without a second request', async (status, errorCode) => {
    const fetchMock = jest.fn().mockResolvedValue(createGeminiResponse(
      { error: { message: 'provider failure', type: 'api_error' } },
      status
    ));
    const result = captureOutcome(createPresetHarness(fetchMock).enhanceWithPreset(
      createContext(),
      'balanced',
      null,
      { provider: 'groq', apiKey: 'groq-key', settings: {}, returnResult: true }
    ));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(result).resolves.toMatchObject({
      status: 'rejected', error: { code: errorCode, attempts: 1 }
    });
  });

  test('classifies malformed and empty Groq responses separately from authentication', async () => {
    const malformedFetch = jest.fn().mockResolvedValue(createGeminiResponse('{bad json'));
    const emptyFetch = jest.fn().mockResolvedValue(createGeminiResponse({ choices: [] }));

    const malformed = captureOutcome(createPresetHarness(malformedFetch).enhanceWithPreset(
      createContext(), 'balanced', null,
      { provider: 'groq', apiKey: 'groq-key', settings: {}, returnResult: true }
    ));
    const empty = captureOutcome(createPresetHarness(emptyFetch).enhanceWithPreset(
      createContext(), 'balanced', null,
      { provider: 'groq', apiKey: 'groq-key', settings: {}, returnResult: true }
    ));

    await expect(malformed).resolves.toMatchObject({ status: 'rejected', error: { code: 'response_parse' } });
    await expect(empty).resolves.toMatchObject({ status: 'rejected', error: { code: 'response_empty' } });
  });

  test('cancels Groq without activating fallback', async () => {
    const fetchMock = jest.fn().mockImplementation((_url, request) => new Promise((_resolve, reject) => {
      request.signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      }, { once: true });
    }));
    const presets = createPresetHarness(fetchMock);
    const fallbackSpy = jest.spyOn(presets, 'enhanceWithRules');
    const controller = new AbortController();
    const outcome = captureOutcome(presets.enhanceWithPreset(
      createContext(), 'balanced', null,
      { provider: 'groq', apiKey: 'groq-key', settings: {}, signal: controller.signal }
    ));

    controller.abort();
    await expect(outcome).resolves.toMatchObject({
      status: 'rejected',
      error: { code: 'cancelled' }
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fallbackSpy).not.toHaveBeenCalled();
  });

  test('classifies a Groq timeout after one request', async () => {
    jest.useFakeTimers();
    const fetchMock = jest.fn().mockImplementation((_url, request) => new Promise((_resolve, reject) => {
      request.signal.addEventListener('abort', () => {
        const error = new Error('timed out');
        error.name = 'AbortError';
        reject(error);
      }, { once: true });
    }));
    try {
      const resultPromise = captureOutcome(createPresetHarness(fetchMock).enhanceWithPreset(
        createContext(), 'balanced', null,
        { provider: 'groq', apiKey: 'groq-key', settings: {}, returnResult: true }
      ));
      await jest.runAllTimersAsync();
      await expect(resultPromise).resolves.toMatchObject({
        status: 'rejected',
        error: { code: 'timeout', attempts: 1 }
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  test.each([
    ['gemini', 'standard'],
    ['gemini', 'structured'],
    ['gemini', 'custom'],
    ['groq', 'standard'],
    ['groq', 'structured'],
    ['groq', 'custom']
  ])('supports %s with the %s rewrite mode', async (provider, promptTemplateType) => {
    const response = provider === 'groq'
      ? { choices: [{ message: { content: enhancedPromptJson(`${provider}-${promptTemplateType}`) }, finish_reason: 'stop' }] }
      : { candidates: [{ content: { parts: [{ text: enhancedPromptJson(`${provider}-${promptTemplateType}`) }] }, finishReason: 'STOP' }] };
    const fetchMock = jest.fn().mockResolvedValue(createGeminiResponse(response));
    const settings = {
      promptTemplateType,
      customPromptTemplate: promptTemplateType === 'custom'
        ? 'Keep every factual detail and use short paragraphs around {{PROMPT}}.'
        : ''
    };

    const result = await createPresetHarness(fetchMock).enhanceWithPreset(
      createContext({ currentPrompt: 'Preserve Alice, 42, and July 13.' }),
      'balanced',
      null,
      { provider, apiKey: `${provider}-key`, settings, returnResult: true }
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const requestText = provider === 'groq'
      ? body.messages[1].content
      : body.contents[0].parts[0].text;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestText).toContain(`<mode>${({ standard: 'DIRECT', structured: 'BLUEPRINT', custom: 'CUSTOM' })[promptTemplateType]}</mode>`);
    expect(requestText).toContain('Preserve Alice, 42, and July 13.');
    expect(result).toMatchObject({ provider, fallback: false, attempts: 1 });
  });
});
