/**
 * Inline UI Component
 * Provides inline button beside chatbox for prompt enhancement
 */

import { copyToClipboard, generateId, renderStaticHTML } from '../shared/utils.js';
import browserCompat from '../shared/browser-compat.js';
import DOCKING_STRATEGIES from './docking-strategies.js';

class InlineUI {
  constructor(extractor, domObserver, settings) {
    this.extractor = extractor;
    this.domObserver = domObserver;
    this.settings = settings;

    this.currentButton = null;
    this.enhancedPrompt = null;
    this.isProcessing = false;
    this.buttonId = `ape-inline-btn-${generateId()}`;
    this.lastEnhancementUsedFallback = false;
    this.extensionInvalidatedNotified = false;
    this.currentDockingTarget = null;
    this.pageObserver = null;
    this.dockingObserver = null;
    this.reattachTimeout = null;
    this.retryTimeout = null;
    this.cachedInputElement = null;
    this.currentStrategyKey = null;
    this.missingInputWarned = false;
    this.attachPromise = null;
    this.destroyed = false;
    this.activeEnhancementRequestId = null;
    this.lastFallbackReason = null;
    this.lastProviderUsed = null;
    this.lastEnhancementTimings = null;
    this.contextMenuOutsideHandler = null;
    this.contextMenuListenerTimer = null;

    this.init();
  }

  /**
   * Initialize the inline UI
   */
  async init() {
    // Monitor for chatbox changes (SPA navigation, etc.)
    this.observeChatbox();

    // Try immediately. The observer and bounded retry handle late hydration.
    await this.attachButtonToChatbox();

  }

  /**
   * Monitor for chatbox appearance/disappearance
   */
  observeChatbox() {
    if (this.pageObserver) {
      this.pageObserver.disconnect();
    }

    this.pageObserver = new MutationObserver(() => {
      // Debounce the reattachment check
      if (this.reattachTimeout) {
        clearTimeout(this.reattachTimeout);
      }

      this.reattachTimeout = setTimeout(() => {
        // Re-resolve even while connected: native toolbars often hydrate later.
        if (!this.destroyed) {
          this.attachButtonToChatbox();
        }
      }, 250);
    });

    this.pageObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.destroyed = true;

    if (this.activeEnhancementRequestId) {
      const requestId = this.activeEnhancementRequestId;
      this.activeEnhancementRequestId = null;
      void browserCompat.sendMessage({
        action: 'cancelEnhancement',
        data: { requestId }
      }).catch(() => undefined);
    }

    if (this.pageObserver) {
      this.pageObserver.disconnect();
      this.pageObserver = null;
    }

    this.clearDockingObserver();
    this.closeContextMenu();
    clearTimeout(this.reattachTimeout);
    clearTimeout(this.retryTimeout);
    this.reattachTimeout = null;
    this.retryTimeout = null;

    // Remove button from DOM
    if (this.currentButton) {
      const ownedWrapper = this.currentButton.closest('[data-ape-button-wrapper="true"]');
      this.currentButton.remove();
      if (ownedWrapper && !ownedWrapper.childElementCount) ownedWrapper.remove();
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
  attachButtonToChatbox() {
    if (this.destroyed) return Promise.resolve(false);
    if (this.attachPromise) return this.attachPromise;

    this.attachPromise = this.performAttachButtonToChatbox()
      .finally(() => {
        this.attachPromise = null;
      });
    return this.attachPromise;
  }

  async performAttachButtonToChatbox() {
    if (this.destroyed) return;

    if (typeof this.domObserver.shouldSkipMount === 'function' && this.domObserver.shouldSkipMount()) {
      return;
    }

    const existingButton = document.getElementById(this.buttonId);
    if (!this.currentButton && existingButton) {
      this.currentButton = existingButton;
    }

    const inputArea = await this.domObserver.findInputElement();
    if (this.destroyed) return;

    if (!inputArea) {
      // Exponential Backoff Retry Logic
      const attempt = (this.retryAttempt || 0) + 1;
      this.retryAttempt = attempt;

      const delay = Math.min(1000 * Math.pow(1.5, attempt), 10000); // Cap at 10s

      if (!this.missingInputWarned) {
        console.warn(`[APE InlineUI] Input area not found (Attempt ${attempt}), retrying in ${delay}ms...`);
        if (attempt > 3) this.missingInputWarned = true;
      }

      clearTimeout(this.retryTimeout);
      this.retryTimeout = setTimeout(() => this.attachButtonToChatbox(), delay);
      return;
    }

    // Reset retry counter on success
    this.retryAttempt = 0;
    this.missingInputWarned = false;

    this.cachedInputElement = inputArea;

    if (!this.currentButton) {
      this.currentButton = this.createEnhanceButton();
    }

    // Attempt to dock the button using platform-specific strategy
    const docked = this.dockButton(inputArea);

    if (!docked) {
      console.warn('[APE InlineUI] Docking failed, using floating fallback');
      this.applyFloatingFallback();
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

    renderStaticHTML(button, `
      <svg class="ape-icon-enhance" aria-hidden="true" viewBox="0 0 24 24" fill="none">
        <path d="M12 2.75c.38 4.91 2.34 6.87 7.25 7.25-4.91.38-6.87 2.34-7.25 7.25-.38-4.91-2.34-6.87-7.25-7.25C9.66 9.62 11.62 7.66 12 2.75Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="M18.75 15.5c.15 1.94.81 2.6 2.75 2.75-1.94.15-2.6.81-2.75 2.75-.15-1.94-.81-2.6-2.75-2.75 1.94-.15 2.6-.81 2.75-2.75Z" fill="currentColor"/>
      </svg>
      <svg class="ape-spinner-inline ape-hidden" aria-hidden="true" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"
                fill="none" stroke-dasharray="40" stroke-dashoffset="10"/>
      </svg>
    `);

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
    this.closeContextMenu();

    const settings = await this.getSettings();
    const currentTemplate = settings.promptTemplateType || 'standard';

    // Create context menu
    const menu = document.createElement('div');
    menu.id = 'ape-context-menu';
    menu.className = 'ape-context-menu';

    renderStaticHTML(menu, `
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
    `);

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
        this.closeContextMenu();
      } else if (action === 'open-settings') {
        void browserCompat.sendMessage({ action: 'openOptions' });
        this.closeContextMenu();
      }
    });

    // Close menu on outside click
    this.contextMenuOutsideHandler = (e) => {
      if (!menu.contains(e.target)) {
        this.closeContextMenu();
      }
    };
    this.contextMenuListenerTimer = setTimeout(() => {
      this.contextMenuListenerTimer = null;
      if (!this.destroyed && menu.isConnected && this.contextMenuOutsideHandler) {
        document.addEventListener('click', this.contextMenuOutsideHandler);
      }
    }, 0);
  }

  closeContextMenu() {
    clearTimeout(this.contextMenuListenerTimer);
    this.contextMenuListenerTimer = null;
    if (this.contextMenuOutsideHandler) {
      document.removeEventListener('click', this.contextMenuOutsideHandler);
      this.contextMenuOutsideHandler = null;
    }
    document.getElementById('ape-context-menu')?.remove();
  }

  /**
   * Change prompt template
   */
  async changeTemplate(templateType) {
    try {
      const settings = await this.getSettings();
      settings.promptTemplateType = templateType;

      await browserCompat.sendMessage({
        action: 'saveSettings',
        data: { settings }
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
    const placement = this.settings?.sitePlacement || 'auto';
    let strategyKey = placement === 'auto' && DOCKING_STRATEGIES[platform]
      ? platform
      : 'generic';
    let strategy = DOCKING_STRATEGIES[strategyKey] || DOCKING_STRATEGIES.generic;
    let anchor = strategy.findAnchor(inputElement, { placement });

    if ((!anchor || !anchor.container) && strategyKey !== 'generic') {
      strategyKey = 'generic';
      strategy = DOCKING_STRATEGIES.generic;
      anchor = strategy.findAnchor(inputElement, { placement });
    }

    if (!anchor || !anchor.container) {
      this.clearDockingObserver();
      return false;
    }

    this.resetButtonStyles();
    strategy.applyStyles(this.currentButton, anchor.container, anchor);

    // Handle button insertion with optional wrapper (for Perplexity, AI Studio)
    const previousOwnedWrapper = this.currentButton.closest('[data-ape-button-wrapper="true"]');
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
        wrapper.dataset.apeButtonWrapper = 'true';
        wrapper.appendChild(this.currentButton);
        elementToInsert = wrapper;
      } else {
        elementToInsert = parent;
      }
    }

    const alreadyPlaced = anchor.position === 'before' && anchor.referenceNode
      ? elementToInsert.parentElement === anchor.container && elementToInsert.nextSibling === anchor.referenceNode
      : anchor.position === 'after' && anchor.referenceNode
        ? elementToInsert.parentElement === anchor.container && anchor.referenceNode.nextSibling === elementToInsert
        : elementToInsert.parentElement === anchor.container && elementToInsert === anchor.container.lastElementChild;

    if (!alreadyPlaced) {
      if (anchor.position === 'before' && anchor.referenceNode) {
        anchor.container.insertBefore(elementToInsert, anchor.referenceNode);
      } else if (anchor.position === 'after' && anchor.referenceNode) {
        anchor.container.insertBefore(elementToInsert, anchor.referenceNode.nextSibling);
      } else {
        anchor.container.appendChild(elementToInsert);
      }
    }

    if (previousOwnedWrapper && previousOwnedWrapper !== elementToInsert && !previousOwnedWrapper.childElementCount) {
      previousOwnedWrapper.remove();
    }

    this.currentDockingTarget = {
      container: anchor.container,
      strategy,
      anchor
    };
    this.currentStrategyKey = strategyKey;

    this.setupDockingObserver(anchor.container, strategy, anchor);

    return true;
  }

  resetButtonStyles() {
    if (!this.currentButton) return;

    // Remove all platform-specific classes
    this.currentButton.className = 'ape-inline-button';

    // Reset all possible inline styles to empty string
    Object.assign(this.currentButton.style, {
      position: '',
      inset: '',
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
      flex: '',
      display: '',
      alignItems: '',
      justifyContent: '',
      backgroundColor: '',
      background: '',
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
      left: 'auto',
      bottom: '20px',
      right: '20px',
      top: 'auto',
      zIndex: '9999'
    });

    document.body.appendChild(this.currentButton);
    this.clearDockingObserver();
  }

  setupDockingObserver(container, strategy, anchor) {
    this.clearDockingObserver();
    if (!container) return;

    const observer = new MutationObserver(() => {
      if (this.destroyed) {
        this.clearDockingObserver();
        return;
      }

      if (!this.currentButton) {
        this.clearDockingObserver();
        return;
      }

      if (!container.isConnected) {
        this.clearDockingObserver();
        this.domObserver.findInputElement().then((input) => {
          if (this.destroyed) return;

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
      const stillValid = typeof strategy.validate === 'function' ? strategy.validate(container, anchor) : true;

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

    this.dockingObserver = observer;
  }

  clearDockingObserver() {
    if (this.dockingObserver) {
      this.dockingObserver.disconnect();
      this.dockingObserver = null;
    }
    this.currentDockingTarget = null;
    this.currentStrategyKey = null;
  }

  /**
   * Handle enhance button click
   */
  async handleEnhanceClick() {
    if (this.destroyed || this.isProcessing) {
      return;
    }

    const startedAt = this.now();
    const timings = {};
    this.lastEnhancementUsedFallback = false;
    this.lastFallbackReason = null;
    this.lastProviderUsed = null;
    this.lastEnhancementTimings = null;
    this.isProcessing = true;
    this.showLoading();

    try {
      const settingsStartedAt = this.now();
      const settings = await this.getSettings();
      timings.settingsMs = this.now() - settingsStartedAt;
      if (this.destroyed) return;

      this.extractor.setConversationAwareness(settings.conversationAwareness);
      this.extractor.setContextWindow(settings.contextWindow);

      const contextStartedAt = this.now();
      const context = await this.extractor.extractFullContext();
      timings.conversationAndMetadataMs = this.now() - contextStartedAt;
      Object.assign(timings, context.collectionTimings || {});
      if (this.destroyed) return;

      if (!context.currentPrompt || context.currentPrompt.trim().length === 0) {
        this.showToast('No prompt to enhance', 'error');
        return;
      }

      const enhancementType = settings.currentEnhancementType || 'balanced';
      const originalPrompt = String(context.currentPrompt);
      const requestRoute = this.getRouteIdentity();
      const requestInputElement = this.domObserver.inputElement || this.cachedInputElement;

      const requestStartedAt = this.now();
      const enhanced = await this.enhancePrompt(context, enhancementType, settings);
      timings.workerRoundTripMs = this.now() - requestStartedAt;
      if (this.destroyed) return;

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
        this.showToast(
          this.lastEnhancementUsedFallback
            ? this.getFallbackToast(this.lastFallbackReason, this.lastProviderUsed)
            : 'No changes were applied to the prompt',
          this.lastEnhancementUsedFallback ? 'warning' : 'info'
        );
        return;
      }

      const livePrompt = String(await this.domObserver.extractPromptText());
      const liveInputElement = this.domObserver.inputElement || this.cachedInputElement;
      const routeChanged = requestRoute && this.getRouteIdentity() !== requestRoute;
      const inputChanged = requestInputElement && liveInputElement !== requestInputElement;
      if (livePrompt !== originalPrompt || routeChanged || inputChanged) {
        this.showToast('Prompt changed while enhancement was running', 'info');
        return;
      }

      this.enhancedPrompt = enhanced;

      const injectionStartedAt = this.now();
      const success = await this.domObserver.injectEnhancedPrompt(enhanced);
      timings.injectionMs = this.now() - injectionStartedAt;
      if (this.destroyed) return;

      if (success) {
        this.showToast(
          this.lastEnhancementUsedFallback
            ? this.getFallbackToast(this.lastFallbackReason, this.lastProviderUsed)
            : 'Prompt enhanced!',
          this.lastEnhancementUsedFallback ? 'warning' : 'success'
        );

        // Telemetry must not extend the user-visible loading state.
        void this.trackEnhancement(enhancementType);
      } else {
        this.showToast('Failed to apply enhancement', 'error');
      }

    } catch (error) {
      if (error?.code === 'cancelled' || this.destroyed) return;
      if (error?.code === 'timeout') {
        this.showToast('Enhancement timed out. Please try again.', 'warning');
      } else if (error?.code === 'provider_key_required') {
        this.showToast('Add a Gemini or Groq API key to enhance prompts.', 'error', {
          label: 'Open settings',
          onClick: () => browserCompat.sendMessage({ action: 'openOptions' })
        });
      } else if (error?.code === 'auth') {
        this.showToast('Check the selected provider API key in Settings', 'error');
      } else if (error?.code === 'rate_limit') {
        this.showToast('The selected provider is rate limited. Please try again shortly.', 'warning');
      } else if (error?.code === 'server_error') {
        this.showToast('The selected provider is temporarily unavailable. Please try again.', 'warning');
      } else if (error?.code === 'network') {
        this.showToast('Could not reach the selected provider. Check your connection and try again.', 'warning');
      } else if (['model_configuration', 'invalid_request', 'response_parse', 'response_empty', 'output_invalid'].includes(error?.code)) {
        this.showToast('The provider returned an invalid enhancement. Your prompt was not changed.', 'error');
      } else {
        console.error('[APE InlineUI] Enhancement error:', error);
        this.showToast('Enhancement failed', 'error');
      }
    } finally {
      timings.totalMs = this.now() - startedAt;
      this.lastEnhancementTimings = {
        ...this.lastEnhancementTimings,
        ...timings
      };
      this.isProcessing = false;
      this.hideLoading();
    }
  }

  /**
   * Enhance prompt using current settings
   */
  async enhancePrompt(context, enhancementType, settings) {
    const customPrompt = enhancementType === 'custom' ? settings.customEnhancementPrompt : null;
    const requestId = `enhance-${generateId()}`;
    this.activeEnhancementRequestId = requestId;
    let response;

    try {
      response = await browserCompat.sendMessage({
        action: 'enhancePrompt',
        data: {
          requestId,
          context,
          enhancementType: enhancementType || 'balanced',
          customPrompt
        }
      });
    } finally {
      if (this.activeEnhancementRequestId === requestId) {
        this.activeEnhancementRequestId = null;
      }
    }

    if (!response?.success || typeof response.enhanced !== 'string') {
      const error = new Error(response?.error || 'Enhancement request failed');
      error.code = response?.errorCode || response?.code || 'request_failed';
      throw error;
    }

    this.lastEnhancementUsedFallback = Boolean(response.usedFallback);
    this.lastFallbackReason = response.fallbackReason || null;
    this.lastProviderUsed = response.providerUsed || null;
    this.lastEnhancementTimings = response.timings || null;
    return response.enhanced;
  }

  now() {
    return globalThis.performance?.now?.() ?? Date.now();
  }

  getRouteIdentity() {
    return String(globalThis.location?.href || '');
  }

  getFallbackToast(reason, provider = 'gemini') {
    const label = provider === 'groq' ? 'Groq' : 'Gemini';
    const messages = {
      auth: `${label} API key was rejected; used local enhancement`,
      rate_limit: `${label} rate limit reached; used local enhancement`,
      server_error: `${label} is unavailable; used local enhancement`,
      network: `${label} could not be reached; used local enhancement`,
      timeout: `${label} timed out; used local enhancement`,
      content_blocked: `${label} declined the request; used local enhancement`,
      response_parse: `${label} returned an invalid response; used local enhancement`,
      response_empty: `${label} returned no text; used local enhancement`,
      output_invalid: `${label} returned unusable text; used local enhancement`,
      model_configuration: `${label} model configuration failed; used local enhancement`,
      invalid_request: `${label} rejected the request; used local enhancement`
    };
    return messages[reason] || `${label} enhancement failed; used local enhancement`;
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
        this.settings = {
          ...this.settings,
          ...response
        };
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
    } catch (error) {
      console.error('[APE InlineUI] Failed to track enhancement:', error);
    }
  }

  /**
   * Show loading state
   */
  showLoading() {
    if (!this.currentButton) return;

    const enhanceIcon = this.currentButton.querySelector('.ape-icon-enhance');
    const spinner = this.currentButton.querySelector('.ape-spinner-inline');

    this.currentButton.disabled = true;
    this.currentButton.setAttribute('aria-busy', 'true');
    enhanceIcon?.classList.add('ape-hidden');
    spinner?.classList.remove('ape-hidden');
    this.currentButton.classList.add('ape-processing');
  }

  /**
   * Hide loading state
   */
  hideLoading() {
    if (!this.currentButton) return;

    const enhanceIcon = this.currentButton.querySelector('.ape-icon-enhance');
    const spinner = this.currentButton.querySelector('.ape-spinner-inline');

    this.currentButton.disabled = false;
    this.currentButton.removeAttribute('aria-busy');
    enhanceIcon?.classList.remove('ape-hidden');
    spinner?.classList.add('ape-hidden');
    this.currentButton.classList.remove('ape-processing');
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'info', action = null) {
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

    renderStaticHTML(toast, `
      <span class="ape-toast-icon">${icons[type] || icons.info}</span>
      <span class="ape-toast-message">${message}</span>
      ${action?.label ? '<button type="button" class="ape-toast-action"></button>' : ''}
    `);

    const actionButton = toast.querySelector('.ape-toast-action');
    if (actionButton) {
      actionButton.textContent = action.label;
      actionButton.addEventListener('click', () => action.onClick?.());
    }

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
