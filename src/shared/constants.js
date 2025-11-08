/**
 * Application Constants
 */

export const PLATFORMS = {
  CHATGPT: 'chatgpt',
  CLAUDE: 'claude',
  GENERIC: 'generic'
};

export const SUBSCRIPTION_TYPES = {
  FREE: 'free',
  BYOK: 'byok'
};

export const ENHANCEMENT_LEVELS = {
  LIGHT: 'light',
  MODERATE: 'moderate',
  AGGRESSIVE: 'aggressive'
};

export const STORAGE_KEYS = {
  SETTINGS: 'enhancerSettings',
  SUBSCRIPTION: 'subscription',
  USAGE_STATS: 'usageStats',
  ENHANCEMENT_HISTORY: 'enhancementHistory'
};

export const DEFAULT_SETTINGS = {
  subscriptionType: SUBSCRIPTION_TYPES.FREE,
  enhancementLevel: ENHANCEMENT_LEVELS.MODERATE,
  contextWindow: 10,
  autoEnhance: false,
  showDiff: true,
  geminiApiKey: null
};

export const GEMINI_API = {
  BASE_URL: 'https://generativelanguage.googleapis.com/v1beta',
  MODEL: 'gemini-pro',
  MAX_RETRIES: 3,
  TIMEOUT: 10000
};

export const UI_CONSTANTS = {
  FLOATING_BUTTON_ID: 'ape-floating-button',
  PANEL_ID: 'ape-enhancement-panel',
  CONTAINER_ID: 'ai-prompt-enhancer-container',
  ANIMATION_DURATION: 300
};

export const ERROR_MESSAGES = {
  NO_PROMPT: 'No prompt found to enhance',
  API_KEY_INVALID: 'Invalid or missing API key',
  API_ERROR: 'Failed to enhance prompt. Please try again.',
  PLATFORM_NOT_SUPPORTED: 'This platform is not yet supported',
  INJECTION_FAILED: 'Failed to apply enhanced prompt',
  RATE_LIMIT: 'Rate limit exceeded. Please wait a moment.'
};

export const SUCCESS_MESSAGES = {
  ENHANCED: 'Prompt enhanced successfully!',
  APPLIED: 'Enhanced prompt applied!',
  COPIED: 'Copied to clipboard!',
  SETTINGS_SAVED: 'Settings saved successfully!'
};
