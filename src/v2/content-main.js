/**
 * Main Content Script
 * Entry point that initializes and connects all components
 */

import ProfileManager from './profile-manager.js';
import PromptDetector from './prompt-detector.js';
import ButtonController from './button-controller.js';
import Watcher from './watcher.js';

/**
 * Main application class
 */
class PromptEnhancerApp {
  constructor() {
    this.profileManager = null;
    this.promptDetector = null;
    this.buttonController = null;
    this.watcher = null;
    this.initialized = false;
  }

  /**
   * Initialize the application
   */
  async initialize() {
    if (this.initialized) {
      console.log('[PromptEnhancer] Already initialized');
      return;
    }

    console.log('[PromptEnhancer] Initializing...');

    try {
      // Initialize ProfileManager
      this.profileManager = new ProfileManager();
      await this.profileManager.initialize();

      // Initialize PromptDetector with default profile settings
      const defaultProfile = this.profileManager.getDefaultProfile();
      this.promptDetector = new PromptDetector(defaultProfile);

      // Initialize ButtonController
      this.buttonController = new ButtonController();

      // Initialize Watcher
      this.watcher = new Watcher(
        this.profileManager,
        this.promptDetector,
        this.buttonController
      );

      // Start watching
      await this.watcher.start();

      this.initialized = true;
      console.log('[PromptEnhancer] Initialization complete');

      // Expose to window for debugging
      window.__PromptEnhancer__ = {
        app: this,
        profileManager: this.profileManager,
        promptDetector: this.promptDetector,
        buttonController: this.buttonController,
        watcher: this.watcher,
        // Utility functions for debugging
        remount: () => this.watcher.remount(),
        getActiveProfile: () => this.profileManager.getActiveProfile(window.location.href),
        getAllProfiles: () => this.profileManager.getAllProfiles(),
        resetProfiles: () => this.profileManager.resetToDefaults()
      };

      console.log('[PromptEnhancer] Debug interface available at window.__PromptEnhancer__');

    } catch (error) {
      console.error('[PromptEnhancer] Initialization failed:', error);
    }
  }

  /**
   * Cleanup and destroy
   */
  destroy() {
    console.log('[PromptEnhancer] Destroying...');

    if (this.watcher) {
      this.watcher.stop();
    }

    this.initialized = false;
    console.log('[PromptEnhancer] Destroyed');
  }
}

// Create and initialize app instance
const app = new PromptEnhancerApp();
app.initialize();

// Handle page visibility changes (for better resource management)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    console.log('[PromptEnhancer] Page hidden');
    // Could pause some operations here if needed
  } else {
    console.log('[PromptEnhancer] Page visible');
    // Could resume operations here if needed
  }
});

// Handle extension updates/reloads
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'RELOAD_EXTENSION') {
    console.log('[PromptEnhancer] Reloading extension...');
    app.destroy();
    app.initialize();
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'REMOUNT_BUTTON') {
    console.log('[PromptEnhancer] Remounting button...');
    app.watcher.remount();
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'GET_STATUS') {
    sendResponse({
      initialized: app.initialized,
      buttonMounted: app.buttonController?.isMounted() || false,
      currentProfile: app.watcher?.currentProfile?.id || null,
      url: window.location.href
    });
    return true;
  }
});

// Export for module usage (if needed)
export default app;
