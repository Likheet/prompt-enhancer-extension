/**
 * Enhancement Presets
 * Defines different enhancement strategies for various use cases
 */

import browserCompat from '../shared/browser-compat.js';

class EnhancementPresets {
  constructor() {
    this.presets = {
      concise: {
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

      detailed: {
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

      balanced: {
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

      technical: {
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

      creative: {
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

      custom: {
        name: 'Custom Enhancement',
        description: 'Use your own enhancement instructions',
        emoji: '🔧',
        systemPrompt: null, // Will be replaced by user's custom prompt
        ruleBasedStrategy: 'general'
      }
    };
  }

  /**
   * Get all available presets
   */
  getAllPresets() {
    return Object.entries(this.presets).map(([key, preset]) => ({
      key,
      ...preset
    }));
  }

  /**
   * Get a specific preset
   */
  getPreset(key) {
    return this.presets[key] || this.presets.balanced;
  }

  /**
   * Enhance prompt using a preset
   */
  async enhanceWithPreset(context, presetKey, customPrompt = null) {
    const preset = this.getPreset(presetKey);

    // Check if BYOK is available
    const settings = await this.getSettings();
    const subscription = await this.getSubscription();

    // Determine if we should use AI enhancement
    const useAI = subscription.type === 'byok' && settings.geminiKey;

    if (useAI) {
      return await this.enhanceWithAI(context, preset, presetKey, customPrompt, settings.geminiKey);
    } else {
      return await this.enhanceWithRules(context, preset);
    }
  }

  /**
   * Enhance with AI (Gemini)
   */
  async enhanceWithAI(context, preset, presetKey, customPrompt, apiKey) {
    const systemPrompt = presetKey === 'custom' && customPrompt
      ? customPrompt
      : preset.systemPrompt;

    if (!systemPrompt) {
      throw new Error('No enhancement prompt defined');
    }

    const enhancementRequest = this.buildEnhancementRequest(
      systemPrompt,
      context
    );

    try {
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
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
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const enhanced = data.candidates[0].content.parts[0].text.trim();

      // Clean up any wrapper text
      return this.cleanEnhancedPrompt(enhanced);
    } catch (error) {
      console.error('[EnhancementPresets] Gemini API error:', error);
      // Fallback to rule-based
      return await this.enhanceWithRules(context, preset);
    }
  }

  /**
   * Build enhancement request for AI
   */
  buildEnhancementRequest(systemPrompt, context) {
    let request = `${systemPrompt}\n\n`;

    // Add conversation context if available
    if (context.conversationHistory && context.conversationHistory.length > 0) {
      request += `CONVERSATION CONTEXT:\n`;
      const recentMessages = context.conversationHistory.slice(-3);
      recentMessages.forEach((msg, idx) => {
        const preview = msg.content.substring(0, 150);
        request += `${idx + 1}. [${msg.role}]: ${preview}${msg.content.length > 150 ? '...' : ''}\n`;
      });
      request += `\n`;
    }

    // Add metadata
    if (context.metadata) {
      request += `CONTEXT INFO:\n`;
      if (context.metadata.topic) {
        request += `- Topic: ${context.metadata.topic}\n`;
      }
      if (context.metadata.hasCode) {
        request += `- Contains code/technical content\n`;
      }
      if (context.metadata.language && context.metadata.language !== 'general') {
        request += `- Language/Type: ${context.metadata.language}\n`;
      }
      request += `\n`;
    }

    // Add the actual prompt
    request += `ORIGINAL PROMPT:\n${context.currentPrompt}\n\n`;

    request += `ENHANCED PROMPT:`;

    return request;
  }

  /**
   * Clean enhanced prompt (remove any explanatory text)
   */
  cleanEnhancedPrompt(enhanced) {
    // Remove common wrapper patterns
    let cleaned = enhanced;

    // Remove "Here is..." or "Here's..." introductions
    cleaned = cleaned.replace(/^(Here is|Here's|Here are)[\s\S]*?:\s*/i, '');

    // Remove quotes if the entire response is quoted
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
      cleaned = cleaned.slice(1, -1);
    }
    if (cleaned.startsWith("'") && cleaned.endsWith("'")) {
      cleaned = cleaned.slice(1, -1);
    }

    // Remove markdown code blocks if entire response is wrapped
    if (cleaned.startsWith('```') && cleaned.endsWith('```')) {
      cleaned = cleaned.replace(/^```[a-z]*\n/, '').replace(/\n```$/, '');
    }

    return cleaned.trim();
  }

  /**
   * Enhance with rule-based strategies (fallback)
   */
  async enhanceWithRules(context, preset) {
    const strategy = preset.ruleBasedStrategy || 'general';

    // Import the rule-based enhancer
    const { default: PromptEnhancer } = await import('./prompt-enhancer.js');
    const enhancer = new PromptEnhancer(null);

    // Use the appropriate rule-based strategy
    const strategies = {
      clarification: () => enhancer.clarifyPrompt(context.currentPrompt, context),
      structured: () => enhancer.structurePrompt(context.currentPrompt, context),
      technical: () => enhancer.enhanceTechnical(context.currentPrompt, context),
      creative: () => enhancer.enhanceCreative(context.currentPrompt, context),
      general: () => enhancer.basicEnhancement(context)
    };

    const enhanceFn = strategies[strategy] || strategies.general;
    return enhanceFn();
  }

  /**
   * Get current settings
   */
  async getSettings() {
    try {
      const result = await browserCompat.storage_get(['enhancerSettings']);
      return result.enhancerSettings || {};
    } catch (error) {
      console.error('[EnhancementPresets] Failed to get settings:', error);
      return {};
    }
  }

  /**
   * Get subscription info
   */
  async getSubscription() {
    try {
      const response = await browserCompat.sendMessage({
        action: 'getSubscription'
      });
      return response || { type: 'free' };
    } catch (error) {
      console.error('[EnhancementPresets] Failed to get subscription:', error);
      return { type: 'free' };
    }
  }
}

export default EnhancementPresets;
