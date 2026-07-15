/**
 * Popup Script
 * Handles settings and subscription management UI
 */

import browserCompat from '../shared/browser-compat.js';
import { DEFAULT_SETTINGS, SITE_PLACEMENTS } from '../shared/constants.js';
import { matchesHostname, renderStaticHTML, sanitizeHTML } from '../shared/utils.js';
import {
  isConfigurableUrl,
  resolveSitePreferences,
  upsertSitePreference
} from '../shared/site-preferences.js';

class PopupController {
  constructor() {
    this.settings = null;
    this.subscription = null;
    this.originalSettings = null; // Track original values for change detection
    this.hasUnsavedChanges = false;
    this.currentTab = null;
    this.managedSites = [];
    this.lastFocusedElement = null;
    this.handleSettingsKeydown = this.handleSettingsKeydown.bind(this);
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
      this.settings = { ...DEFAULT_SETTINGS };
      this.originalSettings = JSON.parse(JSON.stringify(this.settings));
      this.subscription = { type: 'free' };
      this.updateStats({ totalEnhancements: 0, byokEnhancements: 0 });
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    document.querySelectorAll('.save-provider-key').forEach((button) => {
      button.addEventListener('click', () => this.saveAPIKey(button.dataset.provider));
    });

    document.querySelectorAll('.clear-provider-key').forEach((button) => {
      button.addEventListener('click', () => this.removeAPIKey(button.dataset.provider));
    });

    document.querySelectorAll('.toggle-provider-key').forEach((button) => {
      button.addEventListener('click', () => this.toggleKeyVisibility(button.dataset.provider));
    });

    document.getElementById('provider-mode')?.addEventListener('change', (event) => {
      void this.saveProviderMode(event.target.value);
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
    document.getElementById('conversation-awareness')?.addEventListener('change', () => {
      this.updateContextControlState();
      this.checkForChanges();
    });

    const openSettings = document.getElementById('open-settings');
    openSettings?.addEventListener('click', () => this.openSettingsPanel());
    document.querySelectorAll('[data-close-settings]').forEach((el) => {
      el.addEventListener('click', () => this.closeSettingsPanel());
    });
    document.getElementById('site-placement')?.addEventListener('change', (event) => {
      this.changeCurrentSitePlacement(event.target.value);
    });

    document.querySelectorAll('[data-popup-tab]').forEach((tab) => {
      tab.addEventListener('click', () => this.selectTab(tab.dataset.popupTab));
      tab.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        const tabs = [...document.querySelectorAll('[data-popup-tab]')];
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        const nextIndex = (tabs.indexOf(tab) + direction + tabs.length) % tabs.length;
        tabs[nextIndex].focus();
        tabs[nextIndex].click();
      });
    });

    // Load current settings into form
    this.loadSettingsIntoForm();
  }

  selectTab(tabName) {
    document.querySelectorAll('[data-popup-tab]').forEach((tab) => {
      const isActive = tab.dataset.popupTab === tabName;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
    });

    document.querySelectorAll('[data-popup-panel]').forEach((panel) => {
      const isActive = panel.dataset.popupPanel === tabName;
      panel.classList.toggle('active', isActive);
      panel.hidden = !isActive;
    });

    const content = document.querySelector('.popup-content');
    if (content) content.scrollTop = 0;
  }

  /**
   * Update UI based on API key status
   */
  updateUI() {
    const providerMode = document.getElementById('provider-mode');
    if (providerMode) providerMode.value = this.subscription?.providerMode || 'auto';

    ['gemini', 'groq'].forEach((provider) => {
      const configured = Boolean(this.subscription?.providers?.[provider]?.configured);
      const status = document.getElementById(`${provider}-status`);
      const clearButton = document.querySelector(`.clear-provider-key[data-provider="${provider}"]`);
      if (status) {
        status.textContent = configured ? 'Configured' : 'Not configured';
        status.classList.toggle('configured', configured);
      }
      clearButton?.classList.toggle('hidden', !configured);
    });
  }

  /**
   * Save API key
   */
  async saveAPIKey(provider) {
    const label = provider === 'groq' ? 'Groq' : 'Gemini';
    const apiKeyInput = document.getElementById(`${provider}-api-key`);
    const apiKey = apiKeyInput?.value?.trim();

    if (!apiKey) {
      this.showStatus(`Enter a ${label} API key`, 'error');
      return;
    }

    const saveBtn = document.querySelector(`.save-provider-key[data-provider="${provider}"]`);
    if (saveBtn) {
      saveBtn.textContent = 'Validating...';
      saveBtn.disabled = true;
      saveBtn.setAttribute('aria-busy', 'true');
    }

    try {
      const response = await browserCompat.sendMessage({
        action: 'saveProviderKey',
        data: { provider, apiKey }
      });

      if (response.success) {
        this.showStatus(`${label} API key saved`, 'success');

        // Clear input
        if (apiKeyInput) apiKeyInput.value = '';

        // Reload data and update UI
        await this.loadData();
        this.updateUI();
      } else {
        this.showStatus(`Failed: ${response.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('[APE Popup] Save API key error:', error);
      this.showStatus('Failed to save API key', 'error');
    } finally {
      if (saveBtn) {
        saveBtn.textContent = 'Save';
        saveBtn.disabled = false;
        saveBtn.removeAttribute('aria-busy');
      }
    }
  }

  /**
   * Remove API key
   */
  async removeAPIKey(provider) {
    const label = provider === 'groq' ? 'Groq' : 'Gemini';
    if (!confirm(`Clear the ${label} API key?`)) {
      return;
    }

    try {
      const response = await browserCompat.sendMessage({
        action: 'clearProviderKey',
        data: { provider }
      });

      if (response.success) {
        this.showStatus(`${label} API key cleared`, 'success');

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
  toggleKeyVisibility(provider) {
    const label = provider === 'groq' ? 'Groq' : 'Gemini';
    const apiKeyInput = document.getElementById(`${provider}-api-key`);
    const toggleBtn = document.querySelector(`.toggle-provider-key[data-provider="${provider}"]`);

    if (apiKeyInput && toggleBtn) {
      if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        toggleBtn.textContent = 'Hide';
        toggleBtn.setAttribute('aria-label', `Hide ${label} API key`);
      } else {
        apiKeyInput.type = 'password';
        toggleBtn.textContent = 'Show';
        toggleBtn.setAttribute('aria-label', `Show ${label} API key`);
      }
    }
  }

  async saveProviderMode(providerMode) {
    try {
      const response = await browserCompat.sendMessage({
        action: 'setProviderMode',
        data: { providerMode }
      });
      if (!response?.success) throw new Error(response?.error || 'Failed to save provider');
      await this.loadData();
      this.updateUI();
    } catch (error) {
      this.showStatus('Failed to save provider selection', 'error');
    }
  }

  isSettingsOpen() {
    const layer = document.getElementById('settings-layer');
    return layer?.getAttribute('aria-hidden') === 'false';
  }

  openSettingsPanel() {
    const layer = document.getElementById('settings-layer');
    const panel = document.getElementById('settings-panel');
    const opener = document.getElementById('open-settings');
    if (!layer || !panel || this.isSettingsOpen()) return;

    this.lastFocusedElement = document.activeElement;
    layer.setAttribute('aria-hidden', 'false');
    panel.setAttribute('aria-hidden', 'false');
    opener?.setAttribute('aria-expanded', 'true');
    document.addEventListener('keydown', this.handleSettingsKeydown);

    setTimeout(() => {
      const input = document.getElementById('provider-mode');
      (input || panel.querySelector('button, input, select, textarea, a[href]'))?.focus({ preventScroll: true });
    }, 0);
  }

  closeSettingsPanel() {
    const layer = document.getElementById('settings-layer');
    const panel = document.getElementById('settings-panel');
    const opener = document.getElementById('open-settings');
    if (!layer || !panel || !this.isSettingsOpen()) return;

    layer.setAttribute('aria-hidden', 'true');
    panel.setAttribute('aria-hidden', 'true');
    opener?.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', this.handleSettingsKeydown);

    const focusTarget = this.lastFocusedElement?.isConnected ? this.lastFocusedElement : opener;
    this.lastFocusedElement = null;
    focusTarget?.focus({ preventScroll: true });
  }

  handleSettingsKeydown(event) {
    if (!this.isSettingsOpen()) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeSettingsPanel();
      return;
    }

    if (event.key !== 'Tab') return;

    const panel = document.getElementById('settings-panel');
    const focusable = [...(panel?.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ) || [])].filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
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
    const conversationAwareness = document.getElementById('conversation-awareness');
    if (conversationAwareness) {
      conversationAwareness.checked = this.settings.conversationAwareness !== false;
    }
    this.updateContextControlState();
  }

  updateContextControlState() {
    const enabled = document.getElementById('conversation-awareness')?.checked !== false;
    const contextWindow = document.getElementById('context-window');
    if (contextWindow) contextWindow.disabled = !enabled;
  }

  /**
   * Save settings
   */
  async saveSettings() {
    const contextWindowValue = parseInt(document.getElementById('context-window')?.value, 10);
    const conversationAwareness = document.getElementById('conversation-awareness')?.checked !== false;
    const templateType = document.querySelector('input[name="prompt-template"]:checked')?.value || 'standard';
    const customTemplate = document.getElementById('custom-template-input')?.value?.trim() || '';

    const resolvedContextWindow = Number.isFinite(contextWindowValue)
      ? contextWindowValue
      : (this.settings?.contextWindow ?? DEFAULT_SETTINGS.contextWindow);

    const newSettings = {
      ...this.settings,
      conversationAwareness,
      contextWindow: resolvedContextWindow,
      promptTemplateType: templateType,
      customPromptTemplate: customTemplate
    };

    const saveBtn = document.getElementById('save-settings');
    if (saveBtn) {
      saveBtn.textContent = 'Saving...';
      saveBtn.disabled = true;
      saveBtn.setAttribute('aria-busy', 'true');
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
        saveBtn.textContent = 'Save changes';
        saveBtn.disabled = false;
        saveBtn.removeAttribute('aria-busy');
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
    const currentConversationAwareness = document.getElementById('conversation-awareness')?.checked !== false;
    const currentTemplate = document.querySelector('input[name="prompt-template"]:checked')?.value || 'standard';
    const currentCustomTemplate = document.getElementById('custom-template-input')?.value?.trim() || '';
    
    const hasChanges = 
      currentConversationAwareness !== (this.originalSettings.conversationAwareness !== false) ||
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
  
  showSaveBar() {
    const saveBar = document.getElementById('save-bar');
    if (!saveBar) return;
    saveBar.classList.remove('hidden');
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
   * Update usage — render as a single sentence so the numbers
   * carry context instead of standing as a stat monument.
   */
  updateStats(stats) {
    const target = document.getElementById('usage-sentence');
    if (!target) return;

    const total = Number(stats?.totalEnhancements) || 0;
    const byok = Number(stats?.byokEnhancements) || 0;

    if (total === 0 && byok === 0) {
      renderStaticHTML(target, '<span class="usage-sentence-empty">No enhancements yet.</span>');
      return;
    }

    const totalLabel = total === 1 ? 'enhancement' : 'enhancements';
    const byokFragment = byok > 0
      ? ' &middot; <span class="usage-sentence-byok"><span class="usage-sentence-value">' + byok + '</span> with your own key</span>'
      : '';

    renderStaticHTML(
      target,
      '<span class="usage-sentence-value">' + total + '</span> ' + totalLabel + byokFragment + '.'
    );
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
      return true;
    } catch (error) {
      console.error('[APE Popup] Failed to save managed sites:', error);
      return false;
    }
  }

  /**
   * Update site management UI
   */
  updateSiteManagement() {
    if (!this.currentTab?.url) return;

    const configurable = isConfigurableUrl(this.currentTab.url);
    const url = configurable ? new URL(this.currentTab.url) : null;
    const hostname = url?.hostname || '';

    // Update current site card
    const siteNameElem = document.getElementById('current-site-name');
    const siteUrlElem = document.getElementById('current-site-url');
    const toggleBtn = document.getElementById('toggle-site-btn');
    const placementSelect = document.getElementById('site-placement');
    const heroStatus = document.getElementById('hero-site-status');
    const headerSiteState = document.getElementById('header-site-state');

    if (configurable) {
      const preferences = resolveSitePreferences({
        hostname,
        title: this.currentTab.title || '',
        managedSites: this.managedSites
      });
      const isEnabled = preferences.enabled;

      siteNameElem.textContent = this.getFriendlyName(hostname);
      siteUrlElem.textContent = hostname;
      toggleBtn.disabled = false;
      toggleBtn.classList.toggle('enabled', isEnabled);
      toggleBtn.querySelector('.toggle-site-text').textContent = isEnabled ? 'Turn off' : 'Turn on';
      heroStatus?.classList.toggle('inactive', !isEnabled);
      heroStatus?.classList.remove('unavailable');
      if (headerSiteState) {
        headerSiteState.textContent = isEnabled
          ? `Active on ${this.getFriendlyName(hostname)}`
          : `Paused on ${this.getFriendlyName(hostname)}`;
      }

      // Update event listener
      toggleBtn.onclick = () => this.toggleCurrentSite();
      if (placementSelect) {
        placementSelect.disabled = false;
        placementSelect.value = preferences.placement;
      }
    } else {
      siteNameElem.textContent = 'Not available on this page';
      siteUrlElem.textContent = hostname || '—';
      toggleBtn.disabled = true;
      toggleBtn.classList.remove('enabled');
      toggleBtn.querySelector('.toggle-site-text').textContent = 'Unavailable';
      heroStatus?.classList.remove('inactive');
      heroStatus?.classList.add('unavailable');
      if (headerSiteState) headerSiteState.textContent = 'Open an AI chat to manage this site';
      if (placementSelect) {
        placementSelect.disabled = true;
        placementSelect.value = SITE_PLACEMENTS.AUTO;
      }
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
    
    return nativeDomains.some(domain => matchesHostname(hostname, domain));
  }

  /**
   * Get friendly name for hostname
   */
  getFriendlyName(hostname) {
    if (matchesHostname(hostname, 'chatgpt.com') || matchesHostname(hostname, 'chat.openai.com')) return 'ChatGPT';
    if (matchesHostname(hostname, 'claude.ai')) return 'Claude';
    if (matchesHostname(hostname, 'gemini.google.com')) return 'Gemini';
    if (matchesHostname(hostname, 'perplexity.ai')) return 'Perplexity';
    if (matchesHostname(hostname, 'aistudio.google.com')) return 'Google AI Studio';
    return hostname;
  }

  /**
   * Toggle current site enabled/disabled
   */
  async toggleCurrentSite() {
    if (!this.currentTab?.url) return;

    const url = new URL(this.currentTab.url);
    const hostname = url.hostname;

    const preferences = resolveSitePreferences({
      hostname,
      title: this.currentTab.title || '',
      managedSites: this.managedSites
    });
    const previousSites = this.managedSites;
    this.managedSites = upsertSitePreference(
      this.managedSites,
      hostname,
      { enabled: !preferences.enabled },
      this.getFriendlyName(hostname)
    );

    const saved = await this.saveManagedSites();
    if (!saved) {
      this.managedSites = previousSites;
      this.updateSiteManagement();
      return;
    }
    this.updateSiteManagement();

    // Reload the tab to apply changes
    try {
      await chrome.tabs.reload(this.currentTab.id);
    } catch (error) {
      if (globalThis.__APE_DEBUG__ === true) console.warn('[APE Popup] Failed to reload tab:', error);
    }
  }

  async changeCurrentSitePlacement(placement) {
    if (!this.currentTab?.url || !isConfigurableUrl(this.currentTab.url)) return;
    if (!Object.values(SITE_PLACEMENTS).includes(placement)) return;

    const hostname = new URL(this.currentTab.url).hostname;
    const preferences = resolveSitePreferences({
      hostname,
      title: this.currentTab.title || '',
      managedSites: this.managedSites
    });
    const previousSites = this.managedSites;
    this.managedSites = upsertSitePreference(
      this.managedSites,
      hostname,
      { enabled: preferences.enabled, placement },
      this.getFriendlyName(hostname)
    );

    const saved = await this.saveManagedSites();
    if (!saved) {
      this.managedSites = previousSites;
      this.updateSiteManagement();
      return;
    }
    this.updateSiteManagement();
    try {
      await chrome.tabs.reload(this.currentTab.id);
    } catch (error) {
      if (globalThis.__APE_DEBUG__ === true) console.warn('[APE Popup] Failed to reload tab:', error);
    }
  }

  /**
   * Remove a managed site
   */
  async removeManagedSite(hostname) {
    const previousSites = this.managedSites;
    this.managedSites = this.managedSites.filter(s => s.hostname !== hostname);
    const saved = await this.saveManagedSites();
    if (!saved) {
      this.managedSites = previousSites;
      this.updateSiteManagement();
      return;
    }
    this.updateSiteManagement();

    // If removing current site, reload the tab
    if (this.currentTab?.url) {
      const currentHostname = new URL(this.currentTab.url).hostname;
      if (currentHostname === hostname) {
        try {
          await chrome.tabs.reload(this.currentTab.id);
        } catch (error) {
          if (globalThis.__APE_DEBUG__ === true) console.warn('[APE Popup] Failed to reload tab:', error);
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
      renderStaticHTML(listElem, '<div class="managed-sites-empty">No saved site settings.</div>');
      return;
    }

    // Sort by name
    const sortedSites = [...this.managedSites].sort((a, b) => 
      a.name.localeCompare(b.name)
    );

    const managedSiteMarkup = sortedSites.map(site => `
      <div class="managed-site-item">
        <div class="managed-site-info">
          <div class="managed-site-details">
            <div class="managed-site-name">${sanitizeHTML(site.name || site.hostname)}</div>
            <div class="managed-site-status ${site.enabled ? 'enabled' : 'disabled'}">
              <span class="managed-site-state">${site.enabled ? 'On' : 'Off'}</span>
              <span aria-hidden="true">·</span>
              <span class="managed-site-placement">${this.formatPlacement(site.placement)}</span>
            </div>
          </div>
        </div>
        <button class="btn-remove-site" data-hostname="${sanitizeHTML(site.hostname)}">
          Remove
        </button>
      </div>
    `).join('');

    renderStaticHTML(listElem, managedSiteMarkup);

    // Add event listeners to remove buttons
    listElem.querySelectorAll('.btn-remove-site').forEach(btn => {
      btn.addEventListener('click', () => {
        const hostname = btn.getAttribute('data-hostname');
        this.removeManagedSite(hostname);
      });
    });
  }

  formatPlacement(placement) {
    const labels = {
      auto: 'Auto position',
      'before-attach': 'Before Attach',
      'after-attach': 'After Attach',
      'before-send': 'Before Send',
      'composer-end': 'Composer edge'
    };
    return labels[placement] || labels.auto;
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
