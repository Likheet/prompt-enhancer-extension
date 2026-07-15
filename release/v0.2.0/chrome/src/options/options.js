/**
 * Options Page Logic
 * Manages settings configuration UI
 */

import EnhancementPresets from '../content/enhancement-presets.js';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../shared/constants.js';
import browserCompat from '../shared/browser-compat.js';
import { renderStaticHTML } from '../shared/utils.js';

class OptionsPage {
  constructor() {
    this.presets = new EnhancementPresets();
    this.settings = null;
    this.usageStats = null;
    this.subscriptionInfo = null;

    this.init();
  }

  async init() {
    console.log('[Options] Initializing options page...');

    // Load current settings
    await this.loadSettings();
    await this.loadSubscriptionInfo();
    delete this.settings.geminiKey;
    delete this.settings.geminiApiKey;
    delete this.settings.groqApiKey;

    // Populate UI
    this.populateEnhancementTypes();
    this.populateShortcuts();
    this.populateSettings();
    this.loadUsageStats();

    // Attach event listeners
    this.attachEventListeners();

    console.log('[Options] Options page initialized');
  }

  /**
   * Load settings from storage
   */
  async loadSettings() {
    try {
      const result = await browserCompat.storageGet([STORAGE_KEYS.SETTINGS]);
      const storedSettings = result[STORAGE_KEYS.SETTINGS] || {};
      this.settings = { ...DEFAULT_SETTINGS, ...storedSettings };
      console.log('[Options] Settings loaded');
    } catch (error) {
      console.error('[Options] Failed to load settings:', error);
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  async loadSubscriptionInfo() {
    try {
      this.subscriptionInfo = await browserCompat.sendMessage({
        action: 'getSubscriptionInfo'
      });
    } catch (error) {
      console.error('[Options] Failed to load subscription status:', error);
      this.subscriptionInfo = {
        type: 'free',
        active: true,
        providerMode: 'auto',
        providers: { gemini: { configured: false }, groq: { configured: false } }
      };
    }
  }

  /**
   * Load usage statistics
   */
  async loadUsageStats() {
    try {
      const result = await browserCompat.storageGet([STORAGE_KEYS.USAGE_STATS]);
      this.usageStats = result[STORAGE_KEYS.USAGE_STATS] || {
        totalEnhancements: 0,
        byokEnhancements: 0
      };

      // Update UI
      document.getElementById('total-enhancements').textContent = this.usageStats.totalEnhancements || 0;
      document.getElementById('byok-enhancements').textContent = this.usageStats.byokEnhancements || 0;
      document.getElementById('free-enhancements').textContent =
        (this.usageStats.totalEnhancements || 0) - (this.usageStats.byokEnhancements || 0);
    } catch (error) {
      console.error('[Options] Failed to load usage stats:', error);
    }
  }

  /**
   * Populate enhancement types
   */
  populateEnhancementTypes() {
    const container = document.getElementById('enhancement-types');
    const allPresets = this.presets.getAllPresets();

    const presetCards = allPresets.map(preset => `
      <div class="enhancement-type-card" data-preset-key="${preset.key}">
        <input
          type="radio"
          name="enhancement-type"
          id="preset-${preset.key}"
          value="${preset.key}"
          ${this.settings.currentEnhancementType === preset.key ? 'checked' : ''}
        >
        <label for="preset-${preset.key}">
          <div class="preset-header">
            <span class="preset-emoji">${preset.emoji}</span>
            <strong class="preset-name">${preset.name}</strong>
          </div>
          <p class="preset-description">${preset.description}</p>
        </label>
      </div>
    `).join('');

    renderStaticHTML(container, presetCards);

    // Show custom section if custom preset is selected
    if (this.settings.currentEnhancementType === 'custom') {
      this.showCustomSection();
    }
  }

  /**
   * Populate keyboard shortcuts
   */
  populateShortcuts() {
    const allPresets = this.presets.getAllPresets();
    const shortcuts = ['shortcut-1', 'shortcut-2', 'shortcut-3'];
    const shortcutKeys = ['Alt+1', 'Alt+2', 'Alt+3'];

    shortcuts.forEach((shortcutId, index) => {
      const select = document.getElementById(shortcutId);
      const currentValue = this.settings.shortcuts?.[shortcutKeys[index]];

      const optionsMarkup = allPresets
        .filter(p => p.key !== 'custom') // Exclude custom from shortcuts
        .map(preset => `
          <option value="${preset.key}" ${currentValue === preset.key ? 'selected' : ''}>
            ${preset.emoji} ${preset.name}
          </option>
        `).join('');

      renderStaticHTML(select, optionsMarkup);
    });
  }

  /**
   * Populate settings fields
   */
  populateSettings() {
    // Prompt template selection
    const templateType = this.settings.promptTemplateType || 'standard';
    const templateRadios = document.querySelectorAll('input[name="prompt-template"]');
    templateRadios.forEach(radio => {
      radio.checked = radio.value === templateType;
    });

    const customTemplateWrapper = document.getElementById('custom-template-wrapper');
    if (customTemplateWrapper) {
      customTemplateWrapper.style.display = templateType === 'custom' ? 'block' : 'none';
    }

    const customTemplateTextarea = document.getElementById('custom-template-textarea');
    if (customTemplateTextarea) {
      customTemplateTextarea.value = this.settings.customPromptTemplate || '';
    }

    // Enhancement level
    const enhancementLevel = document.getElementById('enhancement-level');
    if (enhancementLevel) {
      enhancementLevel.value = this.settings.enhancementLevel || 'moderate';
    }

    // Context window
    const contextWindow = document.getElementById('context-window');
    if (contextWindow) {
      contextWindow.value = this.settings.contextWindow || 10;
    }

    // Auto-enhance
    const autoEnhance = document.getElementById('auto-enhance');
    if (autoEnhance) {
      autoEnhance.checked = this.settings.autoEnhance || false;
    }

    // Show diff
    const showDiff = document.getElementById('show-diff');
    if (showDiff) {
      showDiff.checked = this.settings.showDiff !== false; // Default true
    }

    // Custom prompt
    const customPromptTextarea = document.getElementById('custom-prompt-textarea');
    if (customPromptTextarea) {
      customPromptTextarea.value = this.settings.customEnhancementPrompt || '';
    }

    const providerMode = document.getElementById('provider-mode');
    if (providerMode) providerMode.value = this.subscriptionInfo?.providerMode || 'auto';
    ['gemini', 'groq'].forEach((provider) => this.updateProviderStatus(provider));
    this.updateSubscriptionStatus(this.subscriptionInfo?.type === 'byok');

  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Prompt template selection
    document.querySelectorAll('input[name="prompt-template"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.handlePromptTemplateChange(e.target.value);
      });
    });

    const customTemplateTextarea = document.getElementById('custom-template-textarea');
    if (customTemplateTextarea) {
      customTemplateTextarea.addEventListener('input', () => {
        this.settings.customPromptTemplate = customTemplateTextarea.value;
        this.autoSaveSettings();
      });
    }

    // Enhancement type selection
    document.querySelectorAll('input[name="enhancement-type"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.handlePresetChange(e.target.value);
      });
    });

    // Custom prompt textarea
    const customPromptTextarea = document.getElementById('custom-prompt-textarea');
    if (customPromptTextarea) {
      customPromptTextarea.addEventListener('input', () => {
        this.settings.customEnhancementPrompt = customPromptTextarea.value;
        this.autoSaveSettings();
      });
    }

    // Keyboard shortcuts
    ['shortcut-1', 'shortcut-2', 'shortcut-3'].forEach((id) => {
      const select = document.getElementById(id);
      if (select) {
        select.addEventListener('change', () => {
          this.handleShortcutChange();
        });
      }
    });

    document.querySelectorAll('.toggle-provider-key').forEach((button) => {
      button.addEventListener('click', () => this.toggleApiKeyVisibility(button.dataset.provider));
    });
    document.querySelectorAll('.save-provider-key').forEach((button) => {
      button.addEventListener('click', () => this.handleSaveApiKey(button.dataset.provider));
    });
    document.querySelectorAll('.clear-provider-key').forEach((button) => {
      button.addEventListener('click', () => this.handleRemoveApiKey(button.dataset.provider));
    });
    document.getElementById('provider-mode')?.addEventListener('change', async (event) => {
      const response = await browserCompat.sendMessage({
        action: 'setProviderMode',
        data: { providerMode: event.target.value }
      });
      if (!response?.success) this.showStatus('Failed to save provider selection', 'error');
      await this.loadSubscriptionInfo();
      this.populateSettings();
    });

    // General settings
    const enhancementLevel = document.getElementById('enhancement-level');
    if (enhancementLevel) {
      enhancementLevel.addEventListener('change', () => {
        this.settings.enhancementLevel = enhancementLevel.value;
        this.autoSaveSettings();
      });
    }

    const contextWindow = document.getElementById('context-window');
    if (contextWindow) {
      contextWindow.addEventListener('change', () => {
        this.settings.contextWindow = parseInt(contextWindow.value);
        this.autoSaveSettings();
      });
    }

    const autoEnhance = document.getElementById('auto-enhance');
    if (autoEnhance) {
      autoEnhance.addEventListener('change', () => {
        this.settings.autoEnhance = autoEnhance.checked;
        this.autoSaveSettings();
      });
    }

    const showDiff = document.getElementById('show-diff');
    if (showDiff) {
      showDiff.addEventListener('change', () => {
        this.settings.showDiff = showDiff.checked;
        this.autoSaveSettings();
      });
    }

    // Save all settings button
    const saveAllBtn = document.getElementById('save-all-settings');
    if (saveAllBtn) {
      saveAllBtn.addEventListener('click', async () => {
        await this.saveAllSettings();
      });
    }

    // Add custom platform
    const addPlatformBtn = document.getElementById('add-custom-platform');
    if (addPlatformBtn) {
      addPlatformBtn.addEventListener('click', () => {
        this.showCustomPlatformDialog();
      });
    }
  }

  /**
   * Handle preset change
   */
  handlePresetChange(presetKey) {
    this.settings.currentEnhancementType = presetKey;

    // Show/hide custom section
    if (presetKey === 'custom') {
      this.showCustomSection();
    } else {
      this.hideCustomSection();
    }

    this.autoSaveSettings();
  }

  /**
   * Show custom enhancement section
   */
  showCustomSection() {
    const section = document.getElementById('custom-enhancement-section');
    if (section) {
      section.style.display = 'block';
      section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  /**
   * Hide custom enhancement section
   */
  hideCustomSection() {
    const section = document.getElementById('custom-enhancement-section');
    if (section) {
      section.style.display = 'none';
    }
  }

  /**
   * Handle prompt template selection change
   */
  handlePromptTemplateChange(templateType) {
    this.settings.promptTemplateType = templateType;

    if (templateType === 'custom') {
      this.showCustomTemplate();
    } else {
      this.hideCustomTemplate();
    }

    this.autoSaveSettings();
  }

  showCustomTemplate() {
    const wrapper = document.getElementById('custom-template-wrapper');
    if (wrapper) {
      wrapper.style.display = 'block';
      const textarea = document.getElementById('custom-template-textarea');
      if (textarea) {
        textarea.focus();
      }
    }
  }

  hideCustomTemplate() {
    const wrapper = document.getElementById('custom-template-wrapper');
    if (wrapper) {
      wrapper.style.display = 'none';
    }
  }

  /**
   * Handle keyboard shortcut changes
   */
  handleShortcutChange() {
    const shortcuts = {
      'Alt+1': document.getElementById('shortcut-1').value,
      'Alt+2': document.getElementById('shortcut-2').value,
      'Alt+3': document.getElementById('shortcut-3').value
    };

    this.settings.shortcuts = shortcuts;
    this.autoSaveSettings();
  }

  /**
   * Toggle API key visibility
   */
  toggleApiKeyVisibility(provider) {
    const input = document.getElementById(`${provider}-api-key`);
    const button = document.querySelector(`.toggle-provider-key[data-provider="${provider}"]`);

    if (input.type === 'password') {
      input.type = 'text';
      button.textContent = 'Hide';
    } else {
      input.type = 'password';
      button.textContent = 'Show';
    }
  }

  /**
   * Handle save API key
   */
  async handleSaveApiKey(provider) {
    const label = provider === 'groq' ? 'Groq' : 'Gemini';
    const input = document.getElementById(`${provider}-api-key`);
    const apiKey = input.value.trim();

    if (!apiKey) {
      this.showStatus(`Please enter a ${label} API key`, 'error');
      return;
    }

    // Show loading
    const saveBtn = document.querySelector(`.save-provider-key[data-provider="${provider}"]`);
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Validating...';
    saveBtn.disabled = true;

    try {
      const response = await browserCompat.sendMessage({
        action: 'saveProviderKey',
        data: { provider, apiKey }
          });

          if (response?.success) {
            await this.loadSubscriptionInfo();

            input.value = '';
            this.updateProviderStatus(provider);
            this.updateSubscriptionStatus(true);

        this.showStatus(`${label} API key saved`, 'success');
      } else {
        this.showStatus(response?.error || 'API key validation failed. Please check your key.', 'error');
      }
    } catch (error) {
      console.error('[Options] API key validation error:', error);
      this.showStatus('Failed to validate API key. Check your internet connection.', 'error');
    } finally {
      saveBtn.textContent = originalText;
      saveBtn.disabled = false;
    }
  }

  /**
   * Handle remove API key
   */
  async handleRemoveApiKey(provider) {
    const label = provider === 'groq' ? 'Groq' : 'Gemini';
    if (!confirm(`Clear the ${label} API key?`)) {
      return;
    }

    try {
      const response = await browserCompat.sendMessage({
        action: 'clearProviderKey',
        data: { provider }
      });
      if (!response?.success) {
        throw new Error(response?.error || 'Failed to deactivate BYOK');
      }

      await this.loadSubscriptionInfo();
    } catch (error) {
      console.error('[Options] Failed to remove API key:', error);
      this.showStatus('Failed to remove API key', 'error');
      return;
    }

        // Update UI
    const apiKeyInput = document.getElementById(`${provider}-api-key`);
    apiKeyInput.value = '';
    this.updateProviderStatus(provider);
    this.updateSubscriptionStatus(this.subscriptionInfo?.type === 'byok');

    this.showStatus(`${label} API key cleared`, 'info');
  }

  updateProviderStatus(provider) {
    const configured = Boolean(this.subscriptionInfo?.providers?.[provider]?.configured);
    const status = document.getElementById(`${provider}-provider-status`);
    const clearButton = document.querySelector(`.clear-provider-key[data-provider="${provider}"]`);
    if (status) status.textContent = configured ? 'Configured' : 'Not configured';
    if (clearButton) clearButton.style.display = configured ? 'inline-block' : 'none';
  }

  /**
   * Update subscription status display
   */
  updateSubscriptionStatus(hasByok) {
    const badge = document.getElementById('subscription-badge');
    const status = document.getElementById('subscription-status');

    if (hasByok) {
      badge.textContent = 'BYOK Tier';
      badge.className = 'subscription-badge byok';
      const provider = this.subscriptionInfo?.actualProvider;
      status.textContent = provider
        ? `Using AI-powered enhancement with ${provider === 'groq' ? 'Groq' : 'Gemini'}`
        : 'AI provider configured';
    } else {
      badge.textContent = 'Free Tier';
      badge.className = 'subscription-badge free';
      status.textContent = 'Add a Gemini or Groq API key to enhance prompts';
    }
  }

  /**
   * Auto-save settings (debounced)
   */
  autoSaveSettings() {
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.saveSettings();
    }, 500);
  }

  /**
   * Save all settings
   */
  async saveAllSettings() {
    await this.saveSettings();
    this.showStatus('All settings saved successfully! ✓', 'success');
  }

  /**
   * Save settings to storage
   */
  async saveSettings() {
    try {
      const publicSettings = { ...this.settings };
      delete publicSettings.geminiKey;
      delete publicSettings.geminiApiKey;
      delete publicSettings.groqApiKey;
      await browserCompat.storageSet({
        [STORAGE_KEYS.SETTINGS]: publicSettings
      });
      console.log('[Options] Settings saved');
    } catch (error) {
      console.error('[Options] Failed to save settings:', error);
      this.showStatus('Failed to save settings', 'error');
    }
  }

  /**
   * Show custom platform dialog
   */
  showCustomPlatformDialog() {
    this.showStatus('Custom platform configuration coming soon!', 'info');
    // TODO: Implement in Phase 4
  }

  /**
   * Show status message
   */
  showStatus(message, type = 'info') {
    const toast = document.getElementById('status-toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = `status-toast status-${type}`;
    toast.style.display = 'block';

    setTimeout(() => {
      toast.style.display = 'none';
    }, 3000);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new OptionsPage();
  });
} else {
  new OptionsPage();
}
