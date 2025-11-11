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
    
    if (this.inlineUI) {
      this.inlineUI.destroy();
      this.inlineUI = null;
    }
    
    this.domObserver = null;
    this.contextExtractor = null;
    this.promptEnhancer = null;
    this.keyboardShortcuts = null;
    this.initialized = false;
  }

  /**
   * Initialize the extension
   */
  async initialize() {
    if (this.initialized) return;

    console.log('[APE] Initializing AI Prompt Enhancer...');

    try {
      // Wait for page to be ready
      if (document.readyState === 'loading') {
        await new Promise(resolve => {
          document.addEventListener('DOMContentLoaded', resolve);
        });
      }

      // Additional wait for dynamic content to load
      await this.waitForPageReady();

      // Load settings
      this.settings = await this.loadSettings();

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
   * Wait for page to be ready for manipulation
   */
  async waitForPageReady() {
    return new Promise((resolve) => {
      // Wait a bit for dynamic content
      setTimeout(resolve, 2000);
    });
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
