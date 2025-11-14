/**
 * Enhancement Presets
 * Defines different enhancement strategies for various use cases
 */

import browserCompat from '../shared/browser-compat.js';
import { GEMINI_API, ERROR_MESSAGES, PROMPT_TEMPLATES, ENHANCEMENT_PRESETS } from '../shared/constants.js';
import { TEST_MODE_ENABLED, HARDCODED_API_KEY } from '../shared/test-config.js';

class EnhancementPresets {
  constructor() {
    this.presets = {
      [ENHANCEMENT_PRESETS.CONCISE]: {
        name: 'Concise & Clear',
        description: 'Makes prompts more direct and specific',
        emoji: '🎯',
        systemPrompt: `You are a prompt optimization expert. Your task is to make this prompt more concise and clear.

RULES:
- Remove unnecessary words and fluff
- Make requirements explicit and specific
- Add concrete details where vague
- Keep it brief but complete
- Maintain the original intent
- Use direct, actionable language
- Avoid redundancy

Return ONLY the enhanced prompt without any explanation.`,
        ruleBasedStrategy: 'clarification'
      },
      [ENHANCEMENT_PRESETS.DETAILED]: {
        name: 'Detailed & Comprehensive',
        description: 'Adds context and requirements for thorough responses',
        emoji: '📋',
        systemPrompt: `You are a prompt optimization expert. Your task is to make this prompt more comprehensive and detailed.

RULES:
- Add relevant context from the conversation history
- Include all implicit requirements explicitly
- Specify desired output format and structure
- Add quality criteria and expectations
- Include edge cases to consider
- Make expectations crystal clear
- Add examples if helpful
- Specify constraints

Return ONLY the enhanced prompt without any explanation.`,
        ruleBasedStrategy: 'structured'
      },
      [ENHANCEMENT_PRESETS.BALANCED]: {
        name: 'Balanced Enhancement',
        description: 'Optimizes for clarity and completeness',
        emoji: '⚖️',
        systemPrompt: `You are a prompt optimization expert. Your task is to enhance this prompt with balanced improvements.

RULES:
- Clarify any ambiguous terms or requirements
- Add necessary context from conversation
- Structure for better readability
- Include key requirements without over-specifying
- Maintain appropriate detail level
- Ensure instructions are actionable
- Balance brevity with completeness

Return ONLY the enhanced prompt without any explanation.`,
        ruleBasedStrategy: 'general'
      },
      [ENHANCEMENT_PRESETS.TECHNICAL]: {
        name: 'Technical Optimization',
        description: 'Optimizes for technical/coding tasks',
        emoji: '💻',
        systemPrompt: `You are a technical prompt optimization expert. Your task is to enhance this prompt for technical/coding tasks.

RULES:
- Specify programming language and version if applicable
- Add technical requirements and constraints
- Include error handling expectations
- Specify performance criteria if relevant
- Add testing/validation requirements
- Request clear documentation/comments
- Clarify input/output formats and types
- Include security considerations if applicable
- Specify coding standards or best practices

Return ONLY the enhanced prompt without any explanation.`,
        ruleBasedStrategy: 'technical'
      },
      [ENHANCEMENT_PRESETS.CREATIVE]: {
        name: 'Creative Enhancement',
        description: 'Optimizes for creative writing tasks',
        emoji: '✨',
        systemPrompt: `You are a creative prompt optimization expert. Your task is to enhance this prompt for creative tasks.

RULES:
- Add tone and style guidelines
- Specify target audience if not clear
- Include length or format requirements
- Add creative constraints if helpful
- Clarify the desired mood or feeling
- Include examples of desired style if applicable
- Specify any content restrictions
- Add structural guidance without being overly prescriptive

Return ONLY the enhanced prompt without any explanation.`,
        ruleBasedStrategy: 'creative'
      },
      [ENHANCEMENT_PRESETS.CUSTOM]: {
        name: 'Custom Enhancement',
        description: 'Use your own enhancement instructions',
        emoji: '🔧',
        systemPrompt: null,
        ruleBasedStrategy: 'general'
      }
    };

    this.contextInvalidNotified = false;
  }

  getAllPresets() {
    return Object.entries(this.presets).map(([key, preset]) => ({
      key,
      ...preset
    }));
  }

  getPreset(key) {
    return this.presets[key] || this.presets[ENHANCEMENT_PRESETS.BALANCED];
  }

  async enhanceWithPreset(context, presetKey, customPrompt = null) {
    const preset = this.getPreset(presetKey);
    const settings = await this.getSettings();
    const subscription = await this.getSubscription();

    const apiKey = settings.geminiKey
      || subscription?.apiKey
      || (TEST_MODE_ENABLED ? HARDCODED_API_KEY : null);

    if (apiKey) {
      return await this.enhanceWithAI(context, preset, presetKey, customPrompt, apiKey, settings);
    }

    return await this.enhanceWithRules(context, preset);
  }

  async enhanceWithAI(context, preset, presetKey, customPrompt, apiKey, settings) {
    const templateType = settings.promptTemplateType || 'standard';
    const systemPrompt = presetKey === ENHANCEMENT_PRESETS.CUSTOM && customPrompt
      ? customPrompt
      : preset.systemPrompt;

    const enhancementRequest = this.buildEnhancementRequest(
      systemPrompt,
      context,
      settings
    );

    try {
      const response = await fetch(
        `${GEMINI_API.BASE_URL}/models/${GEMINI_API.MODEL}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: enhancementRequest }]
            }],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 2048
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error(`${ERROR_MESSAGES.API_ERROR} (status ${response.status})`);
      }

      const data = await response.json();
      const enhanced = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

      return this.cleanEnhancedPrompt(enhanced, { templateType, presetKey });
    } catch (error) {
      console.error('[EnhancementPresets] Gemini API error:', error);
      return await this.enhanceWithRules(context, preset);
    }
  }

  buildEnhancementRequest(systemPrompt, context, settings = {}) {
    const userInput = context.currentPrompt || '';
    const templateType = settings.promptTemplateType || 'standard';
    const enhancementLevel = settings.enhancementLevel || 'moderate';
    const currentPreset = settings.currentEnhancementType || 'balanced';

    let template;
    if (templateType === 'custom' && settings.customPromptTemplate?.trim()) {
      template = settings.customPromptTemplate.trim();
    } else {
      template = PROMPT_TEMPLATES[templateType] || PROMPT_TEMPLATES.standard;
    }

    // For legacy templates that use {{PROMPT}}
    if (template.includes('{{PROMPT}}')) {
      let request = template.replace(/{{PROMPT}}/g, userInput);
      
      if (systemPrompt) {
        request = `${systemPrompt.trim()}\n\n${request}`;
      }

      if (context.conversationHistory && context.conversationHistory.length > 0) {
        const recentMessages = context.conversationHistory.slice(-3);
        const contextSummary = recentMessages
          .map((msg, idx) => `${idx + 1}. [${msg.role}]: ${msg.content.substring(0, 200)}`)
          .join('\n');

        request += `\n\nConversation Snapshot:\n${contextSummary}`;
      }

      return request;
    }

    // For new dynamic templates with ${variables}
    let request = template;

    // Add system prompt if provided (for preset-specific instructions)
    if (systemPrompt) {
      request = `${systemPrompt.trim()}\n\n${request}`;
    }

    // Replace enhancement level
    request = request.replace(/\$\{enhancementLevel\}/g, this.formatEnhancementLevel(enhancementLevel));

    // Map preset to focus area
    const presetFocusMap = {
      'concise': 'General',
      'detailed': 'General',
      'balanced': 'General',
      'technical': 'Technical',
      'creative': 'Creative',
      'custom': 'General'
    };
    const presetFocus = presetFocusMap[currentPreset] || 'General';
    request = request.replace(/\$\{presetFocus\}/g, presetFocus);

    // Replace user input
    request = request.replace(/\$\{userInput\}/g, userInput);

    // Intelligent context inclusion
    const conversationHistory = context.conversationHistory || [];
    const needsContext = this.contextIsRelevant(userInput, conversationHistory);
    
    if (needsContext && conversationHistory.length > 0) {
      const recentMessages = conversationHistory.slice(-3);
      const contextSummary = recentMessages
        .map((msg, idx) => `${idx + 1}. [${msg.role}]: ${msg.content.substring(0, 200)}`)
        .join('\n');
      
      const conversationContext = `CONVERSATION HISTORY:\n${contextSummary}\n`;
      request = request.replace(/\$\{conversationContext\}/g, conversationContext);
    } else {
      // Remove the conversation context placeholder
      request = request.replace(/\$\{conversationContext\}\s*/g, '');
    }

    return request;
  }

  formatEnhancementLevel(level) {
    const levelMap = {
      'light': 'Light',
      'moderate': 'Moderate',
      'aggressive': 'Aggressive'
    };
    return levelMap[level] || 'Moderate';
  }

  contextIsRelevant(userInput, conversationHistory) {
    if (!conversationHistory || conversationHistory.length === 0) return false;
    if (!userInput) return false;

    const contextIndicators = [
      /\b(it|this|that|these|those)\b/i,
      /\b(also|too|additionally|furthermore|moreover)\b/i,
      /\b(continue|keep|following|previous|earlier)\b/i,
      /\b(as (I|we|you) (mentioned|said|discussed|noted))\b/i,
      /\b(the (above|earlier|prior|previous))\b/i,
      /\b(same|similar|like before)\b/i,
      /\b(another|more|still)\b/i
    ];

    return contextIndicators.some(pattern => pattern.test(userInput));
  }

  cleanEnhancedPrompt(enhanced, options = {}) {
    let cleaned = enhanced;

    cleaned = cleaned.replace(/^(Here is|Here's|Here are)[\s\S]*?:\s*/i, '');

    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
      cleaned = cleaned.slice(1, -1);
    }
    if (cleaned.startsWith('\'') && cleaned.endsWith('\'')) {
      cleaned = cleaned.slice(1, -1);
    }

    if (cleaned.startsWith('```') && cleaned.endsWith('```')) {
      cleaned = cleaned.replace(/^```[a-z]*\n/, '').replace(/\n```$/, '');
    }

    cleaned = cleaned.trim();

    if (options.templateType === 'structured') {
      cleaned = this.formatStructuredOutput(cleaned);
    }

    return cleaned;
  }

  formatStructuredOutput(text) {
    if (!text) {
      return text;
    }

    let formatted = text.replace(/\r\n/g, '\n');
    const sectionLabels = ['Role:', 'Objective:', 'Constraints:', 'Deliverables:', 'Output Format:'];
    const escapedLabels = sectionLabels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const combinedPattern = new RegExp(`\\s*(${escapedLabels.join('|')})`, 'gi');

    // Add newline before each section label
    formatted = formatted.replace(combinedPattern, (_, label) => `\n${label}`);
    formatted = formatted.replace(/^\n+/, '');

    // Add double newline before each section except Role (for spacing)
    sectionLabels.slice(1).forEach((label) => {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const anchorPattern = new RegExp(`\n${escaped}`, 'gi');
      formatted = formatted.replace(anchorPattern, `\n\n${label}`);
    });

    // Ensure content after Constraints/Deliverables starts on new line
    ['Constraints:', 'Deliverables:'].forEach((label) => {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const ensureLineBreak = new RegExp(`${escaped}\\s*(?!\\n)`, 'gi');
      formatted = formatted.replace(ensureLineBreak, `${label}\n`);
    });

    // Fix bullet points - only match at start of words after whitespace, not hyphens in words
    // Match: "  - item" or "\n- item" but not "non-specific"
    formatted = formatted.replace(/(\n|\s{2,})-\s+/g, '\n- ');
    
    // Remove multiple consecutive newlines
    formatted = formatted.replace(/\n{3,}/g, '\n\n');
    
    // Remove trailing whitespace from lines
    formatted = formatted.replace(/[ \t]+\n/g, '\n');
    formatted = formatted.replace(/[ \t]+$/gm, '');

    return formatted.trim();
  }

  async enhanceWithRules(context, preset) {
    const strategy = preset.ruleBasedStrategy || 'general';
    const { default: PromptEnhancer } = await import('./prompt-enhancer.js');
    const enhancer = new PromptEnhancer(null);

    const strategies = {
      clarification: () => enhancer.clarifyPrompt(context.currentPrompt, context),
      structured: () => enhancer.structurePrompt(context.currentPrompt, context),
      technical: () => enhancer.enhanceTechnical(context.currentPrompt, context),
      creative: () => enhancer.enhanceCreative(context.currentPrompt, context),
      general: () => enhancer.enhanceGeneral(context.currentPrompt, context)
    };

    const enhanceFn = strategies[strategy] || strategies.general;
    return enhanceFn();
  }

  async getSettings() {
    try {
      const result = await browserCompat.storageGet(['enhancerSettings']);
      return result.enhancerSettings || {};
    } catch (error) {
      const message = error?.message || String(error);
      if (message.includes('Extension context invalidated')) {
        if (!this.contextInvalidNotified) {
          console.warn('[EnhancementPresets] Extension context invalidated while reading settings. Refresh the page to reinitialize.');
          this.contextInvalidNotified = true;
        }
      } else {
        console.error('[EnhancementPresets] Failed to get settings:', error);
      }
      return {};
    }
  }

  async getSubscription() {
    try {
      const response = await browserCompat.sendMessage({
        action: 'getSubscription'
      });
      return response || { type: 'free' };
    } catch (error) {
      const message = error?.message || String(error);
      if (message.includes('Extension context invalidated')) {
        if (!this.contextInvalidNotified) {
          console.warn('[EnhancementPresets] Extension context invalidated while fetching subscription. Refresh the page to reinitialize.');
          this.contextInvalidNotified = true;
        }
      } else {
        console.error('[EnhancementPresets] Failed to get subscription:', error);
      }
      return { type: 'free' };
    }
  }
}

export default EnhancementPresets;
