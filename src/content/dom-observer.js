/**
 * Resilient DOM Observer
 * Platform-aware DOM manipulation with fallback strategies
 */

import { PLATFORMS } from '../shared/constants.js';
import { throttle, waitForElement } from '../shared/utils.js';

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
    console.log('[APE] Detecting platform for hostname:', hostname);

    if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) {
      console.log('[APE] Platform detected: ChatGPT');
      return PLATFORMS.CHATGPT;
    }
    if (hostname.includes('claude.ai')) {
      console.log('[APE] Platform detected: Claude');
      return PLATFORMS.CLAUDE;
    }
    if (hostname.includes('gemini.google.com')) {
      console.log('[APE] Platform detected: Gemini');
      return PLATFORMS.GEMINI;
    }
    if (hostname.includes('perplexity.ai')) {
      console.log('[APE] Platform detected: Perplexity');
      return PLATFORMS.PERPLEXITY;
    }
    if (hostname.includes('aistudio.google.com')) {
      console.log('[APE] Platform detected: AI Studio');
      return PLATFORMS.AI_STUDIO;
    }

    console.log('[APE] Platform detected: Generic');
    return PLATFORMS.GENERIC;
  }

  /**
   * Get platform-specific selectors with multiple fallback strategies
   */
  getPlatformSelectors() {
    const selectors = {
      [PLATFORMS.CHATGPT]: {
        inputArea: [
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
          'rich-textarea[placeholder*="Enter a prompt"]',
          'rich-textarea',
          'div[contenteditable="true"][role="textbox"]',
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
          'div[contenteditable="true"]',
          'textarea[placeholder*="Enter prompt"]',
          'textarea[placeholder*="Type prompt"]',
          'textarea',
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
          '[contenteditable="true"]',
          'input[type="text"]',
          '[role="textbox"]'
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
          'div[class*="assistant"]',
          'div[class*="bot"]',
          'div[class*="ai"]',
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

  findElement(selectorArray) {
    if (!Array.isArray(selectorArray)) return null;

    const activeMatch = this.findActiveInputMatch(selectorArray);
    if (activeMatch) {
      return activeMatch;
    }

    let preferredCandidate = null;
    let lastValidCandidate = null;
    const seen = new Set();

    for (const selector of selectorArray) {
      if (!selector) continue;

      let nodeList;
      try {
        nodeList = document.querySelectorAll(selector);
      } catch (error) {
        // Invalid selector, skip to next
        continue;
      }

      nodeList.forEach((element) => {
        if (!element || seen.has(element)) return;
        seen.add(element);

        if (!this.validateElement(element)) return;

        const activeElement = document.activeElement;
        if (activeElement && (element === activeElement || element.contains(activeElement))) {
          preferredCandidate = element;
        }

        lastValidCandidate = element;
      });
    }

    return preferredCandidate || lastValidCandidate;
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

    for (const selector of this.selectors.inputArea) {
      try {
        const candidate = await waitForElement(selector, 3000);
        if (!candidate) continue;

        const resolved = this.findElement(this.selectors.inputArea) || candidate;
        if (resolved && this.validateElement(resolved)) {
          this.inputElement = resolved;
          return this.inputElement;
        }
      } catch (error) {
        continue;
      }
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
    } else if (inputElement.contentEditable === 'true') {
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
      } else if (inputElement.contentEditable === 'true') {
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
  extractMessages() {
    const messages = [];

    // First, try to scope to conversation area to avoid sidebar/UI elements
    const conversationContainer = this.findElement(this.selectors.conversationArea);
    let searchRoot = conversationContainer || document.body;

    const selectorString = this.selectors.messageContainer.join(',');
    console.log('[APE DOM Debug]', {
      platform: this.platform,
      selectorString,
      conversationFound: !!conversationContainer,
      searchRootTag: searchRoot?.tagName
    });

    let messageElements = searchRoot.querySelectorAll(selectorString);
    console.log('[APE DOM Debug] Messages found:', messageElements.length);

    // Fallback: if no messages found in scoped area, try document.body
    if (messageElements.length === 0 && searchRoot !== document.body) {
      searchRoot = document.body;
      messageElements = document.body.querySelectorAll(selectorString);
      console.log('[APE DOM Debug] Fallback messages found:', messageElements.length);
    }

    messageElements.forEach((element, idx) => {
      // Skip if element is not in conversation area (e.g., sidebar)
      if (!this.isInConversationArea(element)) {
        console.log(`[APE DOM Debug] Message ${idx} REJECTED: not in conversation area`, element.tagName);
        return;
      }

      // Skip elements that are clearly UI/navigation (sidebars, headers, etc.)
      if (this.isUIElement(element)) {
        console.log(`[APE DOM Debug] Message ${idx} REJECTED: isUIElement`, element.tagName);
        return;
      }

      const isUser = this.isUserMessage(element);
      const content = this.cleanMessageContent(element.textContent || '');

      // Validate message quality
      if (content && this.isValidMessage(content)) {
        console.log(`[APE DOM Debug] Message ${idx} ACCEPTED:`, { tag: element.tagName, role: isUser ? 'user' : 'assistant', len: content.length });
        messages.push({
          role: isUser ? 'user' : 'assistant',
          content: content,
          element: element,
          timestamp: this.extractTimestamp(element)
        });
      } else {
        console.log(`[APE DOM Debug] Message ${idx} REJECTED: invalid content`, { tag: element.tagName, contentLen: content?.length });
      }
    });

    console.log('[APE DOM Debug] Final messages array length:', messages.length);
    return messages;
  }

  /**
   * Check if element is in the main conversation area (not sidebar)
   */
  isInConversationArea(element) {
    // Check if element is in sidebar or navigation
    let current = element;
    while (current && current !== document.body) {
      const classList = current.className || '';
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
    const classList = element.className || '';
    const text = (element.textContent || '').trim();

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

    // Skip elements with very short text (likely UI labels)
    if (text.length < 10) {
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

  /**
   * Validate if content is a real message
   */
  isValidMessage(content) {
    // Must have minimum length
    if (content.length < 3) { // Lowered from 10 to 3 for short queries
      if (this.debug) console.log('[APE DOM Debug] Failed length check:', content.length);
      return false;
    }

    // Must have some actual words (not just symbols/numbers)
    const wordCount = content.split(/\s+/).filter(word => /[a-zA-Z]{2,}/.test(word)).length;
    if (wordCount < 1) { // Lowered from 2 to 1 (e.g. "Why?")
      if (this.debug) console.log('[APE DOM Debug] Failed word count check:', wordCount);
      return false;
    }

    // Exclude common UI text patterns
    const excludePatterns = [
      /^(new chat|new thread|delete|edit|copy|share|export)$/i,
      /^(today|yesterday|last week|this month)$/i,
      /^\d+\s*(min|hour|day|week|month)s?\s*ago$/i,
      /^[0-9\/\-:]+$/,  // Pure dates/times
      /^[\d\s]+$/       // Pure numbers
    ];

    const isExcluded = excludePatterns.some(pattern => pattern.test(content));
    if (isExcluded && this.debug) console.log('[APE DOM Debug] Failed exclude pattern');
    return !isExcluded;
  }

  /**
   * Determine if message is from user
   */
  isUserMessage(element) {
    // Try platform-specific selectors
    for (const selector of this.selectors.userMessage) {
      if (element.matches(selector)) return true;
    }

    // Fallback heuristics
    const classList = element.className || '';
    const dataAttrs = Array.from(element.attributes || [])
      .map(attr => attr.name + attr.value)
      .join(' ');

    return (
      classList.includes('user') ||
      classList.includes('human') ||
      dataAttrs.includes('user') ||
      dataAttrs.includes('human')
    );
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
