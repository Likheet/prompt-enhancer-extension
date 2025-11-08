/**
 * Prompt Enhancement System
 * Rule-based and AI-powered prompt enhancement
 */

import { ENHANCEMENT_LEVELS, GEMINI_API, ERROR_MESSAGES } from '../shared/constants.js';
import { truncate, retryWithBackoff } from '../shared/utils.js';

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
    const subscription = await this.subscriptionManager.getActiveSubscription();

    // Route to appropriate enhancement method
    if (subscription.type === 'byok' && subscription.apiKey) {
      return await this.enhanceWithGemini(context, subscription.apiKey, settings);
    } else {
      return this.ruleBasedEnhancement(context, settings);
    }
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

      // Fallback to rule-based
      console.log('[APE] Falling back to rule-based enhancement');
      return this.ruleBasedEnhancement(context, settings);
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
  buildGeminiPrompt(context, settings) {
    const { currentPrompt, conversationHistory, metadata } = context;

    const recentContext = conversationHistory.slice(-3);
    const contextStr = recentContext.length > 0
      ? JSON.stringify(recentContext, null, 2)
      : 'No previous context';

    return `You are an expert prompt engineer. Enhance the following prompt to be more effective, clear, and likely to produce high-quality AI responses.

CURRENT PROMPT:
"${currentPrompt}"

CONVERSATION CONTEXT:
${contextStr}

METADATA:
- Platform: ${context.platform}
- Topic: ${metadata.topic || 'General'}
- Intent: ${metadata.intent}
- Has Code: ${metadata.hasCode}
- Language: ${metadata.language}
- Complexity: ${metadata.complexity.toFixed(2)}

ENHANCEMENT GUIDELINES:
1. Maintain the original intent and meaning
2. Add necessary context from conversation history if relevant
3. Structure the prompt for clarity
4. Include specific details that may be implicit
5. Optimize for the detected intent type (${metadata.intent})
6. Remove ambiguity and add precise requirements
7. Keep it concise - don't over-elaborate
8. If technical, ensure proper terminology

IMPORTANT: Return ONLY the enhanced prompt text, without any explanations, preamble, or meta-commentary.`;
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
    const enhancements = [];
    const { conversationHistory, metadata } = context;

    // Check for pronouns without clear antecedents
    if (prompt.match(/\b(this|that|it|they|these|those)\b/i)) {
      const lastMsg = conversationHistory.filter(m => m.role === 'assistant').pop();
      if (lastMsg) {
        enhancements.push(`\n\n[Context: Referring to ${truncate(lastMsg.content, 60)}]`);
      }
    }

    // Add specificity for very short prompts
    if (prompt.length < 30) {
      enhancements.push('\n\nPlease provide a detailed and comprehensive response with examples where appropriate.');
    }

    // Add output format request if not specified
    if (!prompt.match(/\b(list|steps|explain|describe|format|structure|bullet|numbered)\b/i)) {
      enhancements.push('\n\nPlease structure your response clearly with appropriate formatting.');
    }

    return `${prompt}${enhancements.join('')}`.trim();
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
    const { metadata } = context;
    const enhancements = [];

    // Add language specification
    if (metadata.language && metadata.language !== 'general') {
      enhancements.push(`Language: ${metadata.language}`);
    }

    // Add technical best practices
    const hasVersionSpec = prompt.match(/\b(version|v\d+|\d+\.\d+)\b/i);
    if (!hasVersionSpec) {
      enhancements.push('Please specify version requirements if applicable');
    }

    // Emphasize code quality
    if (prompt.match(/\b(code|function|implement|create|write)\b/i)) {
      if (!prompt.match(/\b(error|exception|handle|handling)\b/i)) {
        enhancements.push('Include appropriate error handling');
      }
      if (!prompt.match(/\b(comment|document|doc)\b/i)) {
        enhancements.push('Include clear code comments and documentation');
      }
      if (!prompt.match(/\b(test|testing|example)\b/i)) {
        enhancements.push('Provide usage examples');
      }
    }

    if (enhancements.length === 0) return prompt;

    return `${prompt}\n\n**Technical Requirements:**\n${enhancements.map(e => `- ${e}`).join('\n')}`;
  }

  /**
   * Enhance creative prompts
   */
  enhanceCreative(prompt, context, settings) {
    const enhancements = [];

    // Add creative parameters if missing
    if (!prompt.match(/\b(tone|style|voice|mood|atmosphere)\b/i)) {
      enhancements.push('Tone: Engaging and natural');
    }

    if (!prompt.match(/\b(length|words|paragraphs|pages)\b/i)) {
      enhancements.push('Length: Appropriate to the content');
    }

    if (!prompt.match(/\b(audience|reader|for whom|target)\b/i)) {
      enhancements.push('Audience: General readers');
    }

    if (enhancements.length === 0) return prompt;

    return `${prompt}\n\n**Creative Guidelines:**\n${enhancements.map(e => `- ${e}`).join('\n')}`;
  }

  /**
   * General enhancement
   */
  enhanceGeneral(prompt, context, settings) {
    const { metadata } = context;

    // Add clarity and detail request
    let enhanced = prompt;

    // Add context clues
    if (metadata.intent !== 'general') {
      enhanced += `\n\n[This appears to be a ${metadata.intent} query]`;
    }

    // Request comprehensive response
    if (prompt.length < 100) {
      enhanced += '\n\nPlease provide a comprehensive and detailed response.';
    }

    return enhanced;
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
