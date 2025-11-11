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
          'div[data-message-author-role]',
          'div[data-testid^="conversation-turn"]',
          '.group.w-full',
          'div.text-base'
        ],
        userMessage: [
          'div[data-message-author-role="user"]',
          'div[data-testid="user-message"]'
        ],
        assistantMessage: [
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
          'div[data-is-user]',
          'div.font-user-message',
          'div.font-claude-message',
          'div[data-testid*="message"]'
        ],
        userMessage: [
          'div[data-is-user="true"]',
          'div.font-user-message',
          'div[data-testid*="message-user"]'
        ],
        assistantMessage: [
          'div[data-is-user="false"]',
          'div.font-claude-message',
          'div[data-testid*="message-system"]',
          'div[data-testid*="message-assistant"]'
        ],
        conversationArea: [
          'main',
          'div[class*="ConversationContainer"]',
          'div[data-testid*="conversation"]',
          'div[data-testid*="chat-root"]'
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
          'message-content',
          'model-response',
          'user-query',
          'div[class*="message"]'
        ],
        userMessage: [
          'user-query',
          'div[class*="user"]'
        ],
        assistantMessage: [
          'model-response',
          'div[class*="model"]',
          'div[class*="assistant"]'
        ],
        conversationArea: [
          'main',
          'div[class*="conversation"]',
          'mat-sidenav-content'
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

      [PLATFORMS.GENERIC]: {
        inputArea: [
          'textarea',
          '[contenteditable="true"]',
          'input[type="text"]'
        ],
        sendButton: [
          'button[type="submit"]',
          'button:has(svg)',
          'input[type="submit"]'
        ],
        messageContainer: [
          'div[class*="message"]',
          'div[class*="Message"]'
        ],
        userMessage: [],
        assistantMessage: [],
        conversationArea: [
          'main',
          '[role="main"]',
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

    console.warn('[APE] Input element not found');
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
            focusTarget.innerHTML = '';
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
          focusTarget.innerHTML = '';
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
    const messageElements = document.querySelectorAll(
      this.selectors.messageContainer.join(',')
    );

    messageElements.forEach((element) => {
      const isUser = this.isUserMessage(element);
      const content = this.cleanMessageContent(element.textContent || '');

      if (content) {
        messages.push({
          role: isUser ? 'user' : 'assistant',
          content: content,
          element: element,
          timestamp: this.extractTimestamp(element)
        });
      }
    });

    return messages;
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
