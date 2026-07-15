import browserCompat from '../shared/browser-compat.js';
import {
  AI_PROVIDERS,
  SUBSCRIPTION_TYPES,
  STORAGE_KEYS,
  GEMINI_API,
  GROQ_API
} from '../shared/constants.js';
import {
  normalizePreferredProvider,
  normalizeProviderMode,
  PROVIDER_STORAGE_VERSION,
  resolveProviderConfiguration
} from '../shared/provider-config.js';

class SubscriptionManager {
  constructor() {
    this.subscriptionStatus = null;
    this.initialized = false;
    this.initializePromise = null;
    this.trackEventQueue = Promise.resolve();
  }

  async initialize() {
    if (this.initialized) return;
    if (this.initializePromise) return this.initializePromise;

    this.initializePromise = this.performInitialization()
      .finally(() => {
        this.initializePromise = null;
      });
    return this.initializePromise;
  }

  async performInitialization() {
    const result = await browserCompat.storageGet([
      STORAGE_KEYS.SUBSCRIPTION,
      STORAGE_KEYS.SETTINGS
    ]);
    const stored = result[STORAGE_KEYS.SUBSCRIPTION] || {};
    const storedSettings = result[STORAGE_KEYS.SETTINGS] || {};
    const alreadyMigrated = stored.providerStorageVersion === PROVIDER_STORAGE_VERSION;
    const legacyGeminiKey = alreadyMigrated
      ? null
      : stored.apiKey || storedSettings.geminiApiKey || storedSettings.geminiKey || null;

    this.subscriptionStatus = {
      ...stored,
      type: SUBSCRIPTION_TYPES.FREE,
      active: true,
      activatedAt: stored.activatedAt || Date.now(),
      providerMode: normalizeProviderMode(stored.providerMode),
      preferredProvider: normalizePreferredProvider(stored.preferredProvider),
      providerStorageVersion: PROVIDER_STORAGE_VERSION
    };

    if (!this.subscriptionStatus.geminiApiKey && legacyGeminiKey) {
      this.subscriptionStatus.geminiApiKey = legacyGeminiKey;
    }
    delete this.subscriptionStatus.apiKey;
    delete this.subscriptionStatus.provider;
    this.updateSubscriptionType();

    const updates = { [STORAGE_KEYS.SUBSCRIPTION]: this.subscriptionStatus };
    if (!alreadyMigrated && (storedSettings.geminiApiKey || storedSettings.geminiKey)) {
      const migratedSettings = { ...storedSettings };
      delete migratedSettings.geminiApiKey;
      delete migratedSettings.geminiKey;
      updates[STORAGE_KEYS.SETTINGS] = migratedSettings;
    }
    await browserCompat.storageSet(updates);
    this.initialized = true;
  }

  async getActiveSubscription() {
    if (!this.initialized) await this.initialize();
    return { ...this.subscriptionStatus };
  }

  async getStoredSubscription() {
    try {
      const result = await browserCompat.storageGet([STORAGE_KEYS.SUBSCRIPTION]);
      return result[STORAGE_KEYS.SUBSCRIPTION] || null;
    } catch (error) {
      console.error('[APE] Failed to get subscription:', error);
      return null;
    }
  }

  async saveSubscription() {
    try {
      await browserCompat.storageSet({ [STORAGE_KEYS.SUBSCRIPTION]: this.subscriptionStatus });
    } catch (error) {
      console.error('[APE] Failed to save subscription:', error);
      throw error;
    }
  }

  async activateBYOK(apiKey) {
    return this.saveProviderKey(AI_PROVIDERS.GEMINI, apiKey);
  }

  async saveProviderKey(provider, apiKey) {
    if (!this.initialized) await this.initialize();
    if (provider !== AI_PROVIDERS.GEMINI && provider !== AI_PROVIDERS.GROQ) {
      return { success: false, error: 'Unsupported AI provider' };
    }
    if (!apiKey || apiKey.trim().length === 0) {
      return { success: false, error: `${this.getProviderLabel(provider)} API key is required` };
    }

    const { sanitized: sanitizedKey, removed } = this.sanitizeAPIKey(apiKey);
    if (removed.length > 0) {
      console.warn('[APE] Removed invalid characters from API key:', removed.join(', '));
    }

    if (!sanitizedKey) {
      return { success: false, error: 'API key is required' };
    }

    const validation = await this.validateProviderKey(provider, sanitizedKey);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error || (sanitizedKey !== apiKey
          ? `${this.getProviderLabel(provider)} rejected the key after invisible characters were removed`
          : `Invalid ${this.getProviderLabel(provider)} API key or API access denied`)
      };
    }

    this.subscriptionStatus[`${provider}ApiKey`] = sanitizedKey;
    this.subscriptionStatus.active = true;
    this.subscriptionStatus.activatedAt ||= Date.now();
    this.updateSubscriptionType();

    await this.saveSubscription();
    await this.trackEvent('byok_activated', { provider });

    return {
      success: true,
      message: validation.warning || (sanitizedKey !== apiKey
        ? `${this.getProviderLabel(provider)} key saved after invisible characters were removed`
        : `${this.getProviderLabel(provider)} key saved`)
    };
  }

  async validateProviderKey(provider, apiKey) {
    return provider === AI_PROVIDERS.GROQ
      ? this.validateGroqKey(apiKey)
      : this.validateGeminiKey(apiKey);
  }

  async validateGeminiKey(apiKey) {
    const url = `${GEMINI_API.BASE_URL}/models/${GEMINI_API.MODEL}:generateContent`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEMINI_API.TIMEOUT);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Test' }] }],
          generationConfig: { maxOutputTokens: 10 }
        }),
        signal: controller.signal
      });

      if (response.status === 200) {
        return { valid: true };
      }

      if (response.status === 429) {
        return {
          valid: true,
          warning: 'BYOK tier activated. Gemini is currently rate limited; enhancements will resume after the quota resets.'
        };
      }

      if (response.status === 401 || response.status === 403) {
        return { valid: false, error: 'Invalid Gemini API key or API access denied' };
      }

      return {
        valid: false,
        error: `Could not validate the API key (status ${response.status}). Please try again.`
      };
    } catch (error) {
      if (error.name === 'AbortError') {
        return {
          valid: false,
          error: 'API key validation timed out. Check your connection and try again.'
        };
      }

      console.error('[APE] API key validation error:', error);
      return {
        valid: false,
        error: 'Could not validate the API key. Check your connection and try again.'
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async validateGroqKey(apiKey) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GROQ_API.TIMEOUT);

    try {
      const response = await fetch(`${GROQ_API.BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: GROQ_API.MODEL,
          messages: [{ role: 'user', content: 'Reply with OK.' }],
          temperature: 0.1,
          max_completion_tokens: 4,
          stream: false
        }),
        signal: controller.signal
      });

      if (response.status === 200) return { valid: true };
      if (response.status === 429) {
        return {
          valid: true,
          warning: 'Groq key saved. Groq is currently rate limited; enhancements will resume after the quota resets.'
        };
      }
      if (response.status === 401 || response.status === 403) {
        return { valid: false, error: 'Invalid Groq API key or API access denied' };
      }
      return {
        valid: false,
        error: `Could not validate the Groq API key (status ${response.status}). Please try again.`
      };
    } catch (error) {
      if (error.name === 'AbortError') {
        return { valid: false, error: 'Groq API key validation timed out. Check your connection and try again.' };
      }
      return { valid: false, error: 'Could not validate the Groq API key. Check your connection and try again.' };
    } finally {
      clearTimeout(timeout);
    }
  }

  async deactivateBYOK() {
    if (!this.initialized) await this.initialize();
    return this.clearProviderKey(AI_PROVIDERS.GEMINI);
  }

  async clearProviderKey(provider) {
    if (!this.initialized) await this.initialize();
    if (provider !== AI_PROVIDERS.GEMINI && provider !== AI_PROVIDERS.GROQ) {
      return { success: false, error: 'Unsupported AI provider' };
    }
    delete this.subscriptionStatus[`${provider}ApiKey`];
    this.updateSubscriptionType();
    await this.saveSubscription();
    await this.trackEvent('byok_deactivated', { provider });
    return { success: true, message: `${this.getProviderLabel(provider)} key cleared` };
  }

  async setProviderMode(providerMode) {
    if (!this.initialized) await this.initialize();
    const normalizedMode = normalizeProviderMode(providerMode);
    this.subscriptionStatus.providerMode = normalizedMode;
    if (normalizedMode === AI_PROVIDERS.GEMINI || normalizedMode === AI_PROVIDERS.GROQ) {
      this.subscriptionStatus.preferredProvider = normalizedMode;
    }
    await this.saveSubscription();
    return { success: true, providerMode: normalizedMode };
  }

  async updateAPIKey(newApiKey) {
    return this.saveProviderKey(AI_PROVIDERS.GEMINI, newApiKey);
  }

  async getSubscriptionType() {
    if (!this.initialized) await this.initialize();
    return this.subscriptionStatus.type;
  }

  async isBYOKActive() {
    if (!this.initialized) await this.initialize();
    return this.subscriptionStatus.type === SUBSCRIPTION_TYPES.BYOK && this.subscriptionStatus.active;
  }

  async getAPIKey() {
    if (!this.initialized) await this.initialize();
    return resolveProviderConfiguration(this.subscriptionStatus).apiKey;
  }

  async getProviderConfiguration() {
    if (!this.initialized) await this.initialize();
    return resolveProviderConfiguration(this.subscriptionStatus);
  }

  async getSubscriptionInfo() {
    if (!this.initialized) await this.initialize();

    const resolved = resolveProviderConfiguration(this.subscriptionStatus);
    return {
      type: this.subscriptionStatus.type,
      active: this.subscriptionStatus.active,
      activatedAt: this.subscriptionStatus.activatedAt,
      providerMode: resolved.providerMode,
      preferredProvider: resolved.preferredProvider,
      actualProvider: resolved.provider,
      configuredProviders: resolved.configuredProviders,
      providers: {
        gemini: { configured: Boolean(this.subscriptionStatus.geminiApiKey) },
        groq: { configured: Boolean(this.subscriptionStatus.groqApiKey) }
      }
    };
  }

  sanitizeAPIKey(apiKey) {
    const original = apiKey;
    const removed = [];
    let sanitized = apiKey.trim();

    const problematicChars = [...sanitized].filter(char => {
      const code = char.charCodeAt(0);
      return code < 0x20 || code > 0x7E;
    });

    if (problematicChars.length > 0) {
      problematicChars.forEach(char => {
        const unicodeNotation = `'${char}' (U+${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')})`;
        removed.push(unicodeNotation);
      });
    }

    sanitized = sanitized.replace(/[\u200B-\u200D\uFEFF]/g, '');
    sanitized = sanitized.replace(/[^\x20-\x7E]/g, '');
    sanitized = sanitized.replace(/\s+/g, '');

    return { sanitized, removed, wasModified: sanitized !== original };
  }

  maskAPIKey(apiKey) {
    if (!apiKey || apiKey.length < 12) return '****';
    const start = apiKey.substring(0, 6);
    const end = apiKey.substring(apiKey.length - 4);
    return `${start}...${end}`;
  }

  updateSubscriptionType() {
    this.subscriptionStatus.type = this.subscriptionStatus.geminiApiKey || this.subscriptionStatus.groqApiKey
      ? SUBSCRIPTION_TYPES.BYOK
      : SUBSCRIPTION_TYPES.FREE;
  }

  getProviderLabel(provider) {
    return provider === AI_PROVIDERS.GROQ ? 'Groq' : 'Gemini';
  }

  trackEvent(eventName, data = {}) {
    const operation = this.trackEventQueue.then(() => this.persistEvent(eventName, data));
    this.trackEventQueue = operation.catch(() => undefined);
    return operation;
  }

  async persistEvent(eventName, data = {}) {
    try {
      const stats = await browserCompat.storageGet([STORAGE_KEYS.USAGE_STATS]);
      const usageStats = stats[STORAGE_KEYS.USAGE_STATS] || {
        events: [],
        totalEnhancements: 0,
        byokEnhancements: 0,
        freeEnhancements: 0
      };

      usageStats.events.push({ name: eventName, timestamp: Date.now(), data });

      if (eventName === 'prompt_enhanced') {
        usageStats.totalEnhancements++;
        if (this.subscriptionStatus.type === SUBSCRIPTION_TYPES.BYOK) {
          usageStats.byokEnhancements++;
        } else {
          usageStats.freeEnhancements++;
        }
      }

      if (usageStats.events.length > 100) {
        usageStats.events = usageStats.events.slice(-100);
      }

      await browserCompat.storageSet({ [STORAGE_KEYS.USAGE_STATS]: usageStats });
    } catch (error) {
      console.error('[APE] Failed to track event:', error);
    }
  }

  async getUsageStats() {
    try {
      const result = await browserCompat.storageGet([STORAGE_KEYS.USAGE_STATS]);
      return result[STORAGE_KEYS.USAGE_STATS] || {
        events: [],
        totalEnhancements: 0,
        byokEnhancements: 0,
        freeEnhancements: 0
      };
    } catch (error) {
      console.error('[APE] Failed to get usage stats:', error);
      return null;
    }
  }

  async reset() {
    this.subscriptionStatus = {
      type: SUBSCRIPTION_TYPES.FREE,
      active: true,
      activatedAt: Date.now(),
      providerMode: AI_PROVIDERS.AUTO,
      preferredProvider: AI_PROVIDERS.GEMINI,
      providerStorageVersion: PROVIDER_STORAGE_VERSION
    };
    await this.saveSubscription();
    this.initialized = true;
  }
}

const subscriptionManager = new SubscriptionManager();
export default subscriptionManager;
