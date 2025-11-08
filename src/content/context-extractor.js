/**
 * Context Extraction System
 * Analyzes conversation history and extracts relevant context
 */

import {
  extractKeywords,
  calculateSimilarity,
  hashString,
  detectIntent
} from '../shared/utils.js';

class ContextExtractor {
  constructor(domObserver) {
    this.domObserver = domObserver;
    this.maxContextLength = 4000;
    this.contextWindow = 10;
  }

  /**
   * Extract full context for enhancement
   */
  async extractFullContext() {
    const currentPrompt = await this.domObserver.extractPromptText();
    const conversationHistory = this.extractConversationHistory();
    const metadata = this.extractMetadata(currentPrompt, conversationHistory);

    return {
      currentPrompt,
      conversationHistory,
      metadata,
      platform: this.domObserver.platform,
      timestamp: Date.now()
    };
  }

  /**
   * Extract and process conversation history
   */
  extractConversationHistory() {
    const messages = this.domObserver.extractMessages();

    // Deduplicate messages
    const uniqueMessages = this.deduplicateMessages(messages);

    // Sort by timestamp
    uniqueMessages.sort((a, b) => a.timestamp - b.timestamp);

    // Take last N messages
    const recentMessages = uniqueMessages.slice(-this.contextWindow);

    // Map to simplified format
    return recentMessages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  /**
   * Deduplicate messages by content
   */
  deduplicateMessages(messages) {
    const seen = new Map();
    const unique = [];

    for (const msg of messages) {
      const hash = hashString(msg.content);

      if (!seen.has(hash)) {
        seen.set(hash, true);
        unique.push(msg);
      }
    }

    return unique;
  }

  /**
   * Extract metadata about the conversation
   */
  extractMetadata(currentPrompt, conversationHistory) {
    return {
      topic: this.extractTopic(conversationHistory),
      intent: currentPrompt ? detectIntent(currentPrompt) : 'general',
      hasCode: this.detectCodeContent(),
      language: this.detectProgrammingLanguage(),
      messageCount: conversationHistory.length,
      complexity: this.estimateComplexity(currentPrompt),
      keywords: currentPrompt ? extractKeywords(currentPrompt) : []
    };
  }

  /**
   * Extract conversation topic
   */
  extractTopic(conversationHistory) {
    // Try page title first
    const title = document.title;
    if (title &&
        !title.includes('ChatGPT') &&
        !title.includes('Claude') &&
        !title.includes('New Chat')) {
      return title.substring(0, 100);
    }

    // Extract from first user message
    if (conversationHistory.length > 0) {
      const firstUserMsg = conversationHistory.find(m => m.role === 'user');
      if (firstUserMsg) {
        return firstUserMsg.content.substring(0, 100);
      }
    }

    return 'General conversation';
  }

  /**
   * Detect if conversation contains code
   */
  detectCodeContent() {
    const pageText = document.body.innerText.toLowerCase();

    const codeIndicators = [
      '```',
      'function',
      'const ',
      'let ',
      'var ',
      'import ',
      'export ',
      'class ',
      'def ',
      'public ',
      'private ',
      '(){',
      '=>'
    ];

    return codeIndicators.some(indicator => pageText.includes(indicator));
  }

  /**
   * Detect programming language
   */
  detectProgrammingLanguage() {
    const content = document.body.innerText.toLowerCase();

    const patterns = {
      python: /\b(def |import |from |print\(|if __name__|\.py\b|django|flask|pandas)/,
      javascript: /\b(const |let |var |function |=>|console\.log|react|node\.?js|npm|yarn)/,
      typescript: /\b(interface |type |enum |namespace |\.tsx?\b)/,
      java: /\b(public class |private |protected |void |System\.out|\.java\b)/,
      csharp: /\b(namespace |using |public class |private |\.cs\b|C#)/,
      cpp: /\b(#include|std::|cout|cin|\.cpp\b|C\+\+)/,
      go: /\b(func |package |import |go\b|\.go\b)/,
      rust: /\b(fn |let mut |impl |use |\.rs\b)/,
      sql: /\b(select |from |where |join |insert |update |delete |create table)/i,
      html: /<(div|span|html|head|body|script|style|a|p|h1|h2|h3)/,
      css: /\{[^}]*?(color|background|padding|margin|display|font):/,
      ruby: /\b(def |end\b|puts |require |\.rb\b)/,
      php: /\b(<\?php|function |echo |print |\.php\b)/,
      swift: /\b(func |var |let |import |\.swift\b)/,
      kotlin: /\b(fun |val |var |\.kt\b)/
    };

    for (const [lang, pattern] of Object.entries(patterns)) {
      if (pattern.test(content)) {
        return lang;
      }
    }

    return 'general';
  }

  /**
   * Estimate prompt complexity
   */
  estimateComplexity(prompt) {
    if (!prompt) return 0;

    let score = 0;

    // Length factor (longer prompts are often more complex)
    if (prompt.length > 200) score += 0.3;
    else if (prompt.length > 100) score += 0.2;
    else if (prompt.length > 50) score += 0.1;

    // Question words (questions can be complex)
    const questionWords = ['how', 'why', 'what', 'when', 'where', 'which'];
    if (questionWords.some(w => prompt.toLowerCase().includes(w))) {
      score += 0.2;
    }

    // Technical terms
    const technicalTerms = ['implement', 'optimize', 'algorithm', 'architecture', 'design pattern'];
    if (technicalTerms.some(t => prompt.toLowerCase().includes(t))) {
      score += 0.2;
    }

    // Multiple sentences (more complex)
    const sentences = prompt.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length > 3) score += 0.2;
    else if (sentences.length > 1) score += 0.1;

    // Code-related (often more specific requirements)
    if (this.detectCodeContent()) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Extract relevant context based on current prompt
   */
  extractRelevantContext(prompt, history) {
    if (!prompt || history.length === 0) return [];

    const promptKeywords = new Set(extractKeywords(prompt));
    const relevant = [];

    for (const msg of history) {
      const msgKeywords = new Set(extractKeywords(msg.content));
      const overlap = [...promptKeywords].filter(kw => msgKeywords.has(kw));

      if (overlap.length >= 2) {
        relevant.push({
          ...msg,
          relevance: overlap.length / promptKeywords.size
        });
      }
    }

    // Sort by relevance and take top messages
    relevant.sort((a, b) => b.relevance - a.relevance);
    return relevant.slice(0, 5);
  }

  /**
   * Summarize context for enhancement
   */
  summarizeContext(conversationHistory) {
    if (conversationHistory.length === 0) return null;

    const recentMessages = conversationHistory.slice(-5);

    return {
      topics: this.extractMainTopics(recentMessages),
      keyPoints: this.extractKeyPoints(recentMessages),
      tone: this.detectTone(recentMessages)
    };
  }

  /**
   * Extract main topics from messages
   */
  extractMainTopics(messages) {
    const allWords = messages
      .map(m => extractKeywords(m.content))
      .flat();

    const wordFreq = {};
    allWords.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });

    return Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  /**
   * Extract key points from messages
   */
  extractKeyPoints(messages) {
    const keyIndicators = [
      '?',
      'how to',
      'need to',
      'want to',
      'should',
      'must',
      'problem',
      'error',
      'issue',
      'help',
      'question'
    ];

    const keyPoints = [];

    messages.forEach(msg => {
      const sentences = msg.content.split(/[.!?]+/);
      sentences.forEach(sentence => {
        const lower = sentence.toLowerCase();
        if (keyIndicators.some(indicator => lower.includes(indicator))) {
          keyPoints.push(sentence.trim());
        }
      });
    });

    return keyPoints.slice(-3);
  }

  /**
   * Detect conversation tone
   */
  detectTone(messages) {
    if (messages.length === 0) return 'neutral';

    const allText = messages.map(m => m.content).join(' ').toLowerCase();

    if (allText.match(/\b(please|thank|appreciate|kindly)\b/)) {
      return 'polite';
    }
    if (allText.match(/\b(urgent|asap|quickly|now|immediate)\b/)) {
      return 'urgent';
    }
    if (allText.match(/\b(help|stuck|confused|difficult|struggling)\b/)) {
      return 'help-seeking';
    }
    if (allText.match(/\b(interesting|cool|amazing|great|awesome)\b/)) {
      return 'enthusiastic';
    }

    return 'neutral';
  }

  /**
   * Update context window size
   */
  setContextWindow(size) {
    this.contextWindow = Math.max(1, Math.min(20, size));
  }
}

export default ContextExtractor;
