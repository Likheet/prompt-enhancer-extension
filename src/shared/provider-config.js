import { AI_PROVIDERS, GEMINI_API, GROQ_API } from './constants.js';

export const PROVIDER_STORAGE_VERSION = 2;

export const PROVIDER_MODELS = Object.freeze({
  [AI_PROVIDERS.GEMINI]: GEMINI_API.MODEL,
  [AI_PROVIDERS.GROQ]: GROQ_API.MODEL
});

export function normalizeProviderMode(value) {
  return Object.values(AI_PROVIDERS).includes(value) ? value : AI_PROVIDERS.AUTO;
}

export function normalizePreferredProvider(value) {
  return value === AI_PROVIDERS.GROQ ? AI_PROVIDERS.GROQ : AI_PROVIDERS.GEMINI;
}

export function resolveProviderConfiguration(configuration = {}) {
  const geminiApiKey = normalizeKey(configuration.geminiApiKey);
  const groqApiKey = normalizeKey(configuration.groqApiKey);
  const providerMode = normalizeProviderMode(configuration.providerMode);
  const preferredProvider = normalizePreferredProvider(configuration.preferredProvider);
  const configuredProviders = [];

  if (geminiApiKey) configuredProviders.push(AI_PROVIDERS.GEMINI);
  if (groqApiKey) configuredProviders.push(AI_PROVIDERS.GROQ);

  if (configuredProviders.length === 0) {
    return {
      providerMode,
      preferredProvider,
      selectedProvider: providerMode,
      provider: null,
      model: null,
      apiKey: null,
      configuredProviders
    };
  }

  let provider;
  if (configuredProviders.length === 1) {
    [provider] = configuredProviders;
  } else if (providerMode === AI_PROVIDERS.GEMINI || providerMode === AI_PROVIDERS.GROQ) {
    provider = providerMode;
  } else {
    provider = preferredProvider;
  }

  return {
    providerMode,
    preferredProvider,
    selectedProvider: providerMode,
    provider,
    model: PROVIDER_MODELS[provider],
    apiKey: provider === AI_PROVIDERS.GROQ ? groqApiKey : geminiApiKey,
    configuredProviders
  };
}

function normalizeKey(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
