/**
 * Application Constants
 */

export const PLATFORMS = {
  CHATGPT: 'chatgpt',
  CLAUDE: 'claude',
  GEMINI: 'gemini',
  PERPLEXITY: 'perplexity',
  AI_STUDIO: 'aistudio',
  KIMI: 'kimi',
  DEEPSEEK: 'deepseek',
  GENERIC: 'generic'
};

export const SITE_PLACEMENTS = {
  AUTO: 'auto',
  BEFORE_ATTACH: 'before-attach',
  AFTER_ATTACH: 'after-attach',
  BEFORE_SEND: 'before-send',
  COMPOSER_END: 'composer-end'
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

export const ENHANCEMENT_PRESETS = {
  CONCISE: 'concise',
  DETAILED: 'detailed',
  BALANCED: 'balanced',
  TECHNICAL: 'technical',
  CREATIVE: 'creative',
  CUSTOM: 'custom'
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
  currentEnhancementType: ENHANCEMENT_PRESETS.BALANCED,
  customEnhancementPrompt: '',
  conversationAwareness: true,
  contextWindow: 10,
  autoEnhance: false,
  showDiff: true,
  promptTemplateType: 'standard',
  customPromptTemplate: '',
  shortcuts: {
    'Alt+1': ENHANCEMENT_PRESETS.CONCISE,
    'Alt+2': ENHANCEMENT_PRESETS.BALANCED,
    'Alt+3': ENHANCEMENT_PRESETS.DETAILED
  }
};

export const PROMPT_TEMPLATES = {
  standard: `Produce a natural, ready-to-send prompt. Improve clarity, specificity, useful context, constraints, and actionability only where they help the user's actual goal. Preserve a concise input when extra structure would add friction.`,
  structured: `Produce a ready-to-send prompt with these sections when applicable: Role, Objective, Context, Constraints, Deliverables, and Output Format. Omit sections that would contain invented or redundant information. Use plain labels and bullets; do not wrap the result in a code block.`
};

export const AI_PROVIDERS = {
  AUTO: 'auto',
  GEMINI: 'gemini',
  GROQ: 'groq'
};

export const GEMINI_API = {
  BASE_URL: 'https://generativelanguage.googleapis.com/v1beta',
  MODEL: 'gemini-3.1-flash-lite',
  DISPLAY_NAME: 'Gemini 3.1 Flash-Lite',
  MAX_ATTEMPTS: 1,
  // Kept for the legacy PromptEnhancer path. This value is the total number
  // of attempts, not retries after the first request.
  MAX_RETRIES: 1,
  TIMEOUT: 8000,
  RETRY_BASE_DELAY: 250,
  MAX_RETRY_DELAY: 750
};

export const GROQ_API = {
  BASE_URL: 'https://api.groq.com/openai/v1',
  MODEL: 'llama-3.1-8b-instant',
  DISPLAY_NAME: 'Llama 3.1 8B Instant',
  TIMEOUT: GEMINI_API.TIMEOUT
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

/**
 * List of domains where the extension should be active by default (Generic Strategy)
 * This covers "Top 100" AI sites to avoid enabling it on literally every website.
 */
export const SUPPORTED_AI_DOMAINS = [
  // Major Platforms (Native adapters exist for top 5, but listing here for safety)
  'chatgpt.com', 'openai.com',
  'claude.ai', 'anthropic.com',
  'gemini.google.com', 'aistudio.google.com',
  'perplexity.ai',
  'copilot.microsoft.com', // Microsoft Copilot
  'poe.com',               // Quora Poe

  // Popular Chatbots & Assistants
  'huggingface.co',        // HuggingChat
  'chat.mistral.ai',       // Mistral Le Chat
  'deepseek.com',          // DeepSeek
  'pi.ai',                 // Inflection Pi
  'character.ai',          // Character.ai
  'replika.com',           // Replika
  'jasper.ai',             // Jasper
  'writesonic.com',        // Chatsonic
  'you.com',               // You.com
  'phind.com',             // Phind
  'groq.com',              // GroqCloud
  'chat.lmsys.org',        // LMSYS Arena
  'forefront.ai',          // Forefront
  'ora.sh',                // Ora
  'chatpdf.com',           // ChatPDF

  // Chinese Platforms
  'kimi.com', 'kimi.ai', 'moonshot.cn', // Kimi
  'yiyan.baidu.com',        // Ernie Bot
  'chatglm.cn',             // ChatGLM
  'doubao.com',             // Doubao (ByteDance)
  'baichuan-ai.com',        // Baichuan
  'minimax.chat',           // Hailuo
  'coze.com',               // Coze

  // Development & Playgrounds
  'openrouter.ai',
  'together.ai',
  'anyscale.com',
  'commandcode.ai',

  // Others
  'zapier.com',             // Zapier Central
  'monica.im',              // Monica
  'harpa.ai',
  'merlin.foyer.work'
];
