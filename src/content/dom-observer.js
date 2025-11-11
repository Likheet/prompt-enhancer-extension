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
    if (this.inputElement && this.validateElement(this.inputElement)) {
      return this.inputElement;
    }

    this.inputElement = this.findElement(this.selectors.inputArea);

    if (!this.inputElement) {
      for (const selector of this.selectors.inputArea) {
        try {
          const candidate = await waitForElement(selector, 3000);
          if (candidate && this.validateElement(candidate)) {
            this.inputElement = candidate;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!this.inputElement) {
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
