const { loadBundledModule } = require('./helpers/load-module');

describe('background enhancement context normalization', () => {
  function loadNormalizer() {
    return loadBundledModule('src/background/enhancement-context.js');
  }

  test('merges partial settings with safe conversation defaults', () => {
    const { normalizeEnhancementContext } = loadNormalizer();

    const context = normalizeEnhancementContext({
      currentPrompt: 'Improve this.',
      conversationHistory: [
        { role: 'user', content: 'Earlier requirement.' },
        { role: 'assistant', content: 'Earlier answer.' }
      ]
    }, { promptTemplateType: 'standard' });

    expect(context.conversationHistory).toHaveLength(2);
  });

  test('spends the character budget on the newest turns and preserves chronology', () => {
    const { normalizeEnhancementContext } = loadNormalizer();
    const history = Array.from({ length: 10 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `turn-${index + 1} ${'x'.repeat(1990)}`
    }));

    const context = normalizeEnhancementContext({
      currentPrompt: 'Continue with the latest decision.',
      conversationHistory: history
    }, { conversationAwareness: true, contextWindow: 10 });

    expect(context.conversationHistory).toHaveLength(6);
    expect(context.conversationHistory[0].content).toContain('turn-5');
    expect(context.conversationHistory.at(-1).content).toContain('turn-10');
    expect(context.conversationHistory.some(message => message.content.startsWith('turn-1 '))).toBe(false);
  });

  test('does not duplicate the current unsent prompt as conversation history', () => {
    const { normalizeEnhancementContext } = loadNormalizer();
    const context = normalizeEnhancementContext({
      currentPrompt: 'Rewrite this without changing the API.',
      conversationHistory: [
        { role: 'assistant', content: 'The public API must remain stable.' },
        { role: 'user', content: ' Rewrite this without changing the API. ' }
      ]
    }, { conversationAwareness: true, contextWindow: 10 });

    expect(context.conversationHistory).toEqual([
      { role: 'assistant', content: 'The public API must remain stable.' }
    ]);
  });

  test('removes only a trailing user draft and preserves legitimate earlier repeats', () => {
    const { normalizeEnhancementContext } = loadNormalizer();
    const context = normalizeEnhancementContext({
      currentPrompt: 'Keep the public API unchanged.',
      conversationHistory: [
        { role: 'user', content: 'Keep the public API unchanged.' },
        { role: 'assistant', content: 'Keep the public API unchanged.' },
        { role: 'user', content: 'A separate completed request.' },
        { role: 'user', content: ' Keep the public API unchanged. ' }
      ]
    }, { conversationAwareness: true, contextWindow: 10 });

    expect(context.conversationHistory).toEqual([
      { role: 'user', content: 'Keep the public API unchanged.' },
      { role: 'assistant', content: 'Keep the public API unchanged.' },
      { role: 'user', content: 'A separate completed request.' }
    ]);
  });

  test('drops unknown roles instead of treating page content as a user message', () => {
    const { normalizeEnhancementContext } = loadNormalizer();
    const context = normalizeEnhancementContext({
      currentPrompt: 'Improve this.',
      conversationHistory: [
        { role: 'navigation', content: 'Settings and account controls' },
        { role: 'assistant', content: 'Relevant answer.' }
      ]
    }, { conversationAwareness: true, contextWindow: 10 });

    expect(context.conversationHistory).toEqual([
      { role: 'assistant', content: 'Relevant answer.' }
    ]);
  });

  test('does not retain history when awareness is disabled', () => {
    const { normalizeEnhancementContext } = loadNormalizer();
    const context = normalizeEnhancementContext({
      currentPrompt: 'Improve this.',
      conversationHistory: [{ role: 'user', content: 'Private older context.' }]
    }, { conversationAwareness: false, contextWindow: 10 });

    expect(context.conversationHistory).toEqual([]);
  });
});
