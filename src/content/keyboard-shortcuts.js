/**
 * Keyboard Shortcuts Handler
 * Manages keyboard shortcuts for quick actions
 */

import browserCompat from '../shared/browser-compat.js';
import { ENHANCEMENT_PRESETS, STORAGE_KEYS } from '../shared/constants.js';

class KeyboardShortcuts {
  constructor(inlineUI, settings) {
    this.inlineUI = inlineUI;
    this.settings = settings;
    this.enabled = true;
    this.quickEditorOpen = false;

    this.init();
  }

  /**
   * Initialize keyboard shortcuts
   */
  init() {
    console.log('[KeyboardShortcuts] Initializing...');

    // Listen for keyboard events
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));

    console.log('[KeyboardShortcuts] Initialized');
  }

  /**
   * Handle keydown events
   */
  handleKeyDown(event) {
    if (!this.enabled) return;

    // Check if Alt key is pressed
    if (!event.altKey) return;

    // Prevent default behavior for our shortcuts
    const key = event.key.toLowerCase();
    const shortcutKeys = ['e', '1', '2', '3', 'c'];

    if (!shortcutKeys.includes(key)) return;

    // Don't interfere if user is typing in certain inputs
    if (this.shouldIgnoreShortcut(event)) return;

    event.preventDefault();
    event.stopPropagation();

    // Handle the shortcut
    this.handleShortcut(key);
  }

  /**
   * Check if we should ignore the shortcut
   */
  shouldIgnoreShortcut(event) {
    const target = event.target;

    // Ignore if the quick editor is focused (but allow Alt+C to close it)
    if (this.quickEditorOpen && event.key.toLowerCase() !== 'c') {
      return false;
    }

    // Allow shortcuts in contenteditable (the chat input)
    if (target.contentEditable === 'true') {
      return false;
    }

    // Allow shortcuts in textarea (the chat input)
    if (target.tagName === 'TEXTAREA') {
      return false;
    }

    // Ignore if user is in a different input/textarea (like settings page)
    if (target.tagName === 'INPUT' && target.type !== 'submit' && target.type !== 'button') {
      return true;
    }

    return false;
  }

  /**
   * Handle a specific shortcut
   */
  async handleShortcut(key) {
    console.log('[KeyboardShortcuts] Shortcut triggered:', key);

    switch (key) {
      case 'e':
        await this.handleEnhanceShortcut();
        break;
      case '1':
      case '2':
      case '3':
        await this.handlePresetShortcut(key);
        break;
      case 'c':
        this.handleCustomEditorShortcut();
        break;
    }
  }

  /**
   * Handle Alt+E - Enhance current prompt
   */
  async handleEnhanceShortcut() {
    if (!this.inlineUI) {
      console.warn('[KeyboardShortcuts] InlineUI not available');
      return;
    }

    console.log('[KeyboardShortcuts] Enhancing prompt via Alt+E');

    // Trigger the enhancement
    await this.inlineUI.handleEnhanceClick();

    // Show feedback
    this.showShortcutFeedback('⚡ Enhancing prompt...');
  }

  /**
   * Handle Alt+1/2/3 - Quick preset switch
   */
  async handlePresetShortcut(key) {
    const shortcutKey = `Alt+${key}`;

    // Get current settings to find the mapped preset
    const settings = await this.getSettings();
    const presetKey = settings.shortcuts?.[shortcutKey];

    if (!presetKey) {
      console.warn('[KeyboardShortcuts] No preset mapped to', shortcutKey);
      this.showShortcutFeedback(`No preset configured for ${shortcutKey}`, 'warning');
      return;
    }

    console.log('[KeyboardShortcuts] Switching to preset:', presetKey);

    // Update the current enhancement type
    settings.currentEnhancementType = presetKey;
    await this.saveSettings(settings);

    // Get preset info for display
    const presetInfo = this.getPresetInfo(presetKey);

    // Show feedback
    this.showShortcutFeedback(
      `${presetInfo.emoji} Switched to ${presetInfo.name}`,
      'success'
    );
  }

  /**
   * Handle Alt+C - Quick custom prompt editor
   */
  handleCustomEditorShortcut() {
    if (this.quickEditorOpen) {
      this.closeQuickEditor();
    } else {
      this.openQuickEditor();
    }
  }

  /**
   * Open quick custom prompt editor
   */
  async openQuickEditor() {
    console.log('[KeyboardShortcuts] Opening quick editor');

    // Get current settings
    const settings = await this.getSettings();

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'ape-quick-editor-modal';
    modal.className = 'ape-quick-editor-modal';
    modal.innerHTML = `
      <div class="ape-quick-editor-content">
        <div class="ape-quick-editor-header">
          <h3>✏️ Custom Enhancement Instructions</h3>
          <button class="ape-quick-editor-close" id="ape-close-quick-editor">×</button>
        </div>

        <div class="ape-quick-editor-body">
          <textarea
            id="ape-quick-custom-prompt"
            rows="8"
            placeholder="Describe how you want prompts to be enhanced...&#10;&#10;Example: Make prompts more detailed, add context from conversation, and structure with clear sections."
            autofocus
          >${settings.customEnhancementPrompt || ''}</textarea>

          <div class="ape-quick-editor-hint">
            <strong>💡 Tip:</strong> Be specific about what improvements you want. The AI will use these instructions.
          </div>
        </div>

        <div class="ape-quick-editor-actions">
          <button id="ape-save-quick-prompt" class="ape-btn ape-btn-primary">
            💾 Save & Apply
          </button>
          <button id="ape-cancel-quick-prompt" class="ape-btn ape-btn-secondary">
            Cancel
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.quickEditorOpen = true;

    // Focus on textarea
    setTimeout(() => {
      const textarea = document.getElementById('ape-quick-custom-prompt');
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      }
    }, 100);

    // Attach event listeners
    this.attachQuickEditorListeners(modal);

    // Animate in
    setTimeout(() => modal.classList.add('ape-show'), 10);
  }

  /**
   * Attach event listeners to quick editor
   */
  attachQuickEditorListeners(modal) {
    const saveBtn = document.getElementById('ape-save-quick-prompt');
    const cancelBtn = document.getElementById('ape-cancel-quick-prompt');
    const closeBtn = document.getElementById('ape-close-quick-editor');
    const textarea = document.getElementById('ape-quick-custom-prompt');

    // Save button
    saveBtn?.addEventListener('click', async () => {
      await this.saveQuickEditorPrompt();
    });

    // Cancel button
    cancelBtn?.addEventListener('click', () => {
      this.closeQuickEditor();
    });

    // Close button
    closeBtn?.addEventListener('click', () => {
      this.closeQuickEditor();
    });

    // Escape key to close
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        this.closeQuickEditor();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.closeQuickEditor();
      }
    });

    // Ctrl+Enter to save
    textarea?.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        this.saveQuickEditorPrompt();
      }
    });
  }

  /**
   * Save quick editor prompt
   */
  async saveQuickEditorPrompt() {
    const textarea = document.getElementById('ape-quick-custom-prompt');
    if (!textarea) return;

    const customPrompt = textarea.value.trim();

    // Get current settings
    const settings = await this.getSettings();
    settings.customEnhancementPrompt = customPrompt;
    settings.currentEnhancementType = 'custom';

    // Save settings
    await this.saveSettings(settings);

    // Show feedback
    this.showShortcutFeedback('🔧 Custom enhancement saved!', 'success');

    // Close editor
    this.closeQuickEditor();

    console.log('[KeyboardShortcuts] Custom prompt saved');
  }

  /**
   * Close quick editor
   */
  closeQuickEditor() {
    const modal = document.getElementById('ape-quick-editor-modal');
    if (!modal) return;

    modal.classList.remove('ape-show');
    setTimeout(() => {
      modal.remove();
      this.quickEditorOpen = false;
    }, 300);
  }

  /**
   * Show shortcut feedback
   */
  showShortcutFeedback(message, type = 'info') {
    // Remove any existing feedback
    const existing = document.querySelector('.ape-shortcut-feedback');
    if (existing) {
      existing.remove();
    }

    const feedback = document.createElement('div');
    feedback.className = `ape-shortcut-feedback ape-shortcut-feedback-${type}`;
    feedback.textContent = message;

    document.body.appendChild(feedback);

    // Animate in
    setTimeout(() => feedback.classList.add('ape-show'), 10);

    // Auto-remove
    setTimeout(() => {
      feedback.classList.remove('ape-show');
      setTimeout(() => feedback.remove(), 300);
    }, 2500);
  }

  /**
   * Get preset information
   */
  getPresetInfo(presetKey) {
    const presetData = {
      concise: { name: 'Concise & Clear', emoji: '🎯' },
      detailed: { name: 'Detailed & Comprehensive', emoji: '📋' },
      balanced: { name: 'Balanced Enhancement', emoji: '⚖️' },
      technical: { name: 'Technical Optimization', emoji: '💻' },
      creative: { name: 'Creative Enhancement', emoji: '✨' },
      custom: { name: 'Custom Enhancement', emoji: '🔧' }
    };

    return presetData[presetKey] || { name: presetKey, emoji: '⭐' };
  }

  /**
   * Get current settings
   */
  async getSettings() {
    try {
      const result = await browserCompat.storage_get([STORAGE_KEYS.SETTINGS]);
      return result[STORAGE_KEYS.SETTINGS] || this.settings || {};
    } catch (error) {
      console.error('[KeyboardShortcuts] Failed to get settings:', error);
      return this.settings || {};
    }
  }

  /**
   * Save settings
   */
  async saveSettings(settings) {
    try {
      await browserCompat.storage_set({
        [STORAGE_KEYS.SETTINGS]: settings
      });

      // Update local reference
      this.settings = settings;

      // Update InlineUI settings
      if (this.inlineUI) {
        this.inlineUI.settings = settings;
      }
    } catch (error) {
      console.error('[KeyboardShortcuts] Failed to save settings:', error);
    }
  }

  /**
   * Enable shortcuts
   */
  enable() {
    this.enabled = true;
    console.log('[KeyboardShortcuts] Enabled');
  }

  /**
   * Disable shortcuts
   */
  disable() {
    this.enabled = false;
    console.log('[KeyboardShortcuts] Disabled');
  }

  /**
   * Destroy and cleanup
   */
  destroy() {
    this.enabled = false;
    this.closeQuickEditor();
  }
}

export default KeyboardShortcuts;
