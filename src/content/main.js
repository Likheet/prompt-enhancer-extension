/**
 * Main Content Script
 * Entry point for the extension on AI chat pages
 */

import ResilientDOMObserver from './dom-observer.js';
import ContextExtractor from './context-extractor.js';
import PromptEnhancer from './prompt-enhancer.js';
import InlineUI from './inline-ui.js';
import KeyboardShortcuts from './keyboard-shortcuts.js';
import browserCompat from '../shared/browser-compat.js';
import { resolveSitePreferences } from '../shared/site-preferences.js';

class AIPromptEnhancerExtension {
  constructor() {
    this.domObserver = null;
    this.contextExtractor = null;
    this.promptEnhancer = null;
    this.inlineUI = null;
    this.keyboardShortcuts = null;
    this.settings = null;
    this.initialized = false;
    this.contextInvalidated = false;
  }

  /**
   * Cleanup all resources
   */
  destroy() {
    console.log('[APE] Destroying extension instance...');

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
    this.promptEnhancer = null;
    this.initialized = false;
  }

  /**
   * Initialize the extension
   */
  async initialize() {
    if (this.initialized) return;

    console.log('[APE] Initializing AI Prompt Enhancer...');

    try {
      // Check if site is disabled
      const hostname = window.location.hostname;
      const sitePreferences = await this.getSitePreferences(hostname);

      if (!sitePreferences.enabled) {
        console.log('[APE] Extension disabled for this site:', hostname);
        return;
      }

      // Wait for page to be ready
      if (document.readyState === 'loading') {
        await new Promise(resolve => {
          document.addEventListener('DOMContentLoaded', resolve);
        });
      }

      // Load settings
      this.settings = {
        ...(await this.loadSettings()),
        sitePlacement: sitePreferences.placement
      };

      // Initialize components
      this.domObserver = new ResilientDOMObserver();
      this.contextExtractor = new ContextExtractor(this.domObserver);

      // Create a mock subscription manager for content script
      const mockSubManager = {
        getActiveSubscription: async () => {
          const response = await browserCompat.sendMessage({
            action: 'getSubscription'
          });
          return response;
        }
      };

      this.promptEnhancer = new PromptEnhancer(mockSubManager);

      // Initialize UI
      this.inlineUI = new InlineUI(
        this.promptEnhancer,
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
      console.log('[APE] Initialization complete');

      // Track initialization
      await this.trackEvent('extension_initialized', {
        platform: this.domObserver.platform
      });
    } catch (error) {
      console.error('[APE] Initialization failed:', error);
    }
  }

  /**
   * Check if site should be enabled
   */
  async getSitePreferences(hostname) {
    try {
      const result = await browserCompat.storageGet(['managedSites']);
      const managedSites = result.managedSites || [];
      const preferences = resolveSitePreferences({
        hostname,
        title: document.title,
        managedSites
      });
      console.log('[APE] Site preferences:', hostname, preferences);
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

// Prevent multiple initializations
if (!window.APE_Extension || !window.APE_Extension.initialized) {
  console.log('[APE] Starting new extension instance');
  const extension = new AIPromptEnhancerExtension();
  extension.initialize();

  // Export for debugging
  window.APE_Extension = extension;

  // Detect extension context invalidation
  try {
    const port = browserCompat.runtime.connect({ name: 'keepalive' });
    port.onDisconnect.addListener(() => {
      console.warn('[APE] Extension context invalidated. Please refresh the page.');
      // Mark extension as invalidated
      if (window.APE_Extension) {
        window.APE_Extension.contextInvalidated = true;
      }
    });
  } catch (error) {
    console.warn('[APE] Could not establish keepalive connection:', error);
  }
} else {
  console.log('[APE] Extension already initialized, skipping...');
}
