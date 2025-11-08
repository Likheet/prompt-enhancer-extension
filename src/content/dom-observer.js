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
    const hostname = window.location.hostname;

    if (hostname.includes('chat.openai.com') || hostname.includes('chatgpt.com')) {
      return PLATFORMS.CHATGPT;
    }
    if (hostname.includes('claude.ai')) {
      return PLATFORMS.CLAUDE;
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
    if (element.offsetParent === null && element.tagName !== 'BODY') return false;
    if (element.hasAttribute('disabled')) return false;
    if (element.hasAttribute('readonly')) return false;

    return true;
  }

  /**
   * Find and cache input element
   */
  async findInputElement() {
    if (this.inputElement && this.validateElement(this.inputElement)) {
      return this.inputElement;
    }

    this.inputElement = this.findElement(this.selectors.inputArea);

    if (!this.inputElement) {
      // Wait for it to appear
      try {
        this.inputElement = await waitForElement(
          this.selectors.inputArea[0],
          3000
        );
      } catch (e) {
        console.warn('[APE] Input element not found');
        return null;
      }
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
      // Clear existing content first
      if (inputElement.tagName === 'TEXTAREA' || inputElement.tagName === 'INPUT') {
        // For textarea/input
        inputElement.value = '';
        inputElement.focus();

        // Simulate typing for better compatibility
        inputElement.value = enhancedText;

        // Trigger input events
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        inputElement.dispatchEvent(new Event('change', { bubbles: true }));

        // Platform-specific events
        if (this.platform === PLATFORMS.CHATGPT) {
          inputElement.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            bubbles: true
          }));
        }
      } else if (inputElement.contentEditable === 'true') {
        // For contenteditable
        inputElement.focus();

        // Clear content
        inputElement.textContent = '';

        // Insert new content as plain text (prevents XSS)
        const textNode = document.createTextNode(enhancedText);
        inputElement.appendChild(textNode);

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
