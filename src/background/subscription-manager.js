/**
 * Subscription Management
 * Handles Free and BYOK subscription tiers
 */

import browserCompat from '../shared/browser-compat.js';
import { SUBSCRIPTION_TYPES, STORAGE_KEYS, GEMINI_API } from '../shared/constants.js';
import { TEST_MODE_ENABLED, BYPASS_API_VALIDATION, VERBOSE_LOGGING } from '../shared/test-config.js';

class SubscriptionManager {
  constructor() {
    this.subscriptionStatus = null;
    this.initialized = false;
  }

  /**
   * Initialize subscription manager
   */
  async initialize() {
    if (this.initialized) return;

    const stored = await this.getStoredSubscription();
    if (stored) {
      this.subscriptionStatus = stored;
    } else {
      // Default to free tier
      this.subscriptionStatus = {
        type: SUBSCRIPTION_TYPES.FREE,
        active: true,
        activatedAt: Date.now()
      };
      await this.saveSubscription();
    }

    this.initialized = true;
  }

  /**
   * Get active subscription
   */
  async getActiveSubscription() {
    if (!this.initialized) {
      await this.initialize();
    }
    return { ...this.subscriptionStatus };
  }

  /**
   * Get stored subscription from storage
   */
  async getStoredSubscription() {
    try {
      const result = await browserCompat.storageGet([STORAGE_KEYS.SUBSCRIPTION]);
      return result[STORAGE_KEYS.SUBSCRIPTION] || null;
    } catch (error) {
      console.error('[APE] Failed to get subscription:', error);
      return null;
    }
  }

  /**
   * Save subscription to storage
   */
  async saveSubscription() {
    try {
      await browserCompat.storageSet({
        [STORAGE_KEYS.SUBSCRIPTION]: this.subscriptionStatus
      });
    } catch (error) {
      console.error('[APE] Failed to save subscription:', error);
      throw error;
    }
  }

  /**
   * Activate BYOK tier with Gemini API key
   */
  async activateBYOK(apiKey) {
    if (!apiKey || apiKey.trim().length === 0) {
      return {
        success: false,
        error: 'API key is required'
      };
    }

    // Sanitize API key (remove invisible Unicode characters from copy-paste)
    const { sanitized: sanitizedKey, removed } = this.sanitizeAPIKey(apiKey);

    if (removed.length > 0) {
      console.warn('[APE] Removed invalid characters from API key:', removed.join(', '));
    }

    // Validate API key
    const isValid = await this.validateGeminiKey(sanitizedKey);

    if (!isValid) {
      return {
        success: false,
        error: sanitizedKey !== apiKey
          ? 'Invalid API key (invisible characters were removed, but key is still invalid)'
          : 'Invalid API key or API access denied'
      };
    }

    // Update subscription (save the sanitized key)
    this.subscriptionStatus = {
      type: SUBSCRIPTION_TYPES.BYOK,
      active: true,
      apiKey: sanitizedKey,
      provider: 'gemini',
      activatedAt: Date.now()
    };

    await this.saveSubscription();

    // Track activation
    await this.trackEvent('byok_activated');

    return {
      success: true,
      message: sanitizedKey !== apiKey
        ? 'BYOK tier activated (invisible characters were removed from key)'
        : 'BYOK tier activated successfully'
    };
  }

  /**
   * Validate Gemini API key
   */
  async validateGeminiKey(apiKey) {
    // TEST MODE: Bypass validation if configured
    if (TEST_MODE_ENABLED && BYPASS_API_VALIDATION) {
      console.warn('[APE] ⚠️ TEST MODE: Bypassing API key validation');
      return true;
    }

    const url = `${GEMINI_API.BASE_URL}/models/${GEMINI_API.MODEL}:generateContent`;

    console.log('[APE] Validating API key with model:', GEMINI_API.MODEL);
    if (VERBOSE_LOGGING) {
      console.log('[APE] API Key (first 10 chars):', apiKey.substring(0, 10));
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: 'Test'
            }]
          }],
          generationConfig: {
            maxOutputTokens: 10
          }
        })
      });

      console.log('[APE] API validation response status:', response.status);
      if (VERBOSE_LOGGING) {
        console.log('[APE] Response headers:', {
          contentType: response.headers.get('content-type'),
          contentLength: response.headers.get('content-length')
        });
      }

      // Log error details for debugging
      if (response.status !== 200 && response.status !== 429) {
        const errorText = await response.text();
        console.error('[APE] API validation failed. Status:', response.status);
        console.error('[APE] Response body:', errorText);

        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error) {
            console.error('[APE] Error details:', errorJson.error.message);
            if (VERBOSE_LOGGING) {
              console.error('[APE] Full error object:', JSON.stringify(errorJson.error, null, 2));
            }
          }
        } catch (e) {
          // Not JSON, already logged as text
        }
      }

      // Consider both 200 and rate-limited responses as valid
      // (rate limit means key is valid, just at quota)
      const isValid = response.status === 200 || response.status === 429;
      console.log('[APE] API key validation result:', isValid ? '✓ VALID' : '✗ INVALID');
      return isValid;
    } catch (error) {
      // Detect encoding errors (should be rare after sanitization)
      if (error.message && (error.message.includes('ISO-8859-1') ||
          error.message.includes('code point'))) {
        console.error('[APE] API key contains invalid characters after sanitization:', error);

        // Debug: show which characters are still problematic
        const problematicChars = [...apiKey]
          .filter(c => c.charCodeAt(0) > 127)
          .map(c => `U+${c.charCodeAt(0).toString(16).toUpperCase()}`);

        if (problematicChars.length > 0) {
          console.error('[APE] Problematic characters:', problematicChars.join(', '));
        }
      } else {
        console.error('[APE] API key validation error:', error);
        if (VERBOSE_LOGGING) {
          console.error('[APE] Error details:', {
            message: error.message,
            name: error.name,
            stack: error.stack
          });
        }
      }

      return false;
    }
  }

  /**
   * Deactivate BYOK and return to Free tier
   */
  async deactivateBYOK() {
    this.subscriptionStatus = {
      type: SUBSCRIPTION_TYPES.FREE,
      active: true,
      activatedAt: Date.now()
    };

    await this.saveSubscription();

    await this.trackEvent('byok_deactivated');

    return {
      success: true,
      message: 'Returned to Free tier'
    };
  }

  /**
   * Update API key for existing BYOK subscription
   */
  async updateAPIKey(newApiKey) {
    if (this.subscriptionStatus.type !== SUBSCRIPTION_TYPES.BYOK) {
      return {
        success: false,
        error: 'Not on BYOK tier'
      };
    }

    // Sanitize API key
    const { sanitized: sanitizedKey, removed } = this.sanitizeAPIKey(newApiKey);

    if (removed.length > 0) {
      console.warn('[APE] Removed invalid characters from API key:', removed.join(', '));
    }

    const isValid = await this.validateGeminiKey(sanitizedKey);

    if (!isValid) {
      return {
        success: false,
        error: 'Invalid API key'
      };
    }

    this.subscriptionStatus.apiKey = sanitizedKey;
    this.subscriptionStatus.updatedAt = Date.now();

    await this.saveSubscription();

    return {
      success: true,
      message: 'API key updated successfully'
    };
  }

  /**
   * Get subscription type
   */
  async getSubscriptionType() {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.subscriptionStatus.type;
  }

  /**
   * Check if BYOK is active
   */
  async isBYOKActive() {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.subscriptionStatus.type === SUBSCRIPTION_TYPES.BYOK &&
           this.subscriptionStatus.active &&
           this.subscriptionStatus.apiKey;
  }

  /**
   * Get API key (if BYOK)
   */
  async getAPIKey() {
    if (!this.initialized) {
      await this.initialize();
    }

    if (this.subscriptionStatus.type === SUBSCRIPTION_TYPES.BYOK) {
      return this.subscriptionStatus.apiKey;
    }

    return null;
  }

  /**
   * Get subscription info for display
   */
  async getSubscriptionInfo() {
    if (!this.initialized) {
      await this.initialize();
    }

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

  /**
   * Sanitize API key by removing invisible Unicode characters
   * Common issue: Google Cloud Console copy-paste includes zero-width spaces
   */
  sanitizeAPIKey(apiKey) {
    const original = apiKey;
    const removed = [];

    // Remove leading/trailing whitespace
    let sanitized = apiKey.trim();

    // Detect and remove problematic characters
    const problematicChars = [...sanitized].filter(char => {
      const code = char.charCodeAt(0);
      // Keep only printable ASCII characters (0x20-0x7E)
      // Gemini API keys are always alphanumeric + hyphen/underscore
      return code < 0x20 || code > 0x7E;
    });

    if (problematicChars.length > 0) {
      problematicChars.forEach(char => {
        const unicodeNotation = `'${char}' (U+${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')})`;
        removed.push(unicodeNotation);
      });
    }

    // Remove zero-width characters (common in copy-paste)
    sanitized = sanitized.replace(/[\u200B-\u200D\uFEFF]/g, '');

    // Remove all non-ASCII characters
    sanitized = sanitized.replace(/[^\x20-\x7E]/g, '');

    // Remove all whitespace (API keys don't have spaces)
    sanitized = sanitized.replace(/\s+/g, '');

    return {
      sanitized,
      removed,
      wasModified: sanitized !== original
    };
  }

  /**
   * Mask API key for display
   */
  maskAPIKey(apiKey) {
    if (!apiKey || apiKey.length < 12) return '****';

    const start = apiKey.substring(0, 6);
    const end = apiKey.substring(apiKey.length - 4);
    return `${start}...${end}`;
  }

  /**
   * Track usage event
   */
  async trackEvent(eventName, data = {}) {
    try {
      // Get or initialize usage stats
      const stats = await browserCompat.storageGet([STORAGE_KEYS.USAGE_STATS]);
      const usageStats = stats[STORAGE_KEYS.USAGE_STATS] || {
        events: [],
        totalEnhancements: 0,
        byokEnhancements: 0,
        freeEnhancements: 0
      };

      // Add event
      usageStats.events.push({
        name: eventName,
        timestamp: Date.now(),
        data: data
      });

      // Update counters
      if (eventName === 'prompt_enhanced') {
        usageStats.totalEnhancements++;
        if (this.subscriptionStatus.type === SUBSCRIPTION_TYPES.BYOK) {
          usageStats.byokEnhancements++;
        } else {
          usageStats.freeEnhancements++;
        }
      }

      // Keep only last 100 events
      if (usageStats.events.length > 100) {
        usageStats.events = usageStats.events.slice(-100);
      }

      await browserCompat.storageSet({
        [STORAGE_KEYS.USAGE_STATS]: usageStats
      });
    } catch (error) {
      console.error('[APE] Failed to track event:', error);
    }
  }

  /**
   * Get usage statistics
   */
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

  /**
   * Reset subscription to defaults
   */
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

// Export singleton instance
const subscriptionManager = new SubscriptionManager();
export default subscriptionManager;
