import browserCompat from '../shared/browser-compat.js';
import { SUBSCRIPTION_TYPES, STORAGE_KEYS, GEMINI_API } from '../shared/constants.js';

class SubscriptionManager {
  constructor() {
    this.subscriptionStatus = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    const stored = await this.getStoredSubscription();
    if (stored) {
      this.subscriptionStatus = stored;
    } else {
      this.subscriptionStatus = {
        type: SUBSCRIPTION_TYPES.FREE,
        active: true,
        activatedAt: Date.now()
      };
      await this.saveSubscription();
    }
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
    if (!apiKey || apiKey.trim().length === 0) {
      return { success: false, error: 'API key is required' };
    }

    const { sanitized: sanitizedKey, removed } = this.sanitizeAPIKey(apiKey);
    if (removed.length > 0) {
      console.warn('[APE] Removed invalid characters from API key:', removed.join(', '));
    }

    const isValid = await this.validateGeminiKey(sanitizedKey);
    if (!isValid) {
      return {
        success: false,
        error: sanitizedKey !== apiKey
          ? 'Invalid API key (invisible characters were removed, but key is still invalid)'
          : 'Invalid API key or API access denied'
      };
    }

    this.subscriptionStatus = {
      type: SUBSCRIPTION_TYPES.BYOK,
      active: true,
      apiKey: sanitizedKey,
      provider: 'gemini',
      activatedAt: Date.now()
    };

    await this.saveSubscription();
    await this.trackEvent('byok_activated');

    return {
      success: true,
      message: sanitizedKey !== apiKey
        ? 'BYOK tier activated (invisible characters were removed from key)'
        : 'BYOK tier activated successfully'
    };
  }

  async validateGeminiKey(apiKey) {
    const url = `${GEMINI_API.BASE_URL}/models/${GEMINI_API.MODEL}:generateContent`;
    console.log('[APE] Validating API key with model:', GEMINI_API.MODEL);
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
        })
      });

      console.log('[APE] API validation response status:', response.status);
      if (response.status !== 200 && response.status !== 429) {
        const errorText = await response.text();
        console.error('[APE] API validation failed. Status:', response.status);
        console.error('[APE] Response body:', errorText);
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error) {
            console.error('[APE] Error details:', errorJson.error.message);
          }
        } catch (_) {
          // A non-JSON error body is still represented by the HTTP status.
        }
      }

      const isValid = response.status === 200 || response.status === 429;
      console.log('[APE] API key validation result:', isValid ? '✓ VALID' : '✗ INVALID');
      return isValid;
    } catch (error) {
      if (error.message && (error.message.includes('ISO-8859-1') || error.message.includes('code point'))) {
        console.error('[APE] API key contains invalid characters after sanitization:', error);
        const problematicChars = [...apiKey]
          .filter(c => c.charCodeAt(0) > 127)
          .map(c => `U+${c.charCodeAt(0).toString(16).toUpperCase()}`);
        if (problematicChars.length > 0) {
          console.error('[APE] Problematic characters:', problematicChars.join(', '));
        }
      } else {
        console.error('[APE] API key validation error:', error);
      }
      return false;
    }
  }

  async deactivateBYOK() {
    if (!this.initialized) await this.initialize();

    this.subscriptionStatus = {
      type: SUBSCRIPTION_TYPES.FREE,
      active: true,
      activatedAt: Date.now()
    };

    await this.saveSubscription();
    await this.trackEvent('byok_deactivated');

    return { success: true, message: 'Returned to Free tier' };
  }

  async updateAPIKey(newApiKey) {
    if (this.subscriptionStatus.type !== SUBSCRIPTION_TYPES.BYOK) {
      return { success: false, error: 'Not on BYOK tier' };
    }

    const { sanitized: sanitizedKey, removed } = this.sanitizeAPIKey(newApiKey);
    if (removed.length > 0) {
      console.warn('[APE] Removed invalid characters from API key:', removed.join(', '));
    }

    const isValid = await this.validateGeminiKey(sanitizedKey);
    if (!isValid) {
      return { success: false, error: 'Invalid API key' };
    }

    this.subscriptionStatus.apiKey = sanitizedKey;
    this.subscriptionStatus.updatedAt = Date.now();
    await this.saveSubscription();

    return { success: true, message: 'API key updated successfully' };
  }

  async getSubscriptionType() {
    if (!this.initialized) await this.initialize();
    return this.subscriptionStatus.type;
  }

  async isBYOKActive() {
    if (!this.initialized) await this.initialize();
    return this.subscriptionStatus.type === SUBSCRIPTION_TYPES.BYOK &&
      this.subscriptionStatus.active &&
      this.subscriptionStatus.apiKey;
  }

  async getAPIKey() {
    if (!this.initialized) await this.initialize();
    return this.subscriptionStatus.type === SUBSCRIPTION_TYPES.BYOK
      ? this.subscriptionStatus.apiKey
      : null;
  }

  async getSubscriptionInfo() {
    if (!this.initialized) await this.initialize();

    const info = {
      type: this.subscriptionStatus.type,
      active: this.subscriptionStatus.active,
      activatedAt: this.subscriptionStatus.activatedAt
    };

    if (this.subscriptionStatus.type === SUBSCRIPTION_TYPES.BYOK) {
      info.provider = this.subscriptionStatus.provider;
      info.hasApiKey = !!this.subscriptionStatus.apiKey;
      info.apiKeyMasked = this.subscriptionStatus.apiKey
        ? this.maskAPIKey(this.subscriptionStatus.apiKey)
        : null;
    }

    return info;
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

  async trackEvent(eventName, data = {}) {
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
      activatedAt: Date.now()
    };
    await this.saveSubscription();
    this.initialized = true;
  }
}

const subscriptionManager = new SubscriptionManager();
export default subscriptionManager;
