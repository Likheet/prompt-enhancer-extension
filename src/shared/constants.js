/**
 * Application Constants
 */

export const PLATFORMS = {
  CHATGPT: 'chatgpt',
  CLAUDE: 'claude',
  GEMINI: 'gemini',
  PERPLEXITY: 'perplexity',
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
  contextWindow: 10,
  autoEnhance: false,
  showDiff: true,
  geminiApiKey: null,
  promptTemplateType: 'standard',
  customPromptTemplate: '',
  shortcuts: {
    'Alt+1': ENHANCEMENT_PRESETS.CONCISE,
    'Alt+2': ENHANCEMENT_PRESETS.BALANCED,
    'Alt+3': ENHANCEMENT_PRESETS.DETAILED
  }
};

export const PROMPT_TEMPLATES = {
  standard: `Generate an enhanced version of this prompt (reply with only the enhanced prompt - no conversation, explanations, lead-in, bullet points, placeholders, or surrounding quotes):\n\n{{PROMPT}}`,
  structured: `You are a Prompt Enhancement Specialist. Transform the user's input into a structured prompt using this EXACT format.

CRITICAL FORMATTING RULES:
1. Each section MUST start on a new line
2. Put a blank line between sections
3. Use ONLY plain text - no markdown, no code blocks, no quotes
4. Format: "SectionName: content" 
5. For bullet lists, put each item on its own line starting with "- "

SECTIONS TO INCLUDE:

Role: [Define AI assistant role for the task domain]

Objective: [State the main goal in 1-2 sentences]

Constraints:
- [List any limitations or requirements]
- [Each constraint on its own line]

Deliverables:
- [Specific output item 1]
- [Specific output item 2]
- [Specific output item 3]
- [Add more as needed]

Output Format: [Specify format like Text, Markdown, JSON, etc.]

EXAMPLE:
Input: "help me with a greeting"

Your output should be:
Role: Conversational AI

Objective: Acknowledge the user's greeting and initiate a helpful interaction.

Constraints:
- Response should be friendly and welcoming
- Response should be concise and avoid unnecessary details

Deliverables:
- Acknowledge the greeting
- Offer assistance or ask how to help

Output Format: Text

Now enhance this prompt (output ONLY the structured format above, nothing else):
{{PROMPT}}`
};

export const GEMINI_API = {
  BASE_URL: 'https://generativelanguage.googleapis.com/v1beta',
  MODEL: 'gemini-2.0-flash',  // Updated from gemini-1.5-flash (deprecated)
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
