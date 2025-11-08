/**
 * Inline UI Component
 * Provides inline button beside chatbox for prompt enhancement
 */

import { UI_CONSTANTS, SUCCESS_MESSAGES, ERROR_MESSAGES } from '../shared/constants.js';
import { copyToClipboard, generateId } from '../shared/utils.js';
import browserCompat from '../shared/browser-compat.js';

class InlineUI {
  constructor(enhancer, extractor, domObserver, settings) {
    this.enhancer = enhancer;
    this.extractor = extractor;
    this.domObserver = domObserver;
    this.settings = settings;

    this.currentButton = null;
    this.enhancedPrompt = null;
    this.isProcessing = false;
    this.buttonId = `ape-inline-btn-${generateId()}`;

    this.init();
  }

  /**
   * Initialize the inline UI
   */
  async init() {
    console.log('[APE InlineUI] Initializing...');

    // Wait for page to stabilize
    await this.waitForStability();

    // Create and attach button
    this.attachButtonToChatbox();

    // Monitor for chatbox changes (SPA navigation, etc.)
    this.observeChatbox();

    console.log('[APE InlineUI] Initialized');
  }

  /**
   * Wait for page to be stable before injecting
   */
  async waitForStability() {
    return new Promise((resolve) => {
      setTimeout(resolve, 1500);
    });
  }

  /**
   * Monitor for chatbox appearance/disappearance
   */
  observeChatbox() {
    const observer = new MutationObserver(() => {
      // Check if button is still attached and valid
      if (!this.isButtonAttached()) {
        console.log('[APE InlineUI] Button detached, reattaching...');
        this.attachButtonToChatbox();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Check if button is still attached to DOM
   */
  isButtonAttached() {
    if (!this.currentButton) return false;
    return document.body.contains(this.currentButton);
  }

  /**
   * Attach button to chatbox
   */
  async attachButtonToChatbox() {
    // Prevent multiple buttons
    if (this.currentButton && this.isButtonAttached()) {
      return;
    }

    const inputArea = await this.domObserver.findInputElement();
    if (!inputArea) {
      console.warn('[APE InlineUI] Input area not found, will retry...');
      setTimeout(() => this.attachButtonToChatbox(), 2000);
      return;
    }

    // Find the appropriate container for positioning
    const container = this.findInputContainer(inputArea);
    if (!container) {
      console.warn('[APE InlineUI] Container not found');
      return;
    }

    // Create button
    this.currentButton = this.createEnhanceButton();

    // Position button based on platform
    this.positionButton(container, inputArea);

    console.log('[APE InlineUI] Button attached successfully');
  }

  /**
   * Find the input container element
   */
  findInputContainer(inputElement) {
    const platform = this.domObserver.platform;

    // Platform-specific container logic
    if (platform === 'chatgpt') {
      // ChatGPT: find the parent form or flex container
      let parent = inputElement.parentElement;
      while (parent && parent !== document.body) {
        if (parent.tagName === 'FORM' ||
            parent.classList.contains('flex') ||
            parent.querySelector('button[data-testid*="send"]')) {
          return parent;
        }
        parent = parent.parentElement;
      }
      return inputElement.parentElement;
    } else if (platform === 'claude') {
      // Claude: find the fieldset or editor container
      let parent = inputElement.parentElement;
      while (parent && parent !== document.body) {
        if (parent.tagName === 'FIELDSET' ||
            parent.querySelector('button[type="submit"]')) {
          return parent;
        }
        parent = parent.parentElement;
      }
      return inputElement.parentElement;
    } else {
      // Generic: use parent element
      return inputElement.parentElement;
    }
  }

  /**
   * Create the enhance button element
   */
  createEnhanceButton() {
    const button = document.createElement('button');
    button.id = this.buttonId;
    button.className = 'ape-inline-button';
    button.type = 'button';
    button.setAttribute('aria-label', 'Enhance Prompt (Alt+E)');
    button.title = 'Enhance Prompt (Alt+E)';

    button.innerHTML = `
      <svg class="ape-icon-enhance" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
        <path d="M2 17L12 22L22 17"/>
        <path d="M2 12L12 17L22 12"/>
      </svg>
      <svg class="ape-spinner-inline ape-hidden" width="20" height="20" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"
                fill="none" stroke-dasharray="40" stroke-dashoffset="10"/>
      </svg>
    `;

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleEnhanceClick();
    });

    return button;
  }

  /**
   * Position button based on platform
   */
  positionButton(container, inputElement) {
    const platform = this.domObserver.platform;

    // Platform-specific positioning strategies
    const positions = {
      chatgpt: () => {
        // ChatGPT: absolute positioning relative to container
        const parent = container.parentElement || container;

        // Make parent relative if needed
        const computedStyle = window.getComputedStyle(parent);
        if (computedStyle.position === 'static') {
          parent.style.position = 'relative';
        }

        // Position button
        Object.assign(this.currentButton.style, {
          position: 'absolute',
          right: '50px',
          bottom: '8px',
          zIndex: '100'
        });

        parent.appendChild(this.currentButton);
      },

      claude: () => {
        // Claude: position within the fieldset/form area
        const parent = container.parentElement || container;

        // Make parent relative if needed
        const computedStyle = window.getComputedStyle(parent);
        if (computedStyle.position === 'static') {
          parent.style.position = 'relative';
        }

        Object.assign(this.currentButton.style, {
          position: 'absolute',
          right: '50px',
          bottom: '12px',
          zIndex: '100'
        });

        parent.appendChild(this.currentButton);
      },

      generic: () => {
        // Generic: try to position near send button
        const parent = container;
        const computedStyle = window.getComputedStyle(parent);
        if (computedStyle.position === 'static') {
          parent.style.position = 'relative';
        }

        Object.assign(this.currentButton.style, {
          position: 'absolute',
          right: '10px',
          bottom: '10px',
          zIndex: '100'
        });

        parent.appendChild(this.currentButton);
      }
    };

    // Execute platform-specific positioning or use generic
    const positionFn = positions[platform] || positions.generic;
    positionFn();
  }

  /**
   * Handle enhance button click
   */
  async handleEnhanceClick() {
    if (this.isProcessing) {
      console.log('[APE InlineUI] Already processing...');
      return;
    }

    this.isProcessing = true;
    this.showLoading();

    try {
      // Get current settings
      const settings = await this.getSettings();

      // Extract context
      const context = await this.extractor.extractFullContext();

      if (!context.currentPrompt || context.currentPrompt.trim().length === 0) {
        this.showToast('No prompt to enhance', 'error');
        return;
      }

      console.log('[APE InlineUI] Enhancing prompt...', {
        originalLength: context.currentPrompt.length,
        contextMessages: context.conversationHistory.length
      });

      // Get enhancement type from settings
      const enhancementType = settings.currentEnhancementType || 'balanced';

      // Enhance prompt
      const enhanced = await this.enhancePrompt(context, enhancementType, settings);

      if (!enhanced) {
        this.showToast('Enhancement failed', 'error');
        return;
      }

      this.enhancedPrompt = enhanced;

      console.log('[APE InlineUI] Enhancement complete', {
        enhancedLength: enhanced.length,
        difference: enhanced.length - context.currentPrompt.length
      });

      // Replace text in chatbox
      const success = await this.domObserver.injectEnhancedPrompt(enhanced);

      if (success) {
        this.showToast('Prompt enhanced!', 'success');

        // Track enhancement
        await this.trackEnhancement(enhancementType);
      } else {
        this.showToast('Failed to apply enhancement', 'error');
      }

    } catch (error) {
      console.error('[APE InlineUI] Enhancement error:', error);
      this.showToast('Enhancement failed', 'error');
    } finally {
      this.isProcessing = false;
      this.hideLoading();
    }
  }

  /**
   * Enhance prompt using current settings
   */
  async enhancePrompt(context, enhancementType, settings) {
    // For now, use the existing enhancer
    // In Phase 2, we'll integrate the preset system

    // Check if we should use a preset (Phase 2 feature)
    if (enhancementType === 'custom' && settings.customEnhancementPrompt) {
      // TODO: Implement custom enhancement in Phase 2
      return await this.enhancer.enhancePrompt(context);
    }

    // Use existing enhancement logic
    return await this.enhancer.enhancePrompt(context);
  }

  /**
   * Get current settings
   */
  async getSettings() {
    try {
      const response = await browserCompat.sendMessage({
        action: 'getSettings'
      });
      return response || this.settings || {};
    } catch (error) {
      console.error('[APE InlineUI] Failed to get settings:', error);
      return this.settings || {};
    }
  }

  /**
   * Track enhancement event
   */
  async trackEnhancement(enhancementType) {
    try {
      await browserCompat.sendMessage({
        action: 'trackEvent',
        data: {
          eventName: 'prompt_enhanced',
          eventData: {
            platform: this.domObserver.platform,
            enhancementType,
            timestamp: Date.now()
          }
        }
      });

      // Update usage stats
      const stats = await browserCompat.storage_get(['usageStats']) || {};
      const usageStats = stats.usageStats || { totalEnhancements: 0, byokEnhancements: 0 };

      usageStats.totalEnhancements++;

      const subscription = await browserCompat.sendMessage({ action: 'getSubscription' });
      if (subscription && subscription.type === 'byok') {
        usageStats.byokEnhancements++;
      }

      await browserCompat.storage_set({ usageStats });
    } catch (error) {
      console.error('[APE InlineUI] Failed to track enhancement:', error);
    }
  }

  /**
   * Show loading state
   */
  showLoading() {
    if (!this.currentButton) return;

    const icon = this.currentButton.querySelector('.ape-icon-enhance');
    const spinner = this.currentButton.querySelector('.ape-spinner-inline');

    if (icon) icon.classList.add('ape-hidden');
    if (spinner) spinner.classList.remove('ape-hidden');

    this.currentButton.disabled = true;
    this.currentButton.classList.add('ape-processing');
  }

  /**
   * Hide loading state
   */
  hideLoading() {
    if (!this.currentButton) return;

    const icon = this.currentButton.querySelector('.ape-icon-enhance');
    const spinner = this.currentButton.querySelector('.ape-spinner-inline');

    if (icon) icon.classList.remove('ape-hidden');
    if (spinner) spinner.classList.add('ape-hidden');

    this.currentButton.disabled = false;
    this.currentButton.classList.remove('ape-processing');
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'info') {
    // Remove any existing toast
    const existingToast = document.querySelector('.ape-toast');
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `ape-toast ape-toast-${type}`;

    // Add icon based on type
    const icons = {
      success: '✓',
      error: '✕',
      info: 'ℹ',
      warning: '⚠'
    };

    toast.innerHTML = `
      <span class="ape-toast-icon">${icons[type] || icons.info}</span>
      <span class="ape-toast-message">${message}</span>
    `;

    document.body.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('ape-toast-show'), 10);

    // Auto-remove after delay
    setTimeout(() => {
      toast.classList.remove('ape-toast-show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /**
   * Copy enhanced prompt to clipboard
   */
  async copyEnhancedToClipboard() {
    if (!this.enhancedPrompt) {
      this.showToast('No enhanced prompt to copy', 'warning');
      return;
    }

    const success = await copyToClipboard(this.enhancedPrompt);
    if (success) {
      this.showToast('Copied to clipboard', 'success');
    } else {
      this.showToast('Failed to copy', 'error');
    }
  }

  /**
   * Cleanup/destroy
   */
  destroy() {
    if (this.currentButton) {
      this.currentButton.remove();
      this.currentButton = null;
    }
  }
}

export default InlineUI;
