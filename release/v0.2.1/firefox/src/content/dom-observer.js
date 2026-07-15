/**
 * Resilient DOM Observer
 * Platform-aware DOM manipulation with fallback strategies
 */

import { PLATFORMS } from '../shared/constants.js';
import { matchesHostname, throttle } from '../shared/utils.js';

class ResilientDOMObserver {
  constructor() {
    this.observer = null;
    this.platform = this.detectPlatform();
    this.selectors = this.getPlatformSelectors();
    this.inputElement = null;
    this.sendButton = null;
    this.missingInputWarned = false;
  }

  shouldSkipMount() {
    if (this.platform === PLATFORMS.AI_STUDIO) {
      const path = window.location.pathname.toLowerCase();
      if (path.includes('/usage') || path.includes('/billing') || path.includes('/projects') || path.includes('/settings')) {
        return true;
      }
    }
    return false;
  }

  /**
   * Detect current platform
   */
  detectPlatform() {
    const hostname = window.location.hostname.toLowerCase();
    if (matchesHostname(hostname, 'chatgpt.com') || matchesHostname(hostname, 'chat.openai.com')) {
      return PLATFORMS.CHATGPT;
    }
    if (matchesHostname(hostname, 'claude.ai')) {
      return PLATFORMS.CLAUDE;
    }
    if (matchesHostname(hostname, 'gemini.google.com')) {
      return PLATFORMS.GEMINI;
    }
    if (matchesHostname(hostname, 'perplexity.ai')) {
      return PLATFORMS.PERPLEXITY;
    }
    if (matchesHostname(hostname, 'aistudio.google.com')) {
      return PLATFORMS.AI_STUDIO;
    }
    if (matchesHostname(hostname, 'kimi.com') || matchesHostname(hostname, 'kimi.ai')) {
      return PLATFORMS.KIMI;
    }
    if (matchesHostname(hostname, 'deepseek.com')) {
      return PLATFORMS.DEEPSEEK;
    }

    return PLATFORMS.GENERIC;
  }

  /**
   * Get platform-specific selectors with multiple fallback strategies
   */
  getPlatformSelectors() {
    const selectors = {
      [PLATFORMS.CHATGPT]: {
        inputArea: [
          'form[data-type="unified-composer"] #prompt-textarea',
          '#prompt-textarea.ProseMirror[contenteditable="true"]',
          'textarea[id="prompt-textarea"]',
          'textarea[data-id]',
          'textarea[placeholder*="Message"]',
          '#prompt-textarea',
          'div[contenteditable="true"][role="textbox"]',
          'textarea.m-0'
        ],
        sendButton: [
          'button[data-testid="send-button"]',
          'button[data-testid="fruitjuice-send-button"]',
          'button[aria-label*="Send"]',
          'button:has(svg[data-icon="arrow-up"])',
          'form button[type="submit"]'
        ],
        messageContainer: [
          'div.user-message-bubble-color',
          'div[class*="agent-turn"]',
          'div[data-message-author-role]',
          'div[data-testid^="conversation-turn"]',
          '.group.w-full',
          'div.text-base'
        ],
        userMessage: [
          'div.user-message-bubble-color',
          'div[data-message-author-role="user"]',
          'div[data-testid="user-message"]'
        ],
        assistantMessage: [
          'div[class*="agent-turn"]',
          'div[data-message-author-role="assistant"]',
          'div[data-testid="assistant-message"]'
        ],
        conversationArea: [
          'main',
          'div[role="presentation"]',
          '.flex.flex-col.items-center'
        ]
      },

      [PLATFORMS.CLAUDE]: {
        inputArea: [
          '[data-testid="chat-input-grid-container"] .ProseMirror[contenteditable="true"]',
          '[data-testid="chat-input-grid-area"] .ProseMirror[contenteditable="true"]',
          '.ProseMirror[contenteditable="true"][data-placeholder]',
          'div[contenteditable="true"][data-placeholder]',
          'div.ProseMirror',
          'div[contenteditable="true"]',
          'fieldset div[contenteditable="true"]',
          'div[role="textbox"][contenteditable="true"]',
          'div[data-testid="composer"] div[contenteditable="true"]',
          'div[data-testid="prompt-editor"] div[contenteditable="true"]',
          'textarea[aria-label*="Message"]',
          'textarea[placeholder*="Message"]'
        ],
        sendButton: [
          'button[aria-label*="Send"]',
          'button[type="submit"]',
          'button:has(svg)',
          'button[data-testid*="composer-send"]',
          'button[aria-label*="Send message"]'
        ],
        messageContainer: [
          'div[data-testid="user-message"]',
          'div.font-claude-response',
          'div.bg-bg-300.rounded-xl',
          'div[data-is-streaming]'
        ],
        userMessage: [
          'div[data-testid="user-message"]',
          'div.bg-bg-300.rounded-xl'
        ],
        assistantMessage: [
          'div.font-claude-response',
          'div[data-is-streaming]'
        ],
        conversationArea: [
          'div.flex-1.flex.flex-col.px-4.max-w-3xl',
          'main',
          'div[data-testid*="conversation"]'
        ]
      },

      [PLATFORMS.GEMINI]: {
        inputArea: [
          '.ql-editor[contenteditable="true"][role="textbox"]',
          'div[contenteditable="true"][aria-label*="prompt" i]',
          'div[contenteditable="true"][role="textbox"]',
          'rich-textarea[placeholder*="Enter a prompt"] [contenteditable="true"]',
          'textarea[placeholder*="Enter"]',
          '.ql-editor[contenteditable="true"]'
        ],
        sendButton: [
          'button[aria-label*="Send"]',
          'button[mattooltip*="Send"]',
          'button.send-button',
          'button[type="submit"]'
        ],
        messageContainer: [
          'user-query-content',
          'message-content',
          'div.conversation-container'
        ],
        userMessage: [
          'user-query-content',
          'div.query-text',
          'user-query'
        ],
        assistantMessage: [
          'message-content',
          'div.markdown.markdown-main-panel',
          'model-response'
        ],
        conversationArea: [
          'infinite-scroller.chat-history',
          'div.conversation-container',
          'main'
        ]
      },

      [PLATFORMS.PERPLEXITY]: {
        inputArea: [
          '#ask-input[contenteditable="true"]',
          'textarea[placeholder*="Ask anything"]',
          'textarea[placeholder*="Type @"]',
          'textarea',
          'div[contenteditable="true"][role="textbox"]'
        ],
        sendButton: [
          'button[aria-label*="Send"]',
          'button[type="submit"]',
          'button:has(svg)',
          'button[data-testid*="submit"]'
        ],
        messageContainer: [
          'div[class*="message"]',
          'div[class*="Message"]'
        ],
        userMessage: [
          'div[class*="user"]',
          'div[class*="User"]'
        ],
        assistantMessage: [
          'div[class*="assistant"]',
          'div[class*="Assistant"]'
        ],
        conversationArea: [
          'main',
          '[role="main"]',
          'div[class*="conversation"]'
        ]
      },

      [PLATFORMS.AI_STUDIO]: {
        inputArea: [
          '[contenteditable="true"][aria-label*="prompt" i]',
          'textarea[placeholder*="Type something" i]',
          'textarea[placeholder*="Enter prompt"]',
          'textarea[placeholder*="Type prompt"]',
          'textarea',
          'div[contenteditable="true"]',
          'div[role="textbox"]'
        ],
        sendButton: [
          'button[aria-label*="Send"]',
          'button[aria-label*="submit"]',
          'button[type="submit"]',
          'button:has(svg)',
          'button[data-tooltip*="Send"]'
        ],
        messageContainer: [
          'div[data-role="message"]',
          'div[class*="message"]',
          'div[role="article"]'
        ],
        userMessage: [
          'div[data-role="user"]',
          'div[class*="user"]'
        ],
        assistantMessage: [
          'div[data-role="assistant"]',
          'div[class*="assistant"]',
          'div[class*="model"]'
        ],
        conversationArea: [
          'main',
          '[role="main"]',
          'div[class*="chat"]'
        ]
      },

      [PLATFORMS.GENERIC]: {
        inputArea: [
          'textarea',
          '[contenteditable="true"][role="textbox"]',
          '[contenteditable="true"]',
          '[contenteditable="plaintext-only"]',
          '[contenteditable]:not([contenteditable="false"])',
          '[data-lexical-editor="true"]',
          '[data-slate-editor="true"]',
          '[role="textbox"]',
          '[role="combobox"]',
          'input[type="text"]:not([name*="search"]):not([id*="search"])' // Exclude obvious search bars
        ],
        sendButton: [
          'button[type="submit"]',
          'button:has(svg)',
          'input[type="submit"]',
          'button[aria-label*="Send"]'
        ],
        messageContainer: [
          'div[class*="message"]',
          'div[class*="Message"]',
          'div[class*="chat-bubble"]',
          'div[class*="bubble"]',
          'li[class*="message"]'
        ],
        userMessage: [
          'div[class*="user"]',
          'div[class*="User"]',
          'div[class*="self"]',
          'div[class*="outgoing"]'
        ],
        assistantMessage: [
          '[data-message-author-role="assistant"]',
          '[data-role="assistant"]',
          'div[class*="assistant"]',
          'div[class*="bot"]',
          'div[class*="model"]',
          'div[class*="incoming"]'
        ],
        conversationArea: [
          'main',
          '[role="main"]',
          '.chat-container',
          '#chat-history',
          'body'
        ]
      }
    };

    return selectors[this.platform] || selectors[PLATFORMS.GENERIC];
  }

  /**
   * Find element using multiple selector strategies
   */
  matchesAnySelector(element, selectorArray) {
    if (!element || !Array.isArray(selectorArray)) return false;

    for (const selector of selectorArray) {
      if (!selector) continue;
      try {
        if (element.matches(selector)) {
          return true;
        }
      } catch (error) {
        // Invalid selector, ignore and continue
        continue;
      }
    }

    return false;
  }

  findActiveInputMatch(selectorArray) {
    const activeElement = document.activeElement;
    if (!activeElement) return null;

    let current = activeElement;
    while (current && current !== document.body && current !== document) {
      if (this.matchesAnySelector(current, selectorArray) && this.validateElement(current)) {
        return current;
      }
      current = current.parentElement;
    }

    return null;
  }



  /**
   * Deeply search for element across Shadow DOMs
   * This is the "Nuclear" option for finding inputs in obscure wrappers
   */
  deepQuerySelector(selector, root = document.body) {
    if (!root) return null;

    // 1. Try direct query first (fastest)
    const directMatch = root.querySelector(selector);
    if (directMatch && this.validateElement(directMatch)) return directMatch;

    // 2. TreeWalker to traverse Shadow Roots
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          if (node.shadowRoot) return NodeFilter.FILTER_ACCEPT;
          return NodeFilter.FILTER_SKIP;
        }
      }
    );

    let currentNode = walker.currentNode;
    while (currentNode) {
      if (currentNode.shadowRoot) {
        const match = this.deepQuerySelector(selector, currentNode.shadowRoot);
        if (match) return match;
      }
      currentNode = walker.nextNode();
    }

    return null;
  }

  /**
   * Find element matching ANY of the selectors, with deep search support
   */
  findElement(selectorArray) {
    if (!Array.isArray(selectorArray)) return null;

    const activeMatch = this.findActiveInputMatch(selectorArray);
    if (activeMatch) {
      return activeMatch;
    }

    let bestCandidate = null;
    let bestScore = -Infinity;
    const seen = new Set();

    // Strategy 1: Fast Global Search (Standard)
    for (let selectorIndex = 0; selectorIndex < selectorArray.length; selectorIndex += 1) {
      const selector = selectorArray[selectorIndex];
      if (!selector) continue;

      try {
        const candidates = document.querySelectorAll(selector);
        for (const element of candidates) {
          if (!element || seen.has(element)) continue;
          seen.add(element);

          if (!this.validateElement(element)) continue;

          const score = this.scoreInputCandidate(element, selectorIndex, selectorArray.length);
          if (score > bestScore) {
            bestCandidate = element;
            bestScore = score;
          }
        }
      } catch (e) { continue; }
    }

    if (bestCandidate) return bestCandidate;

    // Strategy 2: Deep Search (Nuclear) - Only for Generic platform
    // This allows us to peer into Shadow DOMs (e.g. Kimi.ai might use Shadow DOM)
    if (this.platform === PLATFORMS.GENERIC) {

      for (const selector of selectorArray) {
        if (!selector) continue;
        const deepMatch = this.deepQuerySelector(selector);
        if (deepMatch) {
          return deepMatch;
        }
      }
    }

    return null;
  }

  scoreInputCandidate(element, selectorIndex, selectorCount) {
    let score = (selectorCount - selectorIndex) * 12;
    const tagName = element.tagName?.toLowerCase();
    const role = element.getAttribute?.('role') || '';
    const contentEditable = Boolean(element.isContentEditable);
    const text = [
      element.id,
      element.className,
      element.getAttribute?.('name'),
      element.getAttribute?.('aria-label'),
      element.getAttribute?.('placeholder'),
      element.getAttribute?.('data-placeholder'),
      role
    ].filter(Boolean).join(' ').toLowerCase();

    if (tagName === 'textarea') score += 35;
    if (contentEditable) score += 30;
    if (role === 'textbox') score += 20;
    if (/prompt|message|reply|ask|chat/.test(text)) score += 45;
    if (/search|newsletter|email|password|login|sign[ -]?in/.test(text)) score -= 140;
    if (role === 'searchbox') score -= 180;
    if (element.closest('header, nav, [role="navigation"], [role="search"]')) score -= 140;

    const composer = element.closest(
      'form, fieldset, [data-testid*="composer" i], [data-testid*="chat-input" i], [data-testid*="query-box" i], [class*="composer" i], [class*="prompt-input" i], [class*="chat-input" i], [class*="query-box" i]'
    );
    if (composer) {
      score += 55;
      try {
        if (composer.querySelector(
          'button[type="submit"], [data-testid*="send" i], [aria-label*="send" i], [aria-label*="submit" i], [aria-label*="attach" i], [aria-label*="upload" i]'
        )) score += 60;
      } catch (_error) {
        // Scoring is advisory; invalid host markup should not stop discovery.
      }
    }

    const rect = element.getBoundingClientRect();
    if (rect.width >= 180) score += 15;
    if (rect.height >= 32) score += 10;
    if (rect.bottom >= window.innerHeight * 0.45) score += 10;
    return score;
  }

  /**
   * Validate that element is actually usable
   */
  validateElement(element) {
    if (!element) return false;
    if (!element.isConnected) return false;
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
      return false;
    }
    const rect = element.getBoundingClientRect();
    const hasSize = rect && (rect.width > 0 || rect.height > 0);
    const isFixed = style.position === 'fixed';
    if (!hasSize && element.offsetParent === null && !isFixed && element.tagName !== 'BODY') {
      return false;
    }
    if (element.hasAttribute('disabled')) return false;
    if (element.hasAttribute('readonly')) return false;

    return true;
  }

  /**
   * Find and cache input element
   */
  async findInputElement() {
    const freshCandidate = this.findElement(this.selectors.inputArea);

    if (freshCandidate) {
      this.inputElement = freshCandidate;
      return this.inputElement;
    }

    if (this.inputElement &&
      this.validateElement(this.inputElement) &&
      this.matchesAnySelector(this.inputElement, this.selectors.inputArea)) {
      return this.inputElement;
    }

    if (!this.missingInputWarned) {
      console.warn('[APE] Input element not found');
      this.missingInputWarned = true;
    }
    this.inputElement = null;
    return null;
  }

  /**
   * Extract current prompt text
   */
  async extractPromptText() {
    const inputElement = await this.findInputElement();
    if (!inputElement) return null;

    // Handle different input types
    if (inputElement.tagName === 'TEXTAREA' || inputElement.tagName === 'INPUT') {
      return inputElement.value;
    } else if (inputElement.isContentEditable) {
      // For contenteditable, get plain text
      return inputElement.innerText || inputElement.textContent || '';
    }

    return null;
  }

  /**
   * Safely inject enhanced prompt
   */
  async injectEnhancedPrompt(enhancedText) {
    const inputElement = await this.findInputElement();
    if (!inputElement) return false;

    try {
      const setNativeValue = (element, value) => {
        const { set: valueSetter } = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value') || {};
        if (valueSetter) {
          valueSetter.call(element, value);
        } else {
          element.value = value;
        }
      };

      // Clear existing content first
      if (inputElement.tagName === 'TEXTAREA' || inputElement.tagName === 'INPUT') {
        // For textarea/input
        setNativeValue(inputElement, '');
        inputElement.focus();

        // Simulate typing for better compatibility
        setNativeValue(inputElement, enhancedText);

        // Trigger input events
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        inputElement.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (inputElement.isContentEditable) {
        const focusTarget = inputElement;

        // Focus the editor without scrolling the page if possible
        try {
          focusTarget.focus({ preventScroll: true });
        } catch (focusError) {
          focusTarget.focus();
        }

        const ensureSelection = () => {
          const selection = window.getSelection();
          if (!selection) return;

          const range = document.createRange();
          range.selectNodeContents(focusTarget);
          selection.removeAllRanges();
          selection.addRange(range);
        };

        const dispatchInputEvent = (target, type, eventOptions = {}) => {
          const init = {
            bubbles: true,
            cancelable: type === 'beforeinput',
            composed: true,
            ...eventOptions
          };

          if (typeof InputEvent === 'function') {
            try {
              const event = new InputEvent(type, init);
              return target.dispatchEvent(event);
            } catch (error) {
              const fallback = new Event(type, {
                bubbles: true,
                cancelable: init.cancelable,
                composed: true
              });
              return target.dispatchEvent(fallback);
            }
          }

          const fallback = new Event(type, {
            bubbles: true,
            cancelable: init.cancelable,
            composed: true
          });
          return target.dispatchEvent(fallback);
        };

        const execCommand = (command, value = null) => {
          try {
            return document.execCommand(command, false, value);
          } catch (error) {
            return false;
          }
        };

        // Select the entire editor contents
        ensureSelection();
        if (!execCommand('selectAll')) {
          ensureSelection();
        }

        // Notify the editor that content will be replaced
        dispatchInputEvent(focusTarget, 'beforeinput', {
          inputType: 'deleteContentBackward',
          data: '',
          dataTransfer: null
        });

        // Remove existing content
        if (!execCommand('delete')) {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            selection.deleteFromDocument();
          } else {
            focusTarget.replaceChildren();
          }
        }

        // Ensure selection is ready for insertion
        ensureSelection();

        // Dispatch beforeinput for insertion
        dispatchInputEvent(focusTarget, 'beforeinput', {
          inputType: 'insertFromPaste',
          data: enhancedText,
          dataTransfer: null
        });

        // Try to insert via execCommand so editors observe the change
        let inserted = execCommand('insertText', enhancedText);

        if (!inserted) {
          focusTarget.replaceChildren();
          const lines = enhancedText.split('\n');
          const fragment = document.createDocumentFragment();

          lines.forEach((line, index) => {
            fragment.appendChild(document.createTextNode(line));
            if (index < lines.length - 1) {
              fragment.appendChild(document.createElement('br'));
            }
          });

          focusTarget.appendChild(fragment);
        }

        // Fire standard input/change notifications
        dispatchInputEvent(focusTarget, 'input', {
          inputType: 'insertFromPaste',
          data: enhancedText,
          dataTransfer: null
        });

        focusTarget.dispatchEvent(new Event('change', { bubbles: true }));

        // Place the caret at the end of the text
        const selection = window.getSelection();
        if (selection) {
          const range = document.createRange();
          range.selectNodeContents(focusTarget);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }

      return true;
    } catch (error) {
      console.error('[APE] Failed to inject prompt:', error);
      return false;
    }
  }

  /**
   * Extract all conversation messages
   */
  extractMessages(limit = Number.POSITIVE_INFINITY) {
    const messages = [];
    const maximumMessages = Number.isFinite(Number(limit))
      ? Math.max(1, Math.floor(Number(limit)))
      : Number.POSITIVE_INFINITY;
    const rejectionCounts = {
      outsideConversation: 0,
      ui: 0,
      hidden: 0,
      streaming: 0,
      composer: 0,
      roleUnknown: 0,
      contentInvalid: 0,
      duplicateTurn: 0
    };

    // First, try to scope to conversation area to avoid sidebar/UI elements
    const conversationContainer = this.findElement(this.selectors.conversationArea);
    let searchRoot = conversationContainer || document.body;

    const selectorString = this.selectors.messageContainer.join(',');
    let messageElements = searchRoot.querySelectorAll(selectorString);

    // Fallback: if no messages found in scoped area, try document.body
    if (messageElements.length === 0 && searchRoot !== document.body) {
      searchRoot = document.body;
      messageElements = document.body.querySelectorAll(selectorString);
    }

    // Start with the newest nodes so long or virtualized chats do not require
    // parsing every historical turn. Reverse once to restore chronology.
    for (let index = messageElements.length - 1;
      index >= 0 && messages.length < maximumMessages;
      index -= 1) {
      const element = messageElements[index];
      // Skip if element is not in conversation area (e.g., sidebar)
      if (!this.isInConversationArea(element)) {
        rejectionCounts.outsideConversation += 1;
        continue;
      }

      // Skip elements that are clearly UI/navigation (sidebars, headers, etc.)
      if (this.isUIElement(element)) {
        rejectionCounts.ui += 1;
        continue;
      }
      if (!this.isMessageVisible(element)) {
        rejectionCounts.hidden += 1;
        continue;
      }
      if (this.isStreamingMessage(element)) {
        rejectionCounts.streaming += 1;
        continue;
      }
      if (this.isComposerElement(element)) {
        rejectionCounts.composer += 1;
        continue;
      }

      const role = this.getMessageRole(element);
      if (!role) {
        rejectionCounts.roleUnknown += 1;
        continue;
      }

      const visibleText = this.extractVisibleMessageText(element);
      const content = this.cleanMessageContent(visibleText);

      // Validate message quality
      if (!content || !this.isValidMessage(content)) {
        rejectionCounts.contentInvalid += 1;
        continue;
      }

      // A single host turn may match several nested selectors. Traverse from
      // newest to oldest and retain the first, narrowest matching node so the
      // limit applies to turns rather than wrapper elements.
      if (messages.some((message) => (
        message.role === role && this.elementsOverlap(message.element, element)
      ))) {
        rejectionCounts.duplicateTurn += 1;
        continue;
      }

      messages.push({
        role,
        content,
        element,
        timestamp: this.extractTimestamp(element)
      });
    }

    const chronologicalMessages = messages.reverse();
    this.lastMessageExtractionDiagnostics = {
      platform: this.platform,
      candidateCount: messageElements.length,
      canonicalTurnCount: messages.length,
      returnedMessageCount: chronologicalMessages.length,
      rejectionCounts
    };
    return chronologicalMessages;
  }

  elementsOverlap(first, second) {
    return first === second ||
      first?.contains?.(second) ||
      second?.contains?.(first);
  }

  getMessageExtractionDiagnostics() {
    const diagnostics = this.lastMessageExtractionDiagnostics;
    if (!diagnostics) return null;

    return {
      ...diagnostics,
      rejectionCounts: { ...diagnostics.rejectionCounts }
    };
  }

  /**
   * Check if element is in the main conversation area (not sidebar)
   */
  isInConversationArea(element) {
    // Check if element is in sidebar or navigation
    let current = element;
    while (current && current !== document.body) {
      const classList = this.getElementClassName(current);
      const role = current.getAttribute('role') || '';

      // Common sidebar/navigation indicators
      if (
        classList.includes('sidebar') ||
        classList.includes('Sidebar') ||
        classList.includes('navigation') ||
        classList.includes('Navigation') ||
        // classList.includes('history') || // Removed: Gemini uses 'chat-history' for the MAIN container
        // classList.includes('History') ||
        role === 'navigation' ||
        role === 'complementary' ||
        current.tagName === 'NAV' ||
        current.tagName === 'ASIDE'
      ) {
        if (this.debug) console.log('[APE DOM Debug] Rejected by sidebar check:', current.tagName, classList);
        return false;
      }

      current = current.parentElement;
    }

    return true;
  }

  /**
   * Check if element is a UI component (not actual message)
   */
  isUIElement(element) {
    const classList = this.getElementClassName(element);

    // Skip elements that are buttons, links, or headers
    if (
      element.tagName === 'BUTTON' ||
      element.tagName === 'A' ||
      element.tagName === 'HEADER' ||
      element.tagName === 'FOOTER' ||
      element.tagName === 'NAV'
    ) {
      return true;
    }

    // Skip common UI patterns
    const uiPatterns = [
      'toolbar',
      'menu',
      'dropdown',
      'tooltip',
      'badge',
      'chip',
      'tab',
      'header',
      'footer'
    ];

    return uiPatterns.some(pattern =>
      classList.toLowerCase().includes(pattern)
    );
  }

  getElementClassName(element) {
    return typeof element?.className === 'string' ? element.className : '';
  }

  isMessageVisible(element) {
    if (!element || element.isConnected === false || element.hidden) return false;
    if (element.hasAttribute?.('hidden')) return false;
    if (element.getAttribute?.('aria-hidden')?.toLowerCase() === 'true') return false;

    try {
      const style = window.getComputedStyle?.(element);
      if (style && (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        parseFloat(style.opacity) === 0
      )) return false;
    } catch (_error) {
      // Host elements can disappear during extraction; structural checks above
      // still provide a safe fallback.
    }

    return true;
  }

  isStreamingMessage(element) {
    const isActiveMarker = (candidate) => {
      if (!candidate) return false;

      if (candidate.hasAttribute?.('data-is-streaming')) {
        const value = String(candidate.getAttribute?.('data-is-streaming') ?? '').toLowerCase();
        if (!['false', '0', 'complete', 'done'].includes(value)) return true;
      }
      if (candidate.hasAttribute?.('aria-busy')) {
        const value = String(candidate.getAttribute?.('aria-busy') ?? '').toLowerCase();
        if (value !== 'false') return true;
      }

      const state = String(
        candidate.getAttribute?.('data-state') || candidate.getAttribute?.('data-status') || ''
      ).toLowerCase();
      if (state === 'streaming' || state === 'generating') return true;

      const classes = this.getElementClassName(candidate).toLowerCase().split(/\s+/);
      return classes.some(name => ['streaming', 'is-streaming', 'result-streaming'].includes(name));
    };

    let current = element;
    while (current) {
      if (isActiveMarker(current)) return true;
      if (current === document.body) break;
      current = current.parentElement;
    }

    try {
      const descendants = element.querySelectorAll?.(
        '[data-is-streaming], [aria-busy], [data-state], [data-status], .streaming, .is-streaming, .result-streaming'
      ) || [];
      return [...descendants].some(isActiveMarker);
    } catch (_error) {
      return false;
    }
  }

  isComposerElement(element) {
    const isEditable = (candidate) => {
      if (!candidate) return false;
      const tagName = candidate.tagName?.toLowerCase();
      const role = candidate.getAttribute?.('role')?.toLowerCase();
      const contentEditable = candidate.getAttribute?.('contenteditable');
      return candidate.isContentEditable ||
        contentEditable === 'true' ||
        contentEditable === 'plaintext-only' ||
        tagName === 'textarea' ||
        tagName === 'input' ||
        role === 'textbox' ||
        role === 'combobox';
    };

    if (isEditable(element)) return true;

    const activeElement = document.activeElement;
    return isEditable(activeElement) && (
      element === activeElement || element.contains?.(activeElement)
    );
  }

  extractVisibleMessageText(element) {
    if (!element) return '';

    // Browser innerText already excludes CSS-hidden descendants. Remove text
    // contributed by controls and accessibility-hidden UI inside a message so
    // it is never mistaken for conversation content.
    let text = typeof element.innerText === 'string'
      ? element.innerText
      : element.textContent || '';
    if (typeof element.querySelectorAll !== 'function') return text;

    const excludedSelector = [
      'button',
      'input',
      'textarea',
      'select',
      'nav',
      'aside',
      'header',
      'footer',
      '[role="button"]',
      '[role="menu"]',
      '[role="toolbar"]',
      '[aria-hidden="true"]',
      '[hidden]',
      '[contenteditable="true"]',
      '[contenteditable="plaintext-only"]'
    ].join(',');

    try {
      const excludedElements = element.querySelectorAll(excludedSelector);
      excludedElements.forEach((excluded) => {
        const excludedText = typeof excluded.innerText === 'string'
          ? excluded.innerText.trim()
          : String(excluded.textContent || '').trim();
        if (excludedText) {
          const index = text.lastIndexOf(excludedText);
          if (index >= 0) {
            text = `${text.slice(0, index)} ${text.slice(index + excludedText.length)}`;
          }
        }
      });
    } catch (_error) {
      // The host may detach a message mid-read; retain the already-bounded
      // visible text rather than failing the entire enhancement.
    }

    return text;
  }

  /**
   * Validate if content is a real message
   */
  isValidMessage(content) {
    if (!String(content || '').trim()) return false;

    // Exclude common UI text patterns
    const excludePatterns = [
      /^(new chat|new thread|delete|edit|copy|share|export)$/i,
      /^(today|yesterday|last week|this month)$/i,
      /^\d+\s*(min|hour|day|week|month)s?\s*ago$/i,
      /^[0-9/:-]+$/,  // Pure dates/times
      /^[\d\s]+$/       // Pure numbers
    ];

    return !excludePatterns.some(pattern => pattern.test(content));
  }

  /**
   * Resolve an explicit message role. Unknown message-shaped nodes are ignored
   * instead of being treated as assistant content.
   */
  getMessageRole(element) {
    const matchesAny = (selectors = []) => selectors.some((selector) => {
      try {
        return element.matches(selector);
      } catch (_error) {
        return false;
      }
    });

    if (matchesAny(this.selectors.userMessage)) return 'user';
    if (matchesAny(this.selectors.assistantMessage)) return 'assistant';

    // Some hosts expose one turn wrapper to the message container selector
    // while placing the role attribute on a nested element. Accept that only
    // when all discovered role evidence agrees; never guess an unknown role.
    const nestedRoles = new Set();
    const hasNestedMatch = (selectors = []) => selectors.some((selector) => {
      try {
        return Boolean(element.querySelector?.(selector)) ||
          (element.querySelectorAll?.(selector)?.length || 0) > 0;
      } catch (_error) {
        return false;
      }
    });
    if (hasNestedMatch(this.selectors.userMessage)) nestedRoles.add('user');
    if (hasNestedMatch(this.selectors.assistantMessage)) nestedRoles.add('assistant');
    try {
      const nestedRoleMarkers = element.querySelectorAll?.(
        '[data-message-author-role], [data-role], [data-author]'
      ) || [];
      for (const marker of nestedRoleMarkers) {
        const value = String(
          marker.getAttribute?.('data-message-author-role') ||
          marker.getAttribute?.('data-role') ||
          marker.getAttribute?.('data-author') || ''
        ).toLowerCase();
        if (['user', 'human', 'outgoing', 'self'].includes(value)) nestedRoles.add('user');
        if (['assistant', 'bot', 'model', 'incoming'].includes(value)) nestedRoles.add('assistant');
      }
    } catch (_error) {
      // A host can detach a turn while it is being inspected. The direct role
      // checks above remain valid and unknown wrappers stay excluded.
    }
    if (nestedRoles.size === 1) return [...nestedRoles][0];
    if (nestedRoles.size > 1) return null;

    const roleHints = [
      element.getAttribute?.('data-message-author-role'),
      element.getAttribute?.('data-role'),
      element.getAttribute?.('data-author'),
      this.getElementClassName(element)
    ].filter(Boolean).join(' ').toLowerCase();

    if (/(^|[\s_-])(user|human|outgoing|self)(?=$|[\s_-])/.test(roleHints)) {
      return 'user';
    }
    if (/(^|[\s_-])(assistant|bot|model|incoming)(?=$|[\s_-])/.test(roleHints)) {
      return 'assistant';
    }

    return null;
  }

  isUserMessage(element) {
    return this.getMessageRole(element) === 'user';
  }

  /**
   * Clean message content
   */
  cleanMessageContent(content) {
    return content
      .replace(/\s+/g, ' ')
      .replace(/Copy code/gi, '')
      .replace(/^\d+\s*\/\s*\d+/, '')
      .trim();
  }

  /**
   * Extract timestamp from message (if available)
   */
  extractTimestamp(element) {
    const timeElement = element.querySelector('time');
    if (timeElement) {
      const datetime = timeElement.getAttribute('datetime');
      if (datetime) {
        return new Date(datetime).getTime();
      }
    }
    return Date.now();
  }

  /**
   * Observe DOM changes for input area
   */
  observeInputArea(callback) {
    const throttledCallback = throttle(callback, 200);

    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' ||
          mutation.type === 'characterData' ||
          mutation.type === 'attributes') {
          throttledCallback(mutation);
        }
      }
    });

    // Find conversation area
    const targetNode = this.findElement(this.selectors.conversationArea);
    if (!targetNode) {
      console.warn('[APE] Cannot observe: conversation area not found');
      return;
    }

    this.observer.observe(targetNode, {
      childList: true,
      subtree: false, // Only immediate children for performance
      characterData: false,
      attributes: true,
      attributeFilter: ['contenteditable', 'disabled', 'aria-label']
    });
  }

  /**
   * Disconnect observer
   */
  disconnect() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  /**
   * Check if send button is enabled
   */
  async isSendButtonEnabled() {
    if (!this.sendButton || !this.validateElement(this.sendButton)) {
      this.sendButton = this.findElement(this.selectors.sendButton);
    }

    if (!this.sendButton) return false;

    return !this.sendButton.disabled &&
      !this.sendButton.hasAttribute('disabled') &&
      this.sendButton.offsetParent !== null;
  }
}

export default ResilientDOMObserver;
