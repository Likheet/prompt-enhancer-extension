/**
 * Watcher
 * Monitors DOM changes and manages button lifecycle for SPAs
 */

class Watcher {
  constructor(profileManager, promptDetector, buttonController) {
    this.profileManager = profileManager;
    this.promptDetector = promptDetector;
    this.buttonController = buttonController;

    this.observer = null;
    this.currentProfile = null;
    this.currentPromptElement = null;
    this.isRunning = false;

    // Debounce timer for mutations
    this.mutationTimer = null;
    this.mutationDebounceMs = 500;

    // Retry timer for initial detection
    this.retryTimer = null;
    this.maxRetries = 5;
    this.retryCount = 0;
  }

  /**
   * Start watching for prompt fields and DOM changes
   */
  async start() {
    if (this.isRunning) {
      console.log('[Watcher] Already running');
      return;
    }

    console.log('[Watcher] Starting...');
    this.isRunning = true;

    // Wait for page to be ready
    await this.waitForPageReady();

    // Try initial detection
    await this.detectAndMount();

    // Start observing DOM changes
    this.startObserving();

    console.log('[Watcher] Started');
  }

  /**
   * Stop watching and clean up
   */
  stop() {
    console.log('[Watcher] Stopping...');
    this.isRunning = false;

    // Stop observer
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    // Clear timers
    if (this.mutationTimer) {
      clearTimeout(this.mutationTimer);
      this.mutationTimer = null;
    }

    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    // Unmount button
    this.buttonController.unmount();

    this.currentProfile = null;
    this.currentPromptElement = null;

    console.log('[Watcher] Stopped');
  }

  /**
   * Wait for page to be ready
   */
  async waitForPageReady() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      await new Promise(resolve => {
        document.addEventListener('DOMContentLoaded', resolve, { once: true });
      });
    }

    // Additional short delay for dynamic content
    await this.sleep(1000);
  }

  /**
   * Detect prompt field and mount button
   */
  async detectAndMount() {
    console.log('[Watcher] Detecting prompt field...');

    // Get active profile for current URL
    this.currentProfile = this.profileManager.getActiveProfile(window.location.href);

    let detection = null;

    if (this.currentProfile) {
      // Use profile-based detection
      detection = this.promptDetector.detectWithProfile(this.currentProfile);
    } else {
      // Use heuristic detection
      detection = this.promptDetector.detectWithHeuristics();
    }

    if (detection && detection.promptElement) {
      this.currentPromptElement = detection.promptElement;

      // Get placement config
      const placement = this.getPlacementConfig();

      // Mount button
      const success = this.buttonController.mount(
        detection.promptElement,
        detection.anchorElement,
        placement
      );

      if (success) {
        console.log('[Watcher] Button mounted successfully');
        this.retryCount = 0; // Reset retry counter
        return true;
      }
    }

    // Detection failed, retry if we haven't exceeded max retries
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      console.log(`[Watcher] Detection failed, retrying... (${this.retryCount}/${this.maxRetries})`);

      this.retryTimer = setTimeout(() => {
        this.detectAndMount();
      }, 2000);
    } else {
      console.warn('[Watcher] Max retries reached, giving up on initial detection');
    }

    return false;
  }

  /**
   * Get placement configuration (from profile or default)
   */
  getPlacementConfig() {
    if (this.currentProfile) {
      return {
        mode: this.currentProfile.mode || 'inside-bottom-right',
        offsetX: this.currentProfile.offsetX || '12px',
        offsetY: this.currentProfile.offsetY || '12px',
        size: this.currentProfile.size || '32px'
      };
    } else {
      // Use default profile
      const defaultProfile = this.profileManager.getDefaultProfile();
      return {
        mode: defaultProfile.mode || 'inside-bottom-right',
        offsetX: defaultProfile.offsetX || '12px',
        offsetY: defaultProfile.offsetY || '12px',
        size: defaultProfile.size || '32px'
      };
    }
  }

  /**
   * Start observing DOM changes
   */
  startObserving() {
    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false
    });

    console.log('[Watcher] MutationObserver started');
  }

  /**
   * Handle DOM mutations (debounced)
   */
  handleMutations(mutations) {
    if (!this.isRunning) return;

    // Debounce mutations to avoid excessive processing
    if (this.mutationTimer) {
      clearTimeout(this.mutationTimer);
    }

    this.mutationTimer = setTimeout(() => {
      this.processMutations(mutations);
    }, this.mutationDebounceMs);
  }

  /**
   * Process mutations and decide if we need to remount
   */
  async processMutations(mutations) {
    // Check if button is still mounted and valid
    if (this.buttonController.isMounted()) {
      // Check if prompt element still exists and is valid
      if (this.currentPromptElement &&
          document.body.contains(this.currentPromptElement) &&
          this.isElementValid(this.currentPromptElement)) {
        // All good, nothing to do
        return;
      }
    }

    // Button detached or prompt element gone, need to remount
    console.log('[Watcher] Button or prompt element detached, remounting...');

    // Unmount old button
    this.buttonController.unmount();

    // Check if we need to update the profile (URL might have changed in SPA)
    const newProfile = this.profileManager.getActiveProfile(window.location.href);
    const profileChanged = (newProfile?.id !== this.currentProfile?.id);

    if (profileChanged) {
      console.log('[Watcher] Profile changed, updating...');
      this.currentProfile = newProfile;
    }

    // Try to detect and mount again
    await this.detectAndMount();
  }

  /**
   * Check if element is still valid
   */
  isElementValid(element) {
    if (!element || !element.isConnected) return false;

    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;

    const style = window.getComputedStyle(element);
    if (style.display === 'none') return false;
    if (style.visibility === 'hidden') return false;

    return true;
  }

  /**
   * Manually trigger remount (useful for debugging or forced refresh)
   */
  async remount() {
    console.log('[Watcher] Manual remount triggered');
    this.buttonController.unmount();
    this.currentProfile = null;
    this.currentPromptElement = null;
    await this.detectAndMount();
  }

  /**
   * Helper: sleep for ms milliseconds
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default Watcher;
