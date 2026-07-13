/**
 * Main Content Script
 * Entry point for the extension on AI chat pages
 */

import ResilientDOMObserver from './dom-observer.js';
import ContextExtractor from './context-extractor.js';
import InlineUI from './inline-ui.js';
import KeyboardShortcuts from './keyboard-shortcuts.js';
import browserCompat from '../shared/browser-compat.js';
import { resolveSitePreferences } from '../shared/site-preferences.js';

class AIPromptEnhancerExtension {
  constructor() {
    this.domObserver = null;
    this.contextExtractor = null;
    this.inlineUI = null;
    this.keyboardShortcuts = null;
    this.settings = null;
    this.initialized = false;
    this.initializing = false;
    this.contextInvalidated = false;
    this.contextMonitorPort = null;
  }

  /**
   * Cleanup all resources
   */
  destroy() {
    if (this.keyboardShortcuts) {
      this.keyboardShortcuts.destroy();
      this.keyboardShortcuts = null;
    }

    if (this.inlineUI) {
      this.inlineUI.destroy();
      this.inlineUI = null;
    }

    if (this.domObserver) {
      this.domObserver.disconnect();
      this.domObserver = null;
    }

    this.contextExtractor = null;
    this.initialized = false;
    this.initializing = false;
    this.contextMonitorPort = null;
  }

  /**
   * Stop an asynchronous initialization from recreating UI after the extension
   * has been reloaded and this content script is no longer valid.
   */
  shouldAbortInitialization() {
    return this.contextInvalidated || !browserCompat.isContextValid();
  }

  /**
   * Initialize the extension
   */
  async initialize() {
    if (this.initialized || this.initializing || this.shouldAbortInitialization()) return;

    this.initializing = true;

    try {
      // Check if site is disabled
      const hostname = window.location.hostname;
      const sitePreferences = await this.getSitePreferences(hostname);
      if (this.shouldAbortInitialization()) return;

      if (!sitePreferences.enabled) {
        return;
      }

      // Wait for page to be ready
      if (document.readyState === 'loading') {
        await new Promise(resolve => {
          document.addEventListener('DOMContentLoaded', resolve);
        });
      }
      if (this.shouldAbortInitialization()) return;

      // Load settings
      this.settings = {
        ...(await this.loadSettings()),
        sitePlacement: sitePreferences.placement
      };
      if (this.shouldAbortInitialization()) return;

      // Initialize components
      this.domObserver = new ResilientDOMObserver();
      this.contextExtractor = new ContextExtractor(this.domObserver);
      this.contextExtractor.setContextWindow(this.settings.contextWindow);
      this.contextExtractor.setConversationAwareness(this.settings.conversationAwareness);

      // Initialize UI
      this.inlineUI = new InlineUI(
        this.contextExtractor,
        this.domObserver,
        this.settings
      );

      // Initialize keyboard shortcuts
      this.keyboardShortcuts = new KeyboardShortcuts(
        this.inlineUI,
        this.settings
      );

      this.initialized = true;

      // Track initialization
      await this.trackEvent('extension_initialized', {
        platform: this.domObserver.platform
      });
    } catch (error) {
      if (!this.shouldAbortInitialization()) {
        console.error('[APE] Initialization failed:', error);
      }
    } finally {
      this.initializing = false;
    }
  }

  /**
   * Check if site should be enabled
   */
  async getSitePreferences(hostname) {
    try {
      const preferences = await browserCompat.sendMessage({
        action: 'getSitePreferences',
        data: {
          hostname,
          title: document.title
        }
      });
      return preferences;
    } catch (error) {
      console.error('[APE] Failed to check site status:', error);
      return resolveSitePreferences({
        hostname,
        title: document.title,
        managedSites: []
      });
    }
  }

  /**
   * Load settings from storage
   */
  async loadSettings() {
    try {
      const response = await browserCompat.sendMessage({
        action: 'getSettings'
      });
      return response;
    } catch (error) {
      console.error('[APE] Failed to load settings:', error);

      // Return defaults
      const { DEFAULT_SETTINGS } = await import('../shared/constants.js');
      return DEFAULT_SETTINGS;
    }
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

function invalidateExtensionContext(extension) {
  if (!extension || extension.contextInvalidated) return;

  console.warn('[APE] Extension context invalidated. Please refresh the page.');
  extension.contextInvalidated = true;
  extension.destroy();
}

function setupExtensionContextMonitor(extension) {
  if (!browserCompat.isContextValid()) {
    invalidateExtensionContext(extension);
    return null;
  }

  try {
    const port = browserCompat.runtime.connect({ name: 'ape-context-lifecycle' });
    extension.contextMonitorPort = port;

    port.onDisconnect.addListener(() => {
      if (!browserCompat.isContextValid()) {
        invalidateExtensionContext(extension);
      }
    });

    return port;
  } catch (error) {
    if (!browserCompat.isContextValid()) {
      invalidateExtensionContext(extension);
    } else {
      console.warn('[APE] Could not establish extension lifecycle monitor:', error);
    }
    return null;
  }
}

// Prevent multiple initializations
if (!window.APE_Extension || (
  !window.APE_Extension.initialized &&
  !window.APE_Extension.initializing &&
  !window.APE_Extension.contextInvalidated
)) {
  const extension = new AIPromptEnhancerExtension();

  // Export for debugging
  window.APE_Extension = extension;

  setupExtensionContextMonitor(extension);
  extension.initialize();
}

export { AIPromptEnhancerExtension, setupExtensionContextMonitor };
