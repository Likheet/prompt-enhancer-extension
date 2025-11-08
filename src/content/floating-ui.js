/**
 * Floating UI Component
 * Provides user interface for prompt enhancement
 */

import { UI_CONSTANTS, SUCCESS_MESSAGES, ERROR_MESSAGES } from '../shared/constants.js';
import { copyToClipboard, generateId } from '../shared/utils.js';
import browserCompat from '../shared/browser-compat.js';

class FloatingUI {
  constructor(enhancer, extractor, domObserver, settings) {
    this.enhancer = enhancer;
    this.extractor = extractor;
    this.domObserver = domObserver;
    this.settings = settings;

    this.enhancedPrompt = null;
    this.isProcessing = false;
    this.isVisible = true;

    this.createUI();
    this.attachEventListeners();
    this.monitorInputArea();
  }

  /**
   * Create UI elements
   */
  createUI() {
    // Check if already exists
    if (document.getElementById(UI_CONSTANTS.CONTAINER_ID)) {
      return;
    }

    const container = document.createElement('div');
    container.id = UI_CONSTANTS.CONTAINER_ID;
    container.innerHTML = this.getUITemplate();

    document.body.appendChild(container);

    console.log('[APE] UI created');
  }

  /**
   * Get UI HTML template
   */
  getUITemplate() {
    return `
      <div id="${UI_CONSTANTS.FLOATING_BUTTON_ID}" class="ape-floating-button" title="Enhance Prompt">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
          <path d="M2 17L12 22L22 17"/>
          <path d="M2 12L12 17L22 12"/>
        </svg>
      </div>

      <div id="${UI_CONSTANTS.PANEL_ID}" class="ape-panel ape-hidden">
        <div class="ape-panel-header">
          <h3>✨ Prompt Enhancer</h3>
          <button class="ape-close-btn" aria-label="Close panel">&times;</button>
        </div>

        <div class="ape-panel-body">
          <div class="ape-section">
            <label class="ape-label">Original Prompt:</label>
            <div id="ape-original" class="ape-prompt-display ape-original"></div>
          </div>

          <div class="ape-section">
            <label class="ape-label">Enhanced Prompt:</label>
            <div id="ape-enhanced-container">
              <div id="ape-enhanced" class="ape-prompt-display ape-enhanced"></div>
              <div id="ape-loading" class="ape-loading ape-hidden">
                <div class="ape-spinner"></div>
                <span>Enhancing your prompt...</span>
              </div>
            </div>
          </div>

          <div id="ape-changes-section" class="ape-section ape-hidden">
            <label class="ape-label">Changes Made:</label>
            <div id="ape-changes" class="ape-changes-list"></div>
          </div>

          <div class="ape-section">
            <label class="ape-label">Context:</label>
            <div id="ape-context" class="ape-context-display">
              <span id="ape-context-messages" class="ape-context-badge">0 messages</span>
              <span id="ape-context-topic" class="ape-context-topic">No topic</span>
            </div>
          </div>

          <div class="ape-actions">
            <button id="ape-enhance-btn" class="ape-btn ape-btn-primary">
              ✨ Enhance
            </button>
            <button id="ape-apply-btn" class="ape-btn ape-btn-success ape-hidden">
              ✓ Apply
            </button>
            <button id="ape-copy-btn" class="ape-btn ape-btn-secondary ape-hidden">
              📋 Copy
            </button>
          </div>
        </div>

        <div class="ape-panel-footer">
          <div class="ape-subscription-status">
            <span id="ape-tier-badge" class="ape-tier-badge">Free Tier</span>
            <button id="ape-settings-link" class="ape-link-btn">Settings</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Floating button
    const floatingBtn = document.getElementById(UI_CONSTANTS.FLOATING_BUTTON_ID);
    floatingBtn?.addEventListener('click', () => this.togglePanel());

    // Close panel
    const closeBtn = document.querySelector('.ape-close-btn');
    closeBtn?.addEventListener('click', () => this.hidePanel());

    // Enhance button
    const enhanceBtn = document.getElementById('ape-enhance-btn');
    enhanceBtn?.addEventListener('click', () => this.performEnhancement());

    // Apply button
    const applyBtn = document.getElementById('ape-apply-btn');
    applyBtn?.addEventListener('click', () => this.applyEnhanced());

    // Copy button
    const copyBtn = document.getElementById('ape-copy-btn');
    copyBtn?.addEventListener('click', () => this.copyEnhanced());

    // Settings link
    const settingsLink = document.getElementById('ape-settings-link');
    settingsLink?.addEventListener('click', () => this.openSettings());

    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
      const panel = document.getElementById(UI_CONSTANTS.PANEL_ID);
      const button = document.getElementById(UI_CONSTANTS.FLOATING_BUTTON_ID);

      if (panel && !panel.classList.contains('ape-hidden')) {
        if (!panel.contains(e.target) && !button.contains(e.target)) {
          this.hidePanel();
        }
      }
    });

    // Update subscription status
    this.updateSubscriptionStatus();
  }

  /**
   * Toggle panel visibility
   */
  togglePanel() {
    const panel = document.getElementById(UI_CONSTANTS.PANEL_ID);
    panel?.classList.toggle('ape-hidden');

    const button = document.getElementById(UI_CONSTANTS.FLOATING_BUTTON_ID);
    button?.classList.toggle('ape-active');
  }

  /**
   * Hide panel
   */
  hidePanel() {
    const panel = document.getElementById(UI_CONSTANTS.PANEL_ID);
    panel?.classList.add('ape-hidden');

    const button = document.getElementById(UI_CONSTANTS.FLOATING_BUTTON_ID);
    button?.classList.remove('ape-active');
  }

  /**
   * Show panel
   */
  showPanel() {
    const panel = document.getElementById(UI_CONSTANTS.PANEL_ID);
    panel?.classList.remove('ape-hidden');

    const button = document.getElementById(UI_CONSTANTS.FLOATING_BUTTON_ID);
    button?.classList.add('ape-active');
  }

  /**
   * Perform enhancement
   */
  async performEnhancement() {
    if (this.isProcessing) return;

    this.isProcessing = true;
    this.showLoading();
    this.hideActionButtons();

    try {
      // Extract context
      const context = await this.extractor.extractFullContext();

      if (!context.currentPrompt || context.currentPrompt.trim().length === 0) {
        this.showError(ERROR_MESSAGES.NO_PROMPT);
        return;
      }

      // Display original prompt
      this.displayOriginalPrompt(context.currentPrompt);

      // Display context info
      this.displayContextInfo(context);

      // Enhance prompt
      const result = await this.enhancer.enhancePrompt(context, this.settings);

      // Display enhanced prompt
      this.displayEnhancedPrompt(result);

      // Show action buttons
      this.showActionButtons();

      // Store for later use
      this.enhancedPrompt = result.enhanced;

      // Track enhancement
      await this.trackEvent('prompt_enhanced', {
        method: result.method,
        strategy: result.strategy,
        originalLength: context.currentPrompt.length,
        enhancedLength: result.enhanced.length
      });

      this.showSuccess(SUCCESS_MESSAGES.ENHANCED);
    } catch (error) {
      console.error('[APE] Enhancement error:', error);
      this.showError(error.message || ERROR_MESSAGES.API_ERROR);
    } finally {
      this.isProcessing = false;
      this.hideLoading();
    }
  }

  /**
   * Display original prompt
   */
  displayOriginalPrompt(prompt) {
    const originalDiv = document.getElementById('ape-original');
    if (originalDiv) {
      originalDiv.textContent = prompt;
    }
  }

  /**
   * Display enhanced prompt
   */
  displayEnhancedPrompt(result) {
    const enhancedDiv = document.getElementById('ape-enhanced');
    if (enhancedDiv) {
      enhancedDiv.textContent = result.enhanced;
    }

    // Display changes
    if (result.changes && result.changes.length > 0) {
      const changesSection = document.getElementById('ape-changes-section');
      const changesList = document.getElementById('ape-changes');

      if (changesSection && changesList) {
        changesList.innerHTML = result.changes
          .map(change => `<span class="ape-change-badge">${change}</span>`)
          .join('');
        changesSection.classList.remove('ape-hidden');
      }
    }
  }

  /**
   * Display context info
   */
  displayContextInfo(context) {
    const messagesSpan = document.getElementById('ape-context-messages');
    const topicSpan = document.getElementById('ape-context-topic');

    if (messagesSpan) {
      const count = context.conversationHistory?.length || 0;
      messagesSpan.textContent = `${count} message${count !== 1 ? 's' : ''}`;
    }

    if (topicSpan) {
      topicSpan.textContent = context.metadata?.topic || 'General';
    }
  }

  /**
   * Apply enhanced prompt to input
   */
  async applyEnhanced() {
    if (!this.enhancedPrompt) return;

    const success = await this.domObserver.injectEnhancedPrompt(this.enhancedPrompt);

    if (success) {
      this.showSuccess(SUCCESS_MESSAGES.APPLIED);
      await this.trackEvent('prompt_applied');

      // Close panel after a delay
      setTimeout(() => this.hidePanel(), 1500);
    } else {
      this.showError(ERROR_MESSAGES.INJECTION_FAILED);
    }
  }

  /**
   * Copy enhanced prompt to clipboard
   */
  async copyEnhanced() {
    if (!this.enhancedPrompt) return;

    const success = await copyToClipboard(this.enhancedPrompt);

    if (success) {
      this.showSuccess(SUCCESS_MESSAGES.COPIED);
      await this.trackEvent('prompt_copied');
    } else {
      this.showError('Failed to copy to clipboard');
    }
  }

  /**
   * Open settings (popup)
   */
  openSettings() {
    browserCompat.sendMessage({ action: 'openOptions' });
  }

  /**
   * Update subscription status display
   */
  async updateSubscriptionStatus() {
    try {
      const response = await browserCompat.sendMessage({
        action: 'getSubscriptionInfo'
      });

      const badge = document.getElementById('ape-tier-badge');
      if (badge) {
        if (response.type === 'byok') {
          badge.textContent = '🚀 BYOK Tier';
          badge.classList.add('ape-tier-premium');
        } else {
          badge.textContent = '⚡ Free Tier';
          badge.classList.remove('ape-tier-premium');
        }
      }
    } catch (error) {
      console.error('[APE] Failed to get subscription info:', error);
    }
  }

  /**
   * Monitor input area for changes
   */
  monitorInputArea() {
    let lastPromptLength = 0;

    this.domObserver.observeInputArea(async () => {
      const prompt = await this.domObserver.extractPromptText();
      const currentLength = prompt?.length || 0;

      // Show/hide button based on prompt presence
      const button = document.getElementById(UI_CONSTANTS.FLOATING_BUTTON_ID);

      if (currentLength > 0 && lastPromptLength === 0) {
        // Prompt appeared
        button?.classList.add('ape-visible');
      } else if (currentLength === 0 && lastPromptLength > 0) {
        // Prompt cleared
        button?.classList.remove('ape-visible');
      }

      lastPromptLength = currentLength;
    });
  }

  /**
   * Show loading state
   */
  showLoading() {
    const loading = document.getElementById('ape-loading');
    const enhanced = document.getElementById('ape-enhanced');

    loading?.classList.remove('ape-hidden');
    enhanced?.classList.add('ape-hidden');
  }

  /**
   * Hide loading state
   */
  hideLoading() {
    const loading = document.getElementById('ape-loading');
    const enhanced = document.getElementById('ape-enhanced');

    loading?.classList.add('ape-hidden');
    enhanced?.classList.remove('ape-hidden');
  }

  /**
   * Show action buttons
   */
  showActionButtons() {
    document.getElementById('ape-apply-btn')?.classList.remove('ape-hidden');
    document.getElementById('ape-copy-btn')?.classList.remove('ape-hidden');
  }

  /**
   * Hide action buttons
   */
  hideActionButtons() {
    document.getElementById('ape-apply-btn')?.classList.add('ape-hidden');
    document.getElementById('ape-copy-btn')?.classList.add('ape-hidden');
  }

  /**
   * Show success notification
   */
  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  /**
   * Show error notification
   */
  showError(message) {
    this.showNotification(message, 'error');
  }

  /**
   * Show notification
   */
  showNotification(message, type = 'info') {
    const id = generateId();
    const notification = document.createElement('div');
    notification.id = id;
    notification.className = `ape-notification ape-notification-${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => notification.classList.add('ape-notification-show'), 10);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.classList.remove('ape-notification-show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  /**
   * Track event
   */
  async trackEvent(eventName, eventData = {}) {
    try {
      await browserCompat.sendMessage({
        action: 'trackEvent',
        data: { eventName, eventData }
      });
    } catch (error) {
      console.error('[APE] Failed to track event:', error);
    }
  }
}

export default FloatingUI;
