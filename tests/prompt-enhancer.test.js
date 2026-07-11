const { loadBundledModule } = require('./helpers/load-module');

const { default: PromptEnhancer } = loadBundledModule('src/content/prompt-enhancer.js');

describe('PromptEnhancer', () => {
  test('uses the local rule-based enhancer when no API key is configured', async () => {
    const enhancer = new PromptEnhancer(null);
    const context = {
      currentPrompt: 'fix this code',
      conversationHistory: [],
      metadata: {
        intent: 'code',
        hasCode: true,
        complexity: 0.2
      }
    };

    const result = await enhancer.enhancePrompt(context, {});

    expect(result.method).toBe('rule-based');
    expect(result.original).toBe(context.currentPrompt);
    expect(result.enhanced).not.toBe(context.currentPrompt);
    expect(result.enhanced).toMatch(/language|error handling|documentation/i);
  });
});
