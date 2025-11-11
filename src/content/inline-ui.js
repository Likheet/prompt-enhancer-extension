/**
 * Inline UI Component
 * Provides inline button beside chatbox for prompt enhancement
 */

import { UI_CONSTANTS, SUCCESS_MESSAGES, ERROR_MESSAGES, STORAGE_KEYS } from '../shared/constants.js';
import { copyToClipboard, generateId } from '../shared/utils.js';
import browserCompat from '../shared/browser-compat.js';
import DOCKING_STRATEGIES from './docking-strategies.js';
import EnhancementPresets from './enhancement-presets.js';

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
    this.presets = new EnhancementPresets();
    this.extensionInvalidatedNotified = false;
    this.currentDockingTarget = null;
    this.composerObserver = null;
    this.cachedInputElement = null;
    this.currentStrategyKey = null;

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
    // Store observer reference for cleanup
    let reattachTimeout = null;
    
    this.composerObserver = new MutationObserver(() => {
      // Debounce the reattachment check
      if (reattachTimeout) {
        clearTimeout(reattachTimeout);
      }
      
      reattachTimeout = setTimeout(() => {
        // Check if button is still attached and valid
        if (!this.isButtonAttached()) {
          console.log('[APE InlineUI] Button detached, reattaching...');
          this.attachButtonToChatbox();
        }
      }, 500); // Wait 500ms before checking
    });

    this.composerObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Cleanup resources
   */
  destroy() {
    console.log('[APE InlineUI] Cleaning up...');
    
    // Disconnect mutation observer
    if (this.composerObserver) {
      this.composerObserver.disconnect();
      this.composerObserver = null;
    }
    
    // Remove button from DOM
    if (this.currentButton) {
      this.currentButton.remove();
      this.currentButton = null;
    }
    
    // Clear cached elements
    this.cachedInputElement = null;
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
    // Prevent multiple buttons - check both our reference AND the DOM
    if (this.currentButton && this.isButtonAttached()) {
      return;
    }

    // Also check if a button with our ID already exists in the DOM
    const existingButton = document.getElementById(this.buttonId);
    if (existingButton) {
      console.log('[APE InlineUI] Button already exists in DOM, reusing...');
      this.currentButton = existingButton;
      return;
    }

    const inputArea = await this.domObserver.findInputElement();
    if (!inputArea) {
      console.warn('[APE InlineUI] Input area not found, will retry...');
      setTimeout(() => this.attachButtonToChatbox(), 2000);
      return;
    }

    this.cachedInputElement = inputArea;

    // Create button
    this.currentButton = this.createEnhanceButton();

    // Attempt to dock the button using platform-specific strategy
    const docked = this.dockButton(inputArea);

    if (!docked) {
      this.applyFloatingFallback();
    }

    console.log('[APE InlineUI] Button attached successfully');
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

    const iconUrl = chrome?.runtime?.getURL('assets/icons/icon-48.png') || 
                    browser?.runtime?.getURL('assets/icons/icon-48.png');

    button.innerHTML = `
      <img class="ape-icon-enhance" src="${iconUrl}" alt="Enhance" style="width: 100%; height: 100%; display: block; object-fit: contain;">
      <svg class="ape-spinner-inline ape-hidden" width="100%" height="100%" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"
                fill="none" stroke-dasharray="40" stroke-dashoffset="10"/>
      </svg>
    `;

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleEnhanceClick();
    });

    button.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showContextMenu(e);
    });

    return button;
  }

  /**
   * Show context menu on right-click
   */
  async showContextMenu(event) {
    // Remove any existing context menu
    const existingMenu = document.getElementById('ape-context-menu');
    if (existingMenu) {
      existingMenu.remove();
    }

    const settings = await this.getSettings();
    const currentTemplate = settings.promptTemplateType || 'standard';

    // Create context menu
    const menu = document.createElement('div');
    menu.id = 'ape-context-menu';
    menu.className = 'ape-context-menu';

    menu.innerHTML = `
      <div class="ape-context-menu-header">
        <span>✨ Prompt Templates</span>
      </div>
      <div class="ape-context-menu-section">
        <button class="ape-context-menu-item ${currentTemplate === 'standard' ? 'active' : ''}" data-template="standard">
          <span class="ape-context-menu-emoji">⚡</span>
          <span class="ape-context-menu-text">Direct Enhancer</span>
          ${currentTemplate === 'standard' ? '<span class="ape-context-menu-check">✓</span>' : ''}
        </button>
        <button class="ape-context-menu-item ${currentTemplate === 'structured' ? 'active' : ''}" data-template="structured">
          <span class="ape-context-menu-emoji">🧭</span>
          <span class="ape-context-menu-text">Structured Blueprint</span>
          ${currentTemplate === 'structured' ? '<span class="ape-context-menu-check">✓</span>' : ''}
        </button>
      </div>
      <div class="ape-context-menu-divider"></div>
      <button class="ape-context-menu-item" data-action="open-settings">
        <span class="ape-context-menu-emoji">⚙️</span>
        <span class="ape-context-menu-text">Open Settings</span>
      </button>
    `;

    // Position menu near click
    menu.style.position = 'fixed';
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;
    menu.style.zIndex = '10000';

    document.body.appendChild(menu);

    // Adjust position if menu goes off screen
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = `${event.clientX - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = `${event.clientY - rect.height}px`;
    }

    // Handle menu item clicks
    menu.addEventListener('click', async (e) => {
      const button = e.target.closest('.ape-context-menu-item');
      if (!button) return;

      const template = button.dataset.template;
      const action = button.dataset.action;

      if (template) {
        // Change template
        await this.changeTemplate(template);
        this.showToast(`Switched to ${template === 'standard' ? 'Direct Enhancer' : 'Structured Blueprint'}`, 'success');
        menu.remove();
      } else if (action === 'open-settings') {
        browserCompat.sendMessage({ action: 'openOptions' });
        menu.remove();
      }
    });

    // Close menu on outside click
    const closeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }

  /**
   * Change prompt template
   */
  async changeTemplate(templateType) {
    try {
      const settings = await this.getSettings();
      settings.promptTemplateType = templateType;

      await browserCompat.storageSet({
        enhancerSettings: settings
      });

      // Update cached settings
      this.settings = settings;
    } catch (error) {
      console.error('[InlineUI] Failed to change template:', error);
    }
  }

  /**
   * Position button based on platform
   */
  dockButton(inputElement) {
    if (!this.currentButton) return false;

    const platform = this.domObserver.platform;
    const strategy = DOCKING_STRATEGIES[platform] || DOCKING_STRATEGIES.generic;

    const anchor = strategy.findAnchor(inputElement);

    if (!anchor || !anchor.container) {
      this.clearDockingObserver();
      return false;
    }

    this.resetButtonStyles();
    strategy.applyStyles(this.currentButton, anchor.container);

    // Handle button insertion with optional wrapper (for Perplexity, AI Studio)
    let elementToInsert = this.currentButton;
    if (anchor.needsWrapper) {
      const wrapperTag = anchor.wrapperTag || 'span';
      const wrapperClass = anchor.wrapperClass || '';
      const expectedTag = wrapperTag.toUpperCase();
      
      // Check if button is already wrapped correctly
      const parent = this.currentButton.parentElement;
      const isCorrectlyWrapped = parent && 
                                 parent.tagName === expectedTag && 
                                 (!wrapperClass || parent.classList.contains(wrapperClass));
      
      if (!isCorrectlyWrapped) {
        const wrapper = document.createElement(wrapperTag);
        if (wrapperClass) {
          wrapper.className = wrapperClass;
        }
        wrapper.appendChild(this.currentButton);
        elementToInsert = wrapper;
      } else {
        elementToInsert = parent;
      }
    }

    if (anchor.position === 'before' && anchor.referenceNode) {
      anchor.container.insertBefore(elementToInsert, anchor.referenceNode);
    } else if (anchor.position === 'after' && anchor.referenceNode) {
      anchor.container.insertBefore(elementToInsert, anchor.referenceNode.nextSibling);
    } else {
      anchor.container.appendChild(elementToInsert);
    }

    this.currentDockingTarget = {
      container: anchor.container,
      strategy
    };
    this.currentStrategyKey = platform in DOCKING_STRATEGIES ? platform : 'generic';

    this.setupDockingObserver(anchor.container, strategy);

    return true;
  }

  resetButtonStyles() {
    if (!this.currentButton) return;
    
    // Remove all platform-specific classes
    this.currentButton.className = 'ape-inline-button';
    
    // Reset all possible inline styles to empty string
    Object.assign(this.currentButton.style, {
      position: '',
      left: '',
      right: '',
      top: '',
      bottom: '',
      zIndex: '',
      marginLeft: '',
      marginRight: '',
      marginTop: '',
      marginBottom: '',
      width: '',
      height: '',
      minWidth: '',
      minHeight: '',
      maxWidth: '',
      maxHeight: '',
      padding: '',
      paddingTop: '',
      paddingRight: '',
      paddingBottom: '',
      paddingLeft: '',
      borderRadius: '',
      display: '',
      alignItems: '',
      justifyContent: '',
      backgroundColor: '',
      color: '',
      border: '',
      boxShadow: ''
    });
  }

  applyFloatingFallback() {
    if (!this.currentButton) return;

    this.resetButtonStyles();

    Object.assign(this.currentButton.style, {
      position: 'fixed',
      left: '20px',
      bottom: '100px',
      right: 'auto',
      top: 'auto',
      zIndex: '9999'
    });

    document.body.appendChild(this.currentButton);
    this.clearDockingObserver();
  }

  setupDockingObserver(container, strategy) {
    this.clearDockingObserver();
    if (!container) return;

    const observer = new MutationObserver(() => {
      if (!this.currentButton) {
        this.clearDockingObserver();
        return;
      }

      if (!container.isConnected) {
        this.clearDockingObserver();
        this.domObserver.findInputElement().then((input) => {
          if (input) {
            this.cachedInputElement = input;
          }
          const success = this.dockButton(this.cachedInputElement);
          if (!success) {
            this.applyFloatingFallback();
          }
        }).catch(() => {
          this.applyFloatingFallback();
        });
        return;
      }

      const stillDocked = container.contains(this.currentButton);
      const stillValid = typeof strategy.validate === 'function' ? strategy.validate(container) : true;

      if (!stillDocked || !stillValid) {
        const success = this.dockButton(this.cachedInputElement);
        if (!success) {
          this.applyFloatingFallback();
        }
      }
    });

    observer.observe(container, {
      childList: true,
      subtree: true
    });

    this.composerObserver = observer;
  }

  clearDockingObserver() {
    if (this.composerObserver) {
      this.composerObserver.disconnect();
      this.composerObserver = null;
    }
    this.currentDockingTarget = null;
    this.currentStrategyKey = null;
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
        const trimmedOriginal = context.currentPrompt.trim();
        const trimmedEnhanced = enhanced.trim();
        if (!trimmedEnhanced.length) {
          this.showToast('No enhanced content returned', 'warning');
          return;
        }
        if (trimmedEnhanced === trimmedOriginal) {
          this.showToast('No changes were applied to the prompt', 'info');
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
    // Use the preset system
    const customPrompt = enhancementType === 'custom' ? settings.customEnhancementPrompt : null;

    try {
      const enhanced = await this.presets.enhanceWithPreset(
        context,
        enhancementType || 'balanced',
        customPrompt
      );

      return enhanced;
    } catch (error) {
      console.error('[InlineUI] Enhancement error:', error);

      // Fallback to basic enhancement
      const fallback = await this.enhancer.enhancePrompt(context, settings);
      return fallback.enhanced;
    }
  }

  /**
   * Get current settings
   */
  async getSettings() {
    try {
      const response = await browserCompat.sendMessage({
        action: 'getSettings'
      });
      if (response) {
        this.settings = response;
      }
      return this.settings || {};
    } catch (error) {
      const message = error?.message || String(error);

      if (message.includes('Extension context invalidated')) {
        if (!this.extensionInvalidatedNotified) {
          this.showToast('Extension reloaded. Refresh the page to continue.', 'warning');
          this.extensionInvalidatedNotified = true;
        }
      } else {
        console.error('[APE InlineUI] Failed to get settings:', error);
      }

      try {
        const fallback = await browserCompat.storageGet([STORAGE_KEYS.SETTINGS]);
        if (fallback?.[STORAGE_KEYS.SETTINGS]) {
          this.settings = {
            ...this.settings,
            ...fallback[STORAGE_KEYS.SETTINGS]
          };
        }
      } catch (storageError) {
        console.error('[APE InlineUI] Storage fallback failed:', storageError);
      }

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
      const stats = await browserCompat.storageGet(['usageStats']) || {};
      const usageStats = stats.usageStats || { totalEnhancements: 0, byokEnhancements: 0 };

      usageStats.totalEnhancements++;

      const subscription = await browserCompat.sendMessage({ action: 'getSubscription' });
      if (subscription && subscription.type === 'byok') {
        usageStats.byokEnhancements++;
      }

      await browserCompat.storageSet({ usageStats });
    } catch (error) {
      console.error('[APE InlineUI] Failed to track enhancement:', error);
    }
  }

  /**
   * Show loading state
   */
  showLoading() {
    if (!this.currentButton) return;

    // Keep the icon visible and just add the processing class to make it spin
    this.currentButton.disabled = true;
    this.currentButton.classList.add('ape-processing');
  }

  /**
   * Hide loading state
   */
  hideLoading() {
    if (!this.currentButton) return;

    // Remove the processing class to stop the spinning animation
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

}

export default InlineUI;
