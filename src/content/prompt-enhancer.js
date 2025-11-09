/**
 * Prompt Enhancement System
 * Rule-based and AI-powered prompt enhancement
 */

import { ENHANCEMENT_LEVELS, GEMINI_API, ERROR_MESSAGES, PROMPT_TEMPLATES } from '../shared/constants.js';
import { truncate, retryWithBackoff } from '../shared/utils.js';
import { TEST_MODE_ENABLED, HARDCODED_API_KEY } from '../shared/test-config.js';

class PromptEnhancer {
  constructor(subscriptionManager) {
    this.subscriptionManager = subscriptionManager;
    this.enhancementStrategies = {
      clarification: this.clarifyPrompt.bind(this),
      contextual: this.addContext.bind(this),
      structured: this.structurePrompt.bind(this),
      technical: this.enhanceTechnical.bind(this),
      creative: this.enhanceCreative.bind(this),
      general: this.enhanceGeneral.bind(this)
    };
  }

  /**
   * Main enhancement entry point
   */
  async enhancePrompt(context, settings = {}) {
    const subscription = this.subscriptionManager
      ? await this.subscriptionManager.getActiveSubscription()
      : null;

    const apiKey = settings.geminiKey
      || subscription?.apiKey
      || (TEST_MODE_ENABLED ? HARDCODED_API_KEY : null);

    if (!apiKey) {
      throw new Error(ERROR_MESSAGES.API_KEY_INVALID);
    }

    return await this.enhanceWithGemini(context, apiKey, settings);
  }

  /**
   * Rule-based enhancement (free tier)
   */
  ruleBasedEnhancement(context, settings = {}) {
    const { currentPrompt, conversationHistory, metadata } = context;

    if (!currentPrompt || currentPrompt.trim().length === 0) {
      throw new Error(ERROR_MESSAGES.NO_PROMPT);
    }

    // Select appropriate strategy based on metadata
    const strategy = this.selectStrategy(metadata, context);

    // Apply enhancement strategy
    let enhanced = this.enhancementStrategies[strategy](
      currentPrompt,
      context,
      settings
    );

    // Apply enhancement level adjustments
    const level = settings.enhancementLevel || ENHANCEMENT_LEVELS.MODERATE;
    enhanced = this.applyEnhancementLevel(enhanced, currentPrompt, level);

    return {
      original: currentPrompt,
      enhanced: enhanced,
      strategy: strategy,
      method: 'rule-based',
      changes: this.identifyChanges(currentPrompt, enhanced)
    };
  }

  /**
   * AI-powered enhancement with Gemini (BYOK tier)
   */
  async enhanceWithGemini(context, apiKey, settings = {}) {
    const { currentPrompt, conversationHistory, metadata } = context;

    if (!currentPrompt || currentPrompt.trim().length === 0) {
      throw new Error(ERROR_MESSAGES.NO_PROMPT);
    }

    const enhancementPrompt = this.buildGeminiPrompt(context, settings);

    try {
      const enhanced = await retryWithBackoff(async () => {
        return await this.callGeminiAPI(enhancementPrompt, apiKey);
      }, GEMINI_API.MAX_RETRIES);

      return {
        original: currentPrompt,
        enhanced: enhanced,
        strategy: 'ai-powered',
        method: 'gemini',
        changes: this.identifyChanges(currentPrompt, enhanced)
      };
    } catch (error) {
      console.error('[APE] Gemini API error:', error);
      throw new Error(ERROR_MESSAGES.API_ERROR);
    }
  }

  /**
   * Call Gemini API
   */
  async callGeminiAPI(prompt, apiKey) {
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
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error(ERROR_MESSAGES.RATE_LIMIT);
        }
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('No response from API');
      }

      return data.candidates[0].content.parts[0].text.trim();
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Build prompt for Gemini API
   */
  buildGeminiPrompt(context, settings = {}) {
    const { currentPrompt } = context;
    const templateType = settings.promptTemplateType || 'standard';

    let template;
    if (templateType === 'custom' && settings.customPromptTemplate?.trim()) {
      template = settings.customPromptTemplate.trim();
    } else {
      template = PROMPT_TEMPLATES[templateType] || PROMPT_TEMPLATES.standard;
    }

    if (!template.includes('{{PROMPT}}')) {
      template = `${template}\n\n{{PROMPT}}`;
    }

    return template.replace(/{{PROMPT}}/g, currentPrompt);
  }

  /**
   * Select enhancement strategy
   */
  selectStrategy(metadata, context) {
    const { intent, hasCode, complexity } = metadata;
    const { conversationHistory } = context;

    if (hasCode) return 'technical';
    if (intent === 'creative') return 'creative';
    if (conversationHistory.length > 5) return 'contextual';
    if (complexity < 0.3) return 'clarification';
    if (intent === 'question') return 'structured';

    return 'general';
  }

  /**
   * Clarify vague prompts
   */
  clarifyPrompt(prompt, context, settings) {
    // Simply return the prompt as-is for rule-based mode
    return prompt;
  }

  /**
   * Add relevant context
   */
  addContext(prompt, context, settings) {
    const { conversationHistory, metadata } = context;
    const relevant = this.findRelevantContext(prompt, conversationHistory);

    if (relevant.length === 0) return prompt;

    const contextSummary = relevant
      .map(msg => `- ${msg.role}: ${truncate(msg.content, 80)}`)
      .join('\n');

    return `Based on our conversation:\n${contextSummary}\n\n${prompt}`;
  }

  /**
   * Structure prompt with clear sections
   */
  structurePrompt(prompt, context, settings) {
    const components = this.parsePromptComponents(prompt);

    let structured = '';

    if (components.background) {
      structured += `**Background:**\n${components.background}\n\n`;
    }

    if (components.objective) {
      structured += `**Goal:**\n${components.objective}\n\n`;
    }

    if (components.requirements.length > 0) {
      structured += `**Requirements:**\n${components.requirements.map(r => `- ${r}`).join('\n')}\n\n`;
    }

    if (components.constraints.length > 0) {
      structured += `**Constraints:**\n${components.constraints.map(c => `- ${c}`).join('\n')}\n\n`;
    }

    if (components.outputFormat) {
      structured += `**Expected Output:**\n${components.outputFormat}`;
    }

    return structured.trim() || prompt;
  }

  /**
   * Enhance technical prompts
   */
  enhanceTechnical(prompt, context, settings) {
    // Simply return the prompt as-is for rule-based mode
    return prompt;
  }

  /**
   * Enhance creative prompts
   */
  enhanceCreative(prompt, context, settings) {
    // Simply return the prompt as-is for rule-based mode
    return prompt;
  }

  /**
   * General enhancement
   */
  enhanceGeneral(prompt, context, settings) {
    // Simply return the prompt as-is for rule-based mode
    // The actual enhancement happens in the AI call
    return prompt;
  }

  /**
   * Parse prompt into components
   */
  parsePromptComponents(prompt) {
    const components = {
      background: null,
      objective: null,
      requirements: [],
      constraints: [],
      outputFormat: null
    };

    const sentences = prompt.split(/[.!?]+/).filter(s => s.trim());

    sentences.forEach((sentence, index) => {
      const lower = sentence.toLowerCase().trim();

      if (index === 0 || lower.includes('want') || lower.includes('need')) {
        components.objective = sentence.trim();
      } else if (lower.includes('must') || lower.includes('should') || lower.includes('require')) {
        components.requirements.push(sentence.trim());
      } else if (lower.includes('not') || lower.includes("don't") || lower.includes('avoid') || lower.includes('without')) {
        components.constraints.push(sentence.trim());
      } else if (lower.includes('format') || lower.includes('structure') || lower.includes('output')) {
        components.outputFormat = sentence.trim();
      } else if (index < 2 && !components.background) {
        components.background = sentence.trim();
      }
    });

    return components;
  }

  /**
   * Find relevant context messages
   */
  findRelevantContext(prompt, history) {
    const keywords = prompt.toLowerCase().split(/\W+/).filter(w => w.length > 3);
    const relevant = [];

    history.forEach(msg => {
      const msgWords = msg.content.toLowerCase().split(/\W+/);
      const overlap = keywords.filter(kw => msgWords.includes(kw));

      if (overlap.length >= 2) {
        relevant.push(msg);
      }
    });

    return relevant.slice(-3);
  }

  /**
   * Apply enhancement level
   */
  applyEnhancementLevel(enhanced, original, level) {
    switch (level) {
      case ENHANCEMENT_LEVELS.LIGHT:
        // Only apply minimal changes
        if (enhanced.length > original.length * 1.5) {
          return original + '\n\n' + enhanced.substring(original.length, original.length * 1.5);
        }
        return enhanced;

      case ENHANCEMENT_LEVELS.AGGRESSIVE:
        // Full enhancement
        return enhanced;

      case ENHANCEMENT_LEVELS.MODERATE:
      default:
        // Balanced approach
        return enhanced;
    }
  }

  /**
   * Identify specific changes made
   */
  identifyChanges(original, enhanced) {
    const changes = [];

    if (enhanced.length > original.length * 1.2) {
      changes.push('Added context and details');
    }

    if (enhanced.includes('**') || enhanced.includes('\n-')) {
      changes.push('Improved structure');
    }

    if (enhanced.toLowerCase() !== original.toLowerCase()) {
      changes.push('Refined wording');
    }

    if (enhanced.includes('[') || enhanced.includes('Context:')) {
      changes.push('Added contextual references');
    }

    return changes;
  }
}

export default PromptEnhancer;
