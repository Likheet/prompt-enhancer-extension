/**
 * Application Constants
 */

export const PLATFORMS = {
  CHATGPT: 'chatgpt',
  CLAUDE: 'claude',
  GEMINI: 'gemini',
  PERPLEXITY: 'perplexity',
  AI_STUDIO: 'aistudio',
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
  standard: `CONTEXT EVALUATION: Analyze if conversation history is relevant. Use context only if the input contains pronouns without antecedents ("it," "this," "that"), references to previous topics ("also," "continue," "as mentioned"), or builds on prior requests. If the input is self-contained or pivots to a new topic, ignore history and treat as standalone.

ENHANCEMENT LEVEL: \${enhancementLevel}

Light: Preserve original phrasing, add only essential missing elements
Moderate: Balance preservation with improvement, add structure where needed
Aggressive: Comprehensive transformation for maximum clarity and precision

PRESET FOCUS: \${presetFocus}

Technical: Emphasize specifications, constraints, measurable criteria, technical precision
Creative: Enhance descriptive language, stylistic guidance, creative parameters, vision clarity
Business: Add success metrics, stakeholder context, deliverables, professional framing
Academic: Include methodology, research parameters, analytical depth, citation requirements
Conversational: Maintain natural tone while adding clarity and helpful context
General: Balanced enhancement across all dimensions

Transform the input by enhancing these five dimensions:

CLARITY: Eliminate ambiguity, refine wording, structure information logically
SPECIFICITY: Add concrete details, quantifiable metrics, explicit examples, targeted parameters
CONTEXT: Incorporate background information, use cases, audience details, domain knowledge
CONSTRAINTS: Define boundaries, scope, format requirements, style guidelines, success criteria
ACTIONABILITY: Use active instructions, specify deliverables, include evaluation methods, establish measurable outcomes

\${conversationContext}

INPUT: \${userInput}

Output only the enhanced prompt with no meta-commentary, explanations, formatting markup, or quotation marks.`,
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
