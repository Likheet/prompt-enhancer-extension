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

  // Check if extension context is valid
  isContextValid() {
    try {
      return !!(this.api && this.api.runtime && this.api.runtime.id);
    } catch (error) {
      return false;
    }
  }

  // Unified storage API with promises
  async storageGet(keys) {
    if (!this.isContextValid()) {
      throw new Error('Extension context invalidated');
    }
    
    return new Promise((resolve, reject) => {
      try {
        if (!this.api.storage || !this.api.storage.local) {
          reject(new Error('Storage API not available'));
          return;
        }
        
        this.api.storage.local.get(keys, (result) => {
          if (this.api.runtime.lastError) {
            reject(this.api.runtime.lastError);
          } else {
            resolve(result);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async storageSet(items) {
    if (!this.isContextValid()) {
      throw new Error('Extension context invalidated');
    }
    
    return new Promise((resolve, reject) => {
      try {
        if (!this.api.storage || !this.api.storage.local) {
          reject(new Error('Storage API not available'));
          return;
        }
        
        this.api.storage.local.set(items, () => {
          if (this.api.runtime.lastError) {
            reject(this.api.runtime.lastError);
          } else {
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async storageRemove(keys) {
    if (!this.isContextValid()) {
      throw new Error('Extension context invalidated');
    }
    
    return new Promise((resolve, reject) => {
      try {
        if (!this.api.storage || !this.api.storage.local) {
          reject(new Error('Storage API not available'));
          return;
        }
        
        this.api.storage.local.remove(keys, () => {
          if (this.api.runtime.lastError) {
            reject(this.api.runtime.lastError);
          } else {
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  // Message passing abstraction
  async sendMessage(message) {
    if (!this.isContextValid()) {
      throw new Error('Extension context invalidated');
    }
    
    return new Promise((resolve, reject) => {
      try {
        this.api.runtime.sendMessage(message, (response) => {
          if (this.api.runtime.lastError) {
            reject(this.api.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  // Runtime API passthrough
  get runtime() {
    return this.api.runtime;
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
