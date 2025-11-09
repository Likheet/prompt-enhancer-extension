/**
 * Options Page Logic
 * Manages settings configuration UI
 */

import EnhancementPresets from '../content/enhancement-presets.js';
import { DEFAULT_SETTINGS, ENHANCEMENT_PRESETS, STORAGE_KEYS } from '../shared/constants.js';
import browserCompat from '../shared/browser-compat.js';
import { TEST_MODE_ENABLED, HARDCODED_API_KEY, VERBOSE_LOGGING } from '../shared/test-config.js';

class OptionsPage {
  constructor() {
    this.presets = new EnhancementPresets();
    this.settings = null;
    this.usageStats = null;

    this.init();
  }

  async init() {
    console.log('[Options] Initializing options page...');

    // Load current settings
    await this.loadSettings();

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
      const result = await browserCompat.storage_get([STORAGE_KEYS.SETTINGS]);
      const storedSettings = result[STORAGE_KEYS.SETTINGS] || {};
      this.settings = { ...DEFAULT_SETTINGS, ...storedSettings };
      console.log('[Options] Settings loaded:', this.settings);
    } catch (error) {
      console.error('[Options] Failed to load settings:', error);
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  /**
   * Load usage statistics
   */
  async loadUsageStats() {
    try {
      const result = await browserCompat.storage_get([STORAGE_KEYS.USAGE_STATS]);
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

    container.innerHTML = allPresets.map(preset => `
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

      select.innerHTML = allPresets
        .filter(p => p.key !== 'custom') // Exclude custom from shortcuts
        .map(preset => `
          <option value="${preset.key}" ${currentValue === preset.key ? 'selected' : ''}>
            ${preset.emoji} ${preset.name}
          </option>
        `).join('');
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

    // API key
    const apiKeyInput = document.getElementById('gemini-api-key');
    if (apiKeyInput) {
      apiKeyInput.value = this.settings.geminiKey || '';

      // TEST MODE: Pre-fill with hardcoded key if in test mode
      if (TEST_MODE_ENABLED && !this.settings.geminiKey) {
        console.log('[Options TEST MODE] Pre-filling with hardcoded API key');
        apiKeyInput.value = HARDCODED_API_KEY;
        this.settings.geminiKey = HARDCODED_API_KEY;
      }

      // Show/hide remove button
      const removeBtn = document.getElementById('remove-api-key');
      if (this.settings.geminiKey) {
        removeBtn.style.display = 'inline-block';
        this.updateSubscriptionStatus(true);
      } else {
        removeBtn.style.display = 'none';
        this.updateSubscriptionStatus(false);
      }
    }

    // Add test mode indicator if enabled
    if (TEST_MODE_ENABLED) {
      const testModeIndicator = document.createElement('div');
      testModeIndicator.style.cssText = 'background: #fff3cd; padding: 10px; margin: 10px 0; border-radius: 4px; border: 1px solid #ffc107; font-weight: bold; color: #856404;';
      testModeIndicator.textContent = '⚠️ TEST MODE ENABLED - Using hardcoded API key for testing';
      const container = document.querySelector('.settings-container') || document.body;
      container.insertBefore(testModeIndicator, container.firstChild);
    }
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
    ['shortcut-1', 'shortcut-2', 'shortcut-3'].forEach((id, index) => {
      const select = document.getElementById(id);
      if (select) {
        select.addEventListener('change', () => {
          this.handleShortcutChange();
        });
      }
    });

    // API key toggle
    const toggleApiKeyBtn = document.getElementById('toggle-api-key');
    if (toggleApiKeyBtn) {
      toggleApiKeyBtn.addEventListener('click', () => {
        this.toggleApiKeyVisibility();
      });
    }

    // Save API key
    const saveApiKeyBtn = document.getElementById('save-api-key');
    if (saveApiKeyBtn) {
      saveApiKeyBtn.addEventListener('click', async () => {
        await this.handleSaveApiKey();
      });
    }

    // Remove API key
    const removeApiKeyBtn = document.getElementById('remove-api-key');
    if (removeApiKeyBtn) {
      removeApiKeyBtn.addEventListener('click', async () => {
        await this.handleRemoveApiKey();
      });
    }

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
  toggleApiKeyVisibility() {
    const input = document.getElementById('gemini-api-key');
    const icon = document.getElementById('eye-icon');

    if (input.type === 'password') {
      input.type = 'text';
      icon.textContent = '👁️‍🗨️';
    } else {
      input.type = 'password';
      icon.textContent = '👁️';
    }
  }

  /**
   * Handle save API key
   */
  async handleSaveApiKey() {
    const input = document.getElementById('gemini-api-key');
    const apiKey = input.value.trim();

    if (!apiKey) {
      this.showStatus('Please enter an API key', 'error');
      return;
    }

    // Validate API key format
    if (!apiKey.startsWith('AIza')) {
      this.showStatus('Invalid API key format. Should start with "AIza"', 'error');
      return;
    }

    // Show loading
    const saveBtn = document.getElementById('save-api-key');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Validating...';
    saveBtn.disabled = true;

    try {
      // Test the API key
      const isValid = await this.validateGeminiKey(apiKey);

      if (isValid) {
        this.settings.geminiKey = apiKey;
        this.settings.subscriptionType = 'byok';

        await this.saveSettings();

        // Update UI
        document.getElementById('remove-api-key').style.display = 'inline-block';
        this.updateSubscriptionStatus(true);

        this.showStatus('API key saved successfully! 🎉', 'success');
      } else {
        this.showStatus('API key validation failed. Please check your key.', 'error');
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
   * Validate Gemini API key
   */
  async validateGeminiKey(apiKey) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: 'Test' }]
            }]
          })
        }
      );

      return response.ok;
    } catch (error) {
      console.error('[Options] API key validation error:', error);
      return false;
    }
  }

  /**
   * Handle remove API key
   */
  async handleRemoveApiKey() {
    if (!confirm('Are you sure you want to remove your API key? You will revert to the free tier.')) {
      return;
    }

    this.settings.geminiKey = '';
    this.settings.subscriptionType = 'free';

    await this.saveSettings();

    // Update UI
    document.getElementById('gemini-api-key').value = '';
    document.getElementById('remove-api-key').style.display = 'none';
    this.updateSubscriptionStatus(false);

    this.showStatus('API key removed. Switched to free tier.', 'info');
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
      status.textContent = 'Using AI-powered enhancement with Gemini';
    } else {
      badge.textContent = 'Free Tier';
      badge.className = 'subscription-badge free';
      status.textContent = 'Using rule-based enhancement';
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
      await browserCompat.storage_set({
        [STORAGE_KEYS.SETTINGS]: this.settings
      });

      // Also notify background script to update subscription
      if (this.settings.geminiKey) {
        await browserCompat.sendMessage({
          action: 'updateSubscription',
          data: {
            type: 'byok',
            apiKey: this.settings.geminiKey
          }
        });
      }

      console.log('[Options] Settings saved:', this.settings);
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
