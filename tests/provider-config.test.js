const { loadBundledModule } = require('./helpers/load-module');

const {
  resolveProviderConfiguration
} = loadBundledModule('src/shared/provider-config.js');

describe('provider selection', () => {
  test('requires one configured key', () => {
    expect(resolveProviderConfiguration({})).toMatchObject({
      providerMode: 'auto',
      preferredProvider: 'gemini',
      provider: null,
      apiKey: null
    });
  });

  test.each([
    [{ geminiApiKey: 'gemini-key', providerMode: 'groq' }, 'gemini', 'gemini-key'],
    [{ groqApiKey: 'groq-key', providerMode: 'gemini' }, 'groq', 'groq-key']
  ])('uses the only configured provider regardless of saved mode', (configuration, provider, apiKey) => {
    expect(resolveProviderConfiguration(configuration)).toMatchObject({ provider, apiKey });
  });

  test.each([
    ['auto', 'gemini', 'gemini'],
    ['auto', 'groq', 'groq'],
    ['gemini', 'groq', 'gemini'],
    ['groq', 'gemini', 'groq']
  ])('resolves both keys with mode %s and preference %s', (providerMode, preferredProvider, expected) => {
    expect(resolveProviderConfiguration({
      geminiApiKey: 'gemini-key',
      groqApiKey: 'groq-key',
      providerMode,
      preferredProvider
    })).toMatchObject({
      provider: expected,
      model: expected === 'groq' ? 'llama-3.1-8b-instant' : 'gemini-3.1-flash-lite'
    });
  });
});
