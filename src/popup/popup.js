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
    this.originalSettings = null; // Track original values for change detection
    this.hasUnsavedChanges = false;
    this.currentTab = null;
    this.managedSites = [];
    this.init();
  }

  async init() {
    await this.loadData();
    await this.loadCurrentTab();
    await this.loadManagedSites();
    this.setupEventListeners();
    this.updateUI();
    this.updateSiteManagement();
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
      
      // Store original settings for change detection
      this.originalSettings = JSON.parse(JSON.stringify(this.settings));

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

    // Save bar buttons
    document.getElementById('save-settings')?.addEventListener('click', () => {
      this.saveSettings();
    });
    
    document.getElementById('cancel-settings')?.addEventListener('click', () => {
      this.cancelChanges();
    });

    // Prompt template selection
    document.querySelectorAll('input[name="prompt-template"]').forEach((radio) => {
      radio.addEventListener('change', (event) => {
        this.handleTemplateSelection(event.target.value);
        this.checkForChanges();
      });
    });

    // Custom template sync
    const customTemplateInput = document.getElementById('custom-template-input');
    customTemplateInput?.addEventListener('input', (event) => {
      this.settings.customPromptTemplate = event.target.value;
      this.checkForChanges();
    });

    // Context window changes
    const contextWindow = document.getElementById('context-window');
    contextWindow?.addEventListener('input', () => {
      this.checkForChanges();
    });

    // Load current settings into form
    this.loadSettingsIntoForm();
  }

  /**
   * Update UI based on API key status
   */
  updateUI() {
    const removeKeyBtn = document.getElementById('remove-api-key');
    const apiKeyInput = document.getElementById('gemini-api-key');

    if (this.subscription?.type === 'byok') {
      // Show remove button
      removeKeyBtn?.classList.remove('hidden');

      // Show masked API key
      if (this.subscription.apiKeyMasked && apiKeyInput) {
        apiKeyInput.placeholder = this.subscription.apiKeyMasked;
      }
    } else {
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
        this.showStatus('✓ API key saved successfully!', 'success');

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
   * Remove API key
   */
  async removeAPIKey() {
    if (!confirm('Remove your API key?')) {
      return;
    }

    try {
      const response = await browserCompat.sendMessage({
        action: 'deactivateBYOK'
      });

      if (response.success) {
        this.showStatus('✓ API key removed', 'success');

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

    const contextWindow = document.getElementById('context-window');
    if (contextWindow) contextWindow.value = this.settings.contextWindow;
  }

  /**
   * Save settings
   */
  async saveSettings() {
    const contextWindowValue = parseInt(document.getElementById('context-window')?.value, 10);
    const templateType = document.querySelector('input[name="prompt-template"]:checked')?.value || 'standard';
    const customTemplate = document.getElementById('custom-template-input')?.value?.trim() || '';

    const resolvedContextWindow = Number.isFinite(contextWindowValue)
      ? contextWindowValue
      : (this.settings?.contextWindow ?? DEFAULT_SETTINGS.contextWindow);

    const newSettings = {
      ...this.settings,
      contextWindow: resolvedContextWindow,
      promptTemplateType: templateType,
      customPromptTemplate: customTemplate
    };

    const saveBtn = document.getElementById('save-settings');
    if (saveBtn) {
      saveBtn.textContent = 'Saving...';
      saveBtn.disabled = true;
    }

    try {
      await browserCompat.sendMessage({
        action: 'saveSettings',
        data: { settings: newSettings }
      });

      this.settings = newSettings;
      this.originalSettings = JSON.parse(JSON.stringify(newSettings));
      this.hideSaveBar();
    } catch (error) {
      console.error('[APE Popup] Save settings error:', error);
    } finally {
      if (saveBtn) {
        saveBtn.textContent = 'Save';
        saveBtn.disabled = false;
      }
    }
  }
  
  /**
   * Cancel changes and revert to original settings
   */
  cancelChanges() {
    // Revert to original settings
    this.settings = JSON.parse(JSON.stringify(this.originalSettings));
    this.loadSettingsIntoForm();
    this.hideSaveBar();
  }
  
  /**
   * Check if current form values differ from original settings
   */
  checkForChanges() {
    const currentContextWindow = parseInt(document.getElementById('context-window')?.value, 10);
    const currentTemplate = document.querySelector('input[name="prompt-template"]:checked')?.value || 'standard';
    const currentCustomTemplate = document.getElementById('custom-template-input')?.value?.trim() || '';
    
    const hasChanges = 
      currentContextWindow !== this.originalSettings.contextWindow ||
      currentTemplate !== this.originalSettings.promptTemplateType ||
      currentCustomTemplate !== this.originalSettings.customPromptTemplate;
    
    if (hasChanges !== this.hasUnsavedChanges) {
      this.hasUnsavedChanges = hasChanges;
      if (hasChanges) {
        this.showSaveBar();
      } else {
        this.hideSaveBar();
      }
    }
  }
  
  /**
   * Show the save bar
   */
  showSaveBar() {
    const saveBar = document.getElementById('save-bar');
    if (saveBar) {
      saveBar.classList.remove('hidden');
    }
  }
  
  /**
   * Hide the save bar
   */
  hideSaveBar() {
    const saveBar = document.getElementById('save-bar');
    if (saveBar) {
      saveBar.classList.add('hidden');
    }
    this.hasUnsavedChanges = false;
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
   * Load current tab information
   */
  async loadCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tab;
    } catch (error) {
      console.error('[APE Popup] Failed to load current tab:', error);
    }
  }

  /**
   * Load managed sites from storage
   */
  async loadManagedSites() {
    try {
      const result = await browserCompat.storageGet(['managedSites']);
      this.managedSites = result.managedSites || [];
      console.log('[APE Popup] Loaded managed sites:', this.managedSites);
    } catch (error) {
      console.error('[APE Popup] Failed to load managed sites:', error);
      this.managedSites = [];
    }
  }

  /**
   * Save managed sites to storage
   */
  async saveManagedSites() {
    try {
      await browserCompat.storageSet({ managedSites: this.managedSites });
      console.log('[APE Popup] Saved managed sites:', this.managedSites);
    } catch (error) {
      console.error('[APE Popup] Failed to save managed sites:', error);
    }
  }

  /**
   * Update site management UI
   */
  updateSiteManagement() {
    if (!this.currentTab?.url) return;

    const url = new URL(this.currentTab.url);
    const hostname = url.hostname;

    // Update current site card
    const siteNameElem = document.getElementById('current-site-name');
    const siteUrlElem = document.getElementById('current-site-url');
    const toggleBtn = document.getElementById('toggle-site-btn');

    if (hostname && !hostname.startsWith('chrome') && !hostname.startsWith('about')) {
      const isNativePlatform = this.isNativePlatform(hostname);
      const siteConfig = this.managedSites.find(s => s.hostname === hostname);
      
      // For native platforms: default enabled unless explicitly disabled
      // For custom sites: default disabled unless explicitly enabled
      const defaultState = isNativePlatform ? true : false;
      const isEnabled = siteConfig?.enabled ?? defaultState;

      siteNameElem.textContent = this.getFriendlyName(hostname);
      siteUrlElem.textContent = hostname;

      toggleBtn.disabled = false;
      toggleBtn.classList.toggle('enabled', isEnabled);
      toggleBtn.querySelector('.toggle-site-text').textContent = isEnabled ? 'Disable' : 'Enable';

      // Update event listener
      toggleBtn.onclick = () => this.toggleCurrentSite();
    } else {
      siteNameElem.textContent = 'Not available on this page';
      siteUrlElem.textContent = hostname || '—';
      toggleBtn.disabled = true;
      toggleBtn.classList.remove('enabled');
      toggleBtn.querySelector('.toggle-site-text').textContent = 'Not Available';
    }

    // Update managed sites list
    this.renderManagedSites();
  }

  /**
   * Check if hostname is a native/built-in supported platform
   */
  isNativePlatform(hostname) {
    const nativeDomains = [
      'chatgpt.com',
      'chat.openai.com',
      'claude.ai',
      'gemini.google.com',
      'perplexity.ai',
      'aistudio.google.com'
    ];
    
    return nativeDomains.some(domain => hostname.includes(domain));
  }

  /**
   * Get friendly name for hostname
   */
  getFriendlyName(hostname) {
    if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) return 'ChatGPT';
    if (hostname.includes('claude.ai')) return 'Claude';
    if (hostname.includes('gemini.google.com')) return 'Gemini';
    if (hostname.includes('perplexity.ai')) return 'Perplexity';
    if (hostname.includes('aistudio.google.com')) return 'Google AI Studio';
    return hostname;
  }

  /**
   * Toggle current site enabled/disabled
   */
  async toggleCurrentSite() {
    if (!this.currentTab?.url) return;

    const url = new URL(this.currentTab.url);
    const hostname = url.hostname;

    const isNativePlatform = this.isNativePlatform(hostname);
    const existingIndex = this.managedSites.findIndex(s => s.hostname === hostname);
    
    if (existingIndex >= 0) {
      // Toggle existing site
      this.managedSites[existingIndex].enabled = !this.managedSites[existingIndex].enabled;
    } else {
      // Add new site with opposite of default state
      // Native platforms default to enabled, so add as disabled
      // Custom sites default to disabled, so add as enabled
      this.managedSites.push({
        hostname,
        name: this.getFriendlyName(hostname),
        enabled: !isNativePlatform, // Toggle the default
        addedAt: Date.now()
      });
    }

    await this.saveManagedSites();
    this.updateSiteManagement();

    // Reload the tab to apply changes
    try {
      await chrome.tabs.reload(this.currentTab.id);
    } catch (error) {
      console.log('[APE Popup] Failed to reload tab:', error);
    }
  }

  /**
   * Remove a managed site
   */
  async removeManagedSite(hostname) {
    this.managedSites = this.managedSites.filter(s => s.hostname !== hostname);
    await this.saveManagedSites();
    this.updateSiteManagement();

    // If removing current site, reload the tab
    if (this.currentTab?.url) {
      const currentHostname = new URL(this.currentTab.url).hostname;
      if (currentHostname === hostname) {
        try {
          await chrome.tabs.reload(this.currentTab.id);
        } catch (error) {
          console.log('[APE Popup] Failed to reload tab:', error);
        }
      }
    }
  }

  /**
   * Render managed sites list
   */
  renderManagedSites() {
    const listElem = document.getElementById('managed-sites-list');
    const countElem = document.getElementById('managed-sites-count');

    if (!listElem || !countElem) return;

    countElem.textContent = this.managedSites.length;

    if (this.managedSites.length === 0) {
      listElem.innerHTML = '<div class="managed-sites-empty">No managed sites yet</div>';
      return;
    }

    // Sort by name
    const sortedSites = [...this.managedSites].sort((a, b) => 
      a.name.localeCompare(b.name)
    );

    listElem.innerHTML = sortedSites.map(site => `
      <div class="managed-site-item">
        <div class="managed-site-info">
          <div class="managed-site-details">
            <div class="managed-site-name">${site.name}</div>
            <div class="managed-site-status ${site.enabled ? 'enabled' : 'disabled'}">
              ${site.enabled ? 'Enabled' : 'Disabled'}
            </div>
          </div>
        </div>
        <button class="btn-remove-site" data-hostname="${site.hostname}">
          Remove
        </button>
      </div>
    `).join('');

    // Add event listeners to remove buttons
    listElem.querySelectorAll('.btn-remove-site').forEach(btn => {
      btn.addEventListener('click', () => {
        const hostname = btn.getAttribute('data-hostname');
        this.removeManagedSite(hostname);
      });
    });
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

}

// Initialize popup when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new PopupController();
  });
} else {
  new PopupController();
}
