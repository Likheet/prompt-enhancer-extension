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
    this.inputElementCache = new Map(); // Cache for performance
    this.lastInputCheck = 0;
    this.inputCheckThrottle = 500; // ms

    // Set platform data attribute on body for CSS targeting
    this.setPlatformDataAttribute();
  }

  /**
   * Set platform data attribute for CSS targeting
   */
  setPlatformDataAttribute() {
    if (document.body) {
      document.body.setAttribute('data-platform', this.platform);
    } else {
      // Wait for body to be available
      setTimeout(() => this.setPlatformDataAttribute(), 100);
    }
  }

  /**
   * Detect current platform
   */
  detectPlatform() {
    const hostname = window.location.hostname;

    if (hostname.includes('chat.openai.com') || hostname.includes('chatgpt.com')) {
      return PLATFORMS.CHATGPT;
    }
    if (hostname.includes('claude.ai')) {
      return PLATFORMS.CLAUDE;
    }
    if (hostname.includes('gemini.google.com')) {
      return PLATFORMS.GEMINI;
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
          'fieldset div[contenteditable="true"]'
        ],
        sendButton: [
          'button[aria-label*="Send"]',
          'button[type="submit"]',
          'button:has(svg)'
        ],
        messageContainer: [
          'div[data-is-user]',
          'div.font-user-message',
          'div.font-claude-message'
        ],
        userMessage: [
          'div[data-is-user="true"]',
          'div.font-user-message'
        ],
        assistantMessage: [
          'div[data-is-user="false"]',
          'div.font-claude-message'
        ],
        conversationArea: [
          'main',
          'div[class*="ConversationContainer"]'
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
  findElement(selectorArray) {
    for (const selector of selectorArray) {
      try {
        const element = document.querySelector(selector);
        if (element && this.validateElement(element)) {
          return element;
        }
      } catch (e) {
        // Invalid selector, continue to next
        continue;
      }
    }
    return null;
  }

  /**
   * Validate that element is actually usable
   */
  validateElement(element) {
    if (!element) return false;
    if (!element.isConnected) return false;

    // Allow hidden elements in some cases (they may become visible)
    // But check if completely removed from DOM
    const rect = element.getBoundingClientRect();
    const isCompletelyHidden = rect.width === 0 && rect.height === 0 &&
                                element.offsetParent === null &&
                                element.tagName !== 'BODY';

    if (isCompletelyHidden) return false;
    if (element.hasAttribute('disabled')) return false;
    if (element.hasAttribute('readonly')) return false;

    return true;
  }

  /**
   * Find and cache input element with enhanced tracking
   */
  async findInputElement(force = false) {
    const now = Date.now();

    // Use cached element if valid and not forcing refresh
    if (!force && this.inputElement && this.validateElement(this.inputElement)) {
      // Throttle validation checks for performance
      if (now - this.lastInputCheck < this.inputCheckThrottle) {
        return this.inputElement;
      }
      this.lastInputCheck = now;
      return this.inputElement;
    }

    // Clear cache
    this.inputElement = null;
    this.lastInputCheck = now;

    // Try to find element using platform-specific selectors
    this.inputElement = this.findElement(this.selectors.inputArea);

    if (!this.inputElement) {
      // Wait for it to appear
      try {
        console.log('[APE DOMObserver] Waiting for input element to appear...');
        this.inputElement = await waitForElement(
          this.selectors.inputArea[0],
          3000
        );
      } catch (e) {
        console.warn('[APE DOMObserver] Input element not found after waiting');
        return null;
      }
    }

    if (this.inputElement) {
      console.log('[APE DOMObserver] Input element found:', {
        tag: this.inputElement.tagName,
        type: this.inputElement.type,
        contentEditable: this.inputElement.contentEditable
      });
    }

    return this.inputElement;
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
        // For contenteditable
        inputElement.focus();

        // Clear content
        inputElement.innerHTML = '';

        // Split text by newlines and create proper paragraph/br structure
        const lines = enhancedText.split('\n');
        const fragment = document.createDocumentFragment();
        
        lines.forEach((line, index) => {
          // Create text node for the line
          const textNode = document.createTextNode(line);
          fragment.appendChild(textNode);
          
          // Add line break after each line except the last
          if (index < lines.length - 1) {
            fragment.appendChild(document.createElement('br'));
          }
        });
        
        inputElement.appendChild(fragment);

        // Trigger input event
        inputElement.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: enhancedText
        }));

        // Move cursor to end
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(inputElement);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
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
   * Get input element's container for positioning
   */
  getInputContainer(inputElement) {
    if (!inputElement) return null;

    // Platform-specific container detection
    const containerSelectors = {
      [PLATFORMS.CHATGPT]: ['form.w-full', 'div.relative.flex.h-full'],
      [PLATFORMS.CLAUDE]: ['fieldset', 'div[class*="InputContainer"]'],
      [PLATFORMS.GEMINI]: ['div.input-area-container', 'mat-form-field'],
      [PLATFORMS.GENERIC]: ['form', 'div.input-container']
    };

    const selectors = containerSelectors[this.platform] || containerSelectors[PLATFORMS.GENERIC];

    let parent = inputElement.parentElement;
    let depth = 0;
    const maxDepth = 10;

    while (parent && parent !== document.body && depth < maxDepth) {
      for (const selector of selectors) {
        try {
          if (parent.matches(selector)) {
            return parent;
          }
        } catch (e) {
          // Invalid selector
        }
      }

      // Generic container detection
      if (parent.tagName === 'FORM' || parent.tagName === 'FIELDSET') {
        return parent;
      }

      parent = parent.parentElement;
      depth++;
    }

    return inputElement.parentElement;
  }

  /**
   * Check if input is in centered state (new conversation)
   */
  isInputCentered(inputElement, containerElement) {
    if (!inputElement || !containerElement) return false;

    const rect = containerElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const centerY = rect.top + rect.height / 2;

    // Input is considered centered if it's in the middle portion of viewport
    return centerY > viewportHeight * 0.3 && centerY < viewportHeight * 0.7;
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
