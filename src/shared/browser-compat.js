/**
 * Browser Compatibility Layer
 * Provides unified API for Chrome and Firefox
 */
class BrowserCompat {
  constructor() {
    this.browser = this.detectBrowser();
    this.api = this.getBrowserAPI();
  }

  detectBrowser() {
    if (typeof browser !== 'undefined' && browser.runtime) {
      return 'firefox';
    }
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      return 'chrome';
    }
    return 'unknown';
  }

  getBrowserAPI() {
    return (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;
  }

  // Unified storage API with promises
  async storageGet(keys) {
    return new Promise((resolve, reject) => {
      this.api.storage.local.get(keys, (result) => {
        if (this.api.runtime.lastError) {
          reject(this.api.runtime.lastError);
        } else {
          resolve(result);
        }
      });
    });
  }

  async storageSet(items) {
    return new Promise((resolve, reject) => {
      this.api.storage.local.set(items, () => {
        if (this.api.runtime.lastError) {
          reject(this.api.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  async storageRemove(keys) {
    return new Promise((resolve, reject) => {
      this.api.storage.local.remove(keys, () => {
        if (this.api.runtime.lastError) {
          reject(this.api.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  // Message passing abstraction
  async sendMessage(message) {
    return new Promise((resolve, reject) => {
      this.api.runtime.sendMessage(message, (response) => {
        if (this.api.runtime.lastError) {
          reject(this.api.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
  }

  // Listen for messages
  onMessage(callback) {
    this.api.runtime.onMessage.addListener(callback);
  }

  // Get extension URL
  getURL(path) {
    return this.api.runtime.getURL(path);
  }
}

// Export singleton instance
const browserCompat = new BrowserCompat();
export default browserCompat;
