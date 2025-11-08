/**
 * Subscription Management
 * Handles Free and BYOK subscription tiers
 */

import browserCompat from '../shared/browser-compat.js';
import { SUBSCRIPTION_TYPES, STORAGE_KEYS, GEMINI_API } from '../shared/constants.js';

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

    // Validate API key
    const isValid = await this.validateGeminiKey(apiKey);

    if (!isValid) {
      return {
        success: false,
        error: 'Invalid API key or API access denied'
      };
    }

    // Update subscription
    this.subscriptionStatus = {
      type: SUBSCRIPTION_TYPES.BYOK,
      active: true,
      apiKey: apiKey,
      provider: 'gemini',
      activatedAt: Date.now()
    };

    await this.saveSubscription();

    // Track activation
    await this.trackEvent('byok_activated');

    return {
      success: true,
      message: 'BYOK tier activated successfully'
    };
  }

  /**
   * Validate Gemini API key
   */
  async validateGeminiKey(apiKey) {
    const url = `${GEMINI_API.BASE_URL}/models/${GEMINI_API.MODEL}:generateContent`;

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

      // Consider both 200 and rate-limited responses as valid
      // (rate limit means key is valid, just at quota)
      return response.status === 200 || response.status === 429;
    } catch (error) {
      console.error('[APE] API key validation error:', error);
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

    const isValid = await this.validateGeminiKey(newApiKey);

    if (!isValid) {
      return {
        success: false,
        error: 'Invalid API key'
      };
    }

    this.subscriptionStatus.apiKey = newApiKey;
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
