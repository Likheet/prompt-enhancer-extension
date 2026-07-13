const { loadBundledModule } = require('./helpers/load-module');

describe('ContextExtractor conversation awareness', () => {
  test('collects the most recent user and assistant turns in DOM order', () => {
    const { default: ContextExtractor } = loadBundledModule('src/content/context-extractor.js');
    const domObserver = {
      extractMessages: jest.fn(() => [
        { role: 'user', content: 'old request', timestamp: 1 },
        { role: 'assistant', content: 'old response', timestamp: 2 },
        { role: 'user', content: 'latest request', timestamp: 3 }
      ])
    };
    const extractor = new ContextExtractor(domObserver);
    extractor.setContextWindow(2);

    expect(extractor.extractConversationHistory()).toEqual([
      { role: 'assistant', content: 'old response' },
      { role: 'user', content: 'latest request' }
    ]);
  });

  test('does not inspect the page history when conversation awareness is disabled', () => {
    const { default: ContextExtractor } = loadBundledModule('src/content/context-extractor.js');
    const domObserver = { extractMessages: jest.fn(() => []) };
    const extractor = new ContextExtractor(domObserver);
    extractor.setConversationAwareness(false);

    expect(extractor.extractConversationHistory()).toEqual([]);
    expect(domObserver.extractMessages).not.toHaveBeenCalled();
  });

  test('uses DOM chronology when platform timestamps are missing or unreliable', () => {
    const { default: ContextExtractor } = loadBundledModule('src/content/context-extractor.js');
    const domObserver = {
      extractMessages: jest.fn(() => [
        { role: 'user', content: 'first DOM turn', timestamp: 300 },
        { role: 'assistant', content: 'second DOM turn', timestamp: 100 },
        { role: 'user', content: 'latest DOM turn', timestamp: Number.NaN }
      ])
    };
    const extractor = new ContextExtractor(domObserver);
    extractor.setContextWindow(2);

    expect(extractor.extractConversationHistory()).toEqual([
      { role: 'assistant', content: 'second DOM turn' },
      { role: 'user', content: 'latest DOM turn' }
    ]);
  });

  test('preserves repeated legitimate turns and user-assistant echoes', () => {
    const { default: ContextExtractor } = loadBundledModule('src/content/context-extractor.js');
    const domObserver = {
      extractMessages: jest.fn(() => [
        { role: 'user', content: 'Keep the public API unchanged.', timestamp: 1 },
        { role: 'assistant', content: 'Keep the public API unchanged.', timestamp: 2 },
        { role: 'user', content: 'Keep the public API unchanged.', timestamp: 3 }
      ])
    };
    const extractor = new ContextExtractor(domObserver);

    expect(extractor.extractConversationHistory()).toEqual([
      { role: 'user', content: 'Keep the public API unchanged.' },
      { role: 'assistant', content: 'Keep the public API unchanged.' },
      { role: 'user', content: 'Keep the public API unchanged.' }
    ]);
  });

  test('collapses duplicate nodes that represent the same nested DOM turn', () => {
    const { default: ContextExtractor } = loadBundledModule('src/content/context-extractor.js');
    const innerElement = {};
    const outerElement = {
      contains: (candidate) => candidate === innerElement
    };
    const domObserver = {
      extractMessages: jest.fn(() => [
        {
          role: 'user',
          content: 'One rendered conversation turn.',
          timestamp: 1,
          element: outerElement
        },
        {
          role: 'user',
          content: 'One rendered conversation turn.',
          timestamp: 1,
          element: innerElement
        }
      ])
    };
    const extractor = new ContextExtractor(domObserver);

    expect(extractor.extractConversationHistory()).toEqual([
      { role: 'user', content: 'One rendered conversation turn.' }
    ]);
  });

  test('degrades to an empty history when optional history extraction fails', async () => {
    const { default: ContextExtractor } = loadBundledModule('src/content/context-extractor.js');
    const domObserver = {
      platform: 'generic',
      extractPromptText: jest.fn().mockResolvedValue('Improve this prompt.'),
      extractMessages: jest.fn(() => {
        throw new Error('Host DOM changed');
      })
    };
    const extractor = new ContextExtractor(domObserver);
    extractor.extractMetadata = jest.fn(() => ({ intent: 'request' }));

    await expect(extractor.extractFullContext()).resolves.toMatchObject({
      currentPrompt: 'Improve this prompt.',
      conversationHistory: [],
      metadata: { intent: 'request' },
      collectionTimings: {
        promptCollectionMs: expect.any(Number),
        conversationHistoryCollectionMs: expect.any(Number),
        metadataPreparationMs: expect.any(Number),
        contentContextPreparationMs: expect.any(Number)
      }
    });
  });
});
