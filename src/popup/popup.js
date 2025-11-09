/**
 * Popup Script
 * Handles settings and subscription management UI
 */

import browserCompat from '../shared/browser-compat.js';
import { STORAGE_KEYS, DEFAULT_SETTINGS } from '../shared/constants.js';

class PopupController {
  constructor() {
    this.settings = null;
    this.subscription = null;
    this.init();
  }

  async init() {
    await this.loadData();
    this.setupEventListeners();
    this.updateUI();
  }

  /**
   * Load settings and subscription data
   */
  async loadData() {
    try {
      // Load settings
      const settingsResponse = await browserCompat.sendMessage({
        action: 'getSettings'
      });
      this.settings = {
        ...DEFAULT_SETTINGS,
        ...(settingsResponse || {})
      };

      // Load subscription info
      const subResponse = await browserCompat.sendMessage({
        action: 'getSubscriptionInfo'
      });
      this.subscription = subResponse;

      // Load usage stats
      const stats = await browserCompat.sendMessage({
        action: 'getUsageStats'
      });
      this.updateStats(stats);
    } catch (error) {
      console.error('[APE Popup] Failed to load data:', error);
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // BYOK toggle
    document.getElementById('toggle-byok')?.addEventListener('click', () => {
      this.toggleBYOKConfig();
    });

    // Save API key
    document.getElementById('save-api-key')?.addEventListener('click', () => {
      this.saveAPIKey();
    });

    // Remove API key
    document.getElementById('remove-api-key')?.addEventListener('click', () => {
      this.removeAPIKey();
    });

    // Toggle key visibility
    document.getElementById('toggle-key-visibility')?.addEventListener('click', () => {
      this.toggleKeyVisibility();
    });

    // Save settings
    document.getElementById('save-settings')?.addEventListener('click', () => {
      this.saveSettings();
    });

    // Reset button position
    document.getElementById('reset-button-position')?.addEventListener('click', () => {
      this.resetButtonPosition();
    });

    // Prompt template selection
    document.querySelectorAll('input[name="prompt-template"]').forEach((radio) => {
      radio.addEventListener('change', async (event) => {
        this.handleTemplateSelection(event.target.value);
        await this.saveSettings({ silent: true });
      });
    });

    // Custom template sync
    const customTemplateInput = document.getElementById('custom-template-input');
    customTemplateInput?.addEventListener('input', (event) => {
      this.settings.customPromptTemplate = event.target.value;
      this.queueTemplateSave();
    });

    // Load current settings into form
    this.loadSettingsIntoForm();
  }

  /**
   * Update UI based on subscription status
   */
  updateUI() {
    const subscriptionType = document.getElementById('subscription-type');
    const subscriptionDesc = document.getElementById('subscription-desc');
    const removeKeyBtn = document.getElementById('remove-api-key');
    const apiKeyInput = document.getElementById('gemini-api-key');

    if (this.subscription?.type === 'byok') {
      subscriptionType.textContent = '🚀 BYOK Tier';
      subscriptionDesc.textContent = 'AI-powered enhancements with Gemini API';

      // Show remove button
      removeKeyBtn?.classList.remove('hidden');

      // Show masked API key
      if (this.subscription.apiKeyMasked && apiKeyInput) {
        apiKeyInput.placeholder = this.subscription.apiKeyMasked;
      }
    } else {
      subscriptionType.textContent = '⚡ Free Tier';
      subscriptionDesc.textContent = 'Rule-based prompt enhancement with basic features';

      // Hide remove button
      removeKeyBtn?.classList.add('hidden');
    }
  }

  /**
   * Toggle BYOK configuration panel
   */
  toggleBYOKConfig() {
    const configPanel = document.getElementById('byok-config');
    configPanel?.classList.toggle('hidden');

    const toggleBtn = document.getElementById('toggle-byok');
    if (toggleBtn) {
      toggleBtn.textContent = configPanel?.classList.contains('hidden') ? 'Setup' : 'Hide';
    }
  }

  /**
   * Save API key
   */
  async saveAPIKey() {
    const apiKeyInput = document.getElementById('gemini-api-key');
    const apiKey = apiKeyInput?.value?.trim();

    if (!apiKey) {
      this.showStatus('Please enter an API key', 'error');
      return;
    }

    const saveBtn = document.getElementById('save-api-key');
    if (saveBtn) {
      saveBtn.textContent = 'Validating...';
      saveBtn.disabled = true;
    }

    try {
      const response = await browserCompat.sendMessage({
        action: 'activateBYOK',
        data: { apiKey }
      });

      if (response.success) {
        this.showStatus('✓ BYOK activated successfully!', 'success');

        // Clear input
        if (apiKeyInput) apiKeyInput.value = '';

        // Reload data and update UI
        await this.loadData();
        this.updateUI();

        // Hide config panel after success
        setTimeout(() => {
          this.toggleBYOKConfig();
        }, 2000);
      } else {
        this.showStatus(`Failed: ${response.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('[APE Popup] Save API key error:', error);
      this.showStatus('Failed to save API key', 'error');
    } finally {
      if (saveBtn) {
        saveBtn.textContent = 'Save Key';
        saveBtn.disabled = false;
      }
    }
  }

  /**
   * Remove API key and return to free tier
   */
  async removeAPIKey() {
    if (!confirm('Remove API key and return to Free tier?')) {
      return;
    }

    try {
      const response = await browserCompat.sendMessage({
        action: 'deactivateBYOK'
      });

      if (response.success) {
        this.showStatus('✓ Returned to Free tier', 'success');

        // Reload data and update UI
        await this.loadData();
        this.updateUI();
      } else {
        this.showStatus('Failed to remove API key', 'error');
      }
    } catch (error) {
      console.error('[APE Popup] Remove API key error:', error);
      this.showStatus('Failed to remove API key', 'error');
    }
  }

  /**
   * Toggle API key visibility
   */
  toggleKeyVisibility() {
    const apiKeyInput = document.getElementById('gemini-api-key');
    const toggleBtn = document.getElementById('toggle-key-visibility');

    if (apiKeyInput && toggleBtn) {
      if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        toggleBtn.textContent = '🙈';
      } else {
        apiKeyInput.type = 'password';
        toggleBtn.textContent = '👁️';
      }
    }
  }

  /**
   * Load settings into form
   */
  loadSettingsIntoForm() {
    if (!this.settings) return;

    const templateType = this.settings.promptTemplateType || 'standard';
    const selectedTemplate = document.querySelector(`input[name="prompt-template"][value="${templateType}"]`);
    if (selectedTemplate) {
      selectedTemplate.checked = true;
    }
    this.toggleCustomTemplate(templateType === 'custom');

    const customTemplateInput = document.getElementById('custom-template-input');
    if (customTemplateInput) {
      customTemplateInput.value = this.settings.customPromptTemplate || '';
    }

    const enhancementLevel = document.getElementById('enhancement-level');
    const contextWindow = document.getElementById('context-window');
    const autoEnhance = document.getElementById('auto-enhance');
    const showDiff = document.getElementById('show-diff');

    if (enhancementLevel) enhancementLevel.value = this.settings.enhancementLevel;
    if (contextWindow) contextWindow.value = this.settings.contextWindow;
    if (autoEnhance) autoEnhance.checked = this.settings.autoEnhance;
    if (showDiff) showDiff.checked = this.settings.showDiff;
  }

  /**
   * Save settings
   */
  async saveSettings(options = {}) {
    const { silent = false } = options;
    const enhancementLevel = document.getElementById('enhancement-level')?.value;
    const contextWindowValue = parseInt(document.getElementById('context-window')?.value, 10);
    const autoEnhance = document.getElementById('auto-enhance')?.checked;
    const showDiff = document.getElementById('show-diff')?.checked;
    const templateType = document.querySelector('input[name="prompt-template"]:checked')?.value || 'standard';
    const customTemplate = document.getElementById('custom-template-input')?.value?.trim() || '';

    const resolvedContextWindow = Number.isFinite(contextWindowValue)
      ? contextWindowValue
      : (this.settings?.contextWindow ?? DEFAULT_SETTINGS.contextWindow);

    const newSettings = {
      ...this.settings,
      enhancementLevel,
      contextWindow: resolvedContextWindow,
      autoEnhance,
      showDiff,
      promptTemplateType: templateType,
      customPromptTemplate: customTemplate
    };

    const saveBtn = document.getElementById('save-settings');
    if (!silent && saveBtn) {
      saveBtn.textContent = 'Saving...';
      saveBtn.disabled = true;
    }

    try {
      await browserCompat.sendMessage({
        action: 'saveSettings',
        data: { settings: newSettings }
      });

      this.settings = newSettings;
      if (!silent) {
        this.showGeneralSuccess('Settings saved successfully!');
      }
    } catch (error) {
      console.error('[APE Popup] Save settings error:', error);
      if (!silent) {
        this.showGeneralError('Failed to save settings');
      }
    } finally {
      if (!silent && saveBtn) {
        saveBtn.textContent = 'Save Settings';
        saveBtn.disabled = false;
      }
    }
  }

  /**
   * Reset button position to default
   */
  async resetButtonPosition() {
    const btn = document.getElementById('reset-button-position');
    if (btn) {
      btn.textContent = 'Resetting...';
      btn.disabled = true;
    }

    try {
      const newSettings = {
        ...this.settings,
        buttonPosition: null
      };

      await browserCompat.sendMessage({
        action: 'saveSettings',
        data: { settings: newSettings }
      });

      this.settings = newSettings;
      this.showGeneralSuccess('Button position reset! Reload the page to see changes.');
    } catch (error) {
      console.error('[APE Popup] Reset button position error:', error);
      this.showGeneralError('Failed to reset button position');
    } finally {
      if (btn) {
        btn.textContent = 'Reset Button Position';
        btn.disabled = false;
      }
    }
  }

  /**
   * Handle prompt template selection changes
   */
  handleTemplateSelection(templateType) {
    this.settings.promptTemplateType = templateType;
    this.toggleCustomTemplate(templateType === 'custom');

    if (templateType === 'custom') {
      const textarea = document.getElementById('custom-template-input');
      if (textarea) {
        textarea.focus();
      }
    }
  }

  /**
   * Show or hide the custom template textarea
   */
  toggleCustomTemplate(show) {
    const wrapper = document.getElementById('custom-template-wrapper');
    if (!wrapper) return;

    if (show) {
      wrapper.classList.remove('hidden');
    } else {
      wrapper.classList.add('hidden');
    }
  }

  /**
   * Debounced save for custom template edits
   */
  queueTemplateSave() {
    clearTimeout(this.templateSaveTimeout);
    this.templateSaveTimeout = setTimeout(() => {
      this.saveSettings({ silent: true });
    }, 400);
  }

  /**
   * Update usage statistics
   */
  updateStats(stats) {
    if (!stats) return;

    const totalElem = document.getElementById('total-enhancements');
    const byokElem = document.getElementById('byok-enhancements');

    if (totalElem) totalElem.textContent = stats.totalEnhancements || 0;
    if (byokElem) byokElem.textContent = stats.byokEnhancements || 0;
  }

  /**
   * Show status message
   */
  showStatus(message, type) {
    const statusElem = document.getElementById('api-key-status');

    if (statusElem) {
      statusElem.textContent = message;
      statusElem.className = `status-message ${type}`;
      statusElem.classList.remove('hidden');

      // Auto-hide after 5 seconds
      setTimeout(() => {
        statusElem.classList.add('hidden');
      }, 5000);
    }
  }

  /**
   * Show general success message (temporary)
   */
  showGeneralSuccess(message) {
    const saveBtn = document.getElementById('save-settings');
    if (saveBtn) {
      const originalText = saveBtn.textContent;
      saveBtn.textContent = message;
      saveBtn.style.background = '#10b981';

      setTimeout(() => {
        saveBtn.textContent = originalText;
        saveBtn.style.background = '';
      }, 2000);
    }
  }

  /**
   * Show general error message (temporary)
   */
  showGeneralError(message) {
    const saveBtn = document.getElementById('save-settings');
    if (saveBtn) {
      const originalText = saveBtn.textContent;
      saveBtn.textContent = message;
      saveBtn.style.background = '#ef4444';

      setTimeout(() => {
        saveBtn.textContent = originalText;
        saveBtn.style.background = '';
      }, 2000);
    }
  }
}

// Initialize popup when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new PopupController();
  });
} else {
  new PopupController();
}
