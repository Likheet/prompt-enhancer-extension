/**
 * ProfileManager
 * Manages placement profiles and determines which profile to use for a given URL
 */

const STORAGE_KEY_PROFILES = 'promptenhancer_profiles';
const STORAGE_KEY_DEFAULT = 'promptenhancer_defaultProfile';

class ProfileManager {
  constructor() {
    this.profiles = [];
    this.defaultProfile = null;
    this.initialized = false;
  }

  /**
   * Initialize and load profiles from storage
   */
  async initialize() {
    if (this.initialized) return;

    try {
      await this.loadProfiles();
      this.initialized = true;
      console.log('[ProfileManager] Initialized with', this.profiles.length, 'profiles');
    } catch (error) {
      console.error('[ProfileManager] Initialization failed:', error);
      // Initialize with empty profiles array
      this.profiles = [];
      this.defaultProfile = this.getBuiltInDefaultProfile();
    }
  }

  /**
   * Load profiles from chrome.storage
   */
  async loadProfiles() {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get([STORAGE_KEY_PROFILES, STORAGE_KEY_DEFAULT], (result) => {
        if (chrome.runtime.lastError) {
          // Fallback to local storage if sync fails
          chrome.storage.local.get([STORAGE_KEY_PROFILES, STORAGE_KEY_DEFAULT], (localResult) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              this.profiles = localResult[STORAGE_KEY_PROFILES] || this.getBuiltInProfiles();
              this.defaultProfile = localResult[STORAGE_KEY_DEFAULT] || this.getBuiltInDefaultProfile();
              resolve();
            }
          });
        } else {
          this.profiles = result[STORAGE_KEY_PROFILES] || this.getBuiltInProfiles();
          this.defaultProfile = result[STORAGE_KEY_DEFAULT] || this.getBuiltInDefaultProfile();
          resolve();
        }
      });
    });
  }

  /**
   * Save profiles to chrome.storage
   */
  async saveProfiles() {
    return new Promise((resolve, reject) => {
      const data = {
        [STORAGE_KEY_PROFILES]: this.profiles,
        [STORAGE_KEY_DEFAULT]: this.defaultProfile
      };

      chrome.storage.sync.set(data, () => {
        if (chrome.runtime.lastError) {
          // Fallback to local storage
          chrome.storage.local.set(data, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Get the active profile for a given URL
   * Returns null if no profile matches (triggers fallback detection)
   *
   * Priority:
   * 1. Exact URL match
   * 2. Domain + pathPattern match
   * 3. Domain-only match
   * 4. null (fallback)
   */
  getActiveProfile(urlString) {
    if (!this.initialized) {
      console.warn('[ProfileManager] Not initialized, using built-in profiles');
      this.profiles = this.getBuiltInProfiles();
    }

    try {
      const url = new URL(urlString);
      const domain = url.hostname;
      const path = url.pathname;

      const enabledProfiles = this.profiles.filter(p => p.enabled !== false);

      // 1. Try exact URL match
      const exactMatch = enabledProfiles.find(p => p.url && p.url === urlString);
      if (exactMatch) {
        console.log('[ProfileManager] Matched exact URL:', exactMatch.id);
        return exactMatch;
      }

      // 2. Try domain + pathPattern match
      const domainPathMatches = enabledProfiles.filter(p =>
        p.domain && this.matchesDomain(domain, p.domain) && p.pathPattern
      );

      for (const profile of domainPathMatches) {
        if (this.matchesPath(path, profile.pathPattern)) {
          console.log('[ProfileManager] Matched domain+path:', profile.id);
          return profile;
        }
      }

      // 3. Try domain-only match
      const domainMatch = enabledProfiles.find(p =>
        p.domain && this.matchesDomain(domain, p.domain) && !p.pathPattern
      );

      if (domainMatch) {
        console.log('[ProfileManager] Matched domain:', domainMatch.id);
        return domainMatch;
      }

      // 4. No match - return null to trigger fallback
      console.log('[ProfileManager] No profile matched, will use fallback detection');
      return null;

    } catch (error) {
      console.error('[ProfileManager] Error matching profile:', error);
      return null;
    }
  }

  /**
   * Check if hostname matches domain pattern
   */
  matchesDomain(hostname, domainPattern) {
    // Exact match
    if (hostname === domainPattern) return true;

    // Subdomain match (e.g., pattern "example.com" matches "www.example.com")
    if (hostname.endsWith('.' + domainPattern)) return true;

    // Wildcard support (e.g., "*.example.com")
    if (domainPattern.startsWith('*.')) {
      const baseDomain = domainPattern.substring(2);
      return hostname === baseDomain || hostname.endsWith('.' + baseDomain);
    }

    return false;
  }

  /**
   * Check if path matches pattern (simple glob support)
   */
  matchesPath(path, pattern) {
    // Exact match
    if (path === pattern) return true;

    // Convert glob pattern to regex
    // Support: * (any chars), ** (any path segments), ? (single char)
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '§§§')  // Temporary placeholder
      .replace(/\*/g, '[^/]*')
      .replace(/§§§/g, '.*')
      .replace(/\?/g, '.');

    const regex = new RegExp('^' + regexPattern + '$');
    return regex.test(path);
  }

  /**
   * Add or update a profile
   */
  async saveProfile(profile) {
    if (!profile.id) {
      profile.id = this.generateProfileId();
    }

    const existingIndex = this.profiles.findIndex(p => p.id === profile.id);
    if (existingIndex >= 0) {
      this.profiles[existingIndex] = profile;
    } else {
      this.profiles.push(profile);
    }

    await this.saveProfiles();
    console.log('[ProfileManager] Saved profile:', profile.id);
  }

  /**
   * Delete a profile by ID
   */
  async deleteProfile(profileId) {
    this.profiles = this.profiles.filter(p => p.id !== profileId);
    await this.saveProfiles();
    console.log('[ProfileManager] Deleted profile:', profileId);
  }

  /**
   * Get a profile by ID
   */
  getProfileById(profileId) {
    return this.profiles.find(p => p.id === profileId);
  }

  /**
   * Get all profiles
   */
  getAllProfiles() {
    return [...this.profiles];
  }

  /**
   * Update default profile settings
   */
  async updateDefaultProfile(settings) {
    this.defaultProfile = { ...this.defaultProfile, ...settings };
    await this.saveProfiles();
  }

  /**
   * Get default profile (for fallback)
   */
  getDefaultProfile() {
    return this.defaultProfile || this.getBuiltInDefaultProfile();
  }

  /**
   * Generate a unique profile ID
   */
  generateProfileId() {
    return 'profile_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Get built-in default profile configuration
   */
  getBuiltInDefaultProfile() {
    return {
      mode: 'inside-bottom-right',
      offsetX: '12px',
      offsetY: '12px',
      size: '32px',
      minWidth: 300,        // Minimum width for candidate fields
      minHeight: 60,        // Minimum height for candidate fields
      preferBottom: true,   // Prefer fields in lower part of viewport
      scoreWeights: {
        size: 1.0,
        position: 0.5,
        semantics: 0.3
      }
    };
  }

  /**
   * Get built-in profiles for common AI chat sites
   */
  getBuiltInProfiles() {
    return [
      // ChatGPT
      {
        id: 'builtin_chatgpt',
        domain: 'chatgpt.com',
        pathPattern: '/c/*',
        promptSelector: 'textarea#prompt-textarea',
        anchorSelector: 'form div.ms-auto.flex.items-center, div.flex.items-center.gap-2',
        mode: 'toolbar',
        offsetX: '0px',
        offsetY: '0px',
        size: '32px',
        enabled: true
      },
      {
        id: 'builtin_chatgpt_alt',
        domain: 'chat.openai.com',
        pathPattern: '/c/*',
        promptSelector: 'textarea#prompt-textarea',
        anchorSelector: 'form div.ms-auto.flex.items-center, div.flex.items-center.gap-2',
        mode: 'toolbar',
        offsetX: '0px',
        offsetY: '0px',
        size: '32px',
        enabled: true
      },
      // Claude
      {
        id: 'builtin_claude',
        domain: 'claude.ai',
        pathPattern: '/chat/*',
        promptSelector: 'div.ProseMirror[contenteditable="true"]',
        anchorSelector: null,
        mode: 'inside-bottom-right',
        offsetX: '16px',
        offsetY: '16px',
        size: '32px',
        enabled: true
      },
      // Gemini
      {
        id: 'builtin_gemini',
        domain: 'gemini.google.com',
        pathPattern: null,
        promptSelector: 'rich-textarea, div.ql-editor[contenteditable="true"]',
        anchorSelector: null,
        mode: 'inside-bottom-right',
        offsetX: '16px',
        offsetY: '16px',
        size: '32px',
        enabled: true
      }
    ];
  }

  /**
   * Reset to built-in profiles (useful for debugging)
   */
  async resetToDefaults() {
    this.profiles = this.getBuiltInProfiles();
    this.defaultProfile = this.getBuiltInDefaultProfile();
    await this.saveProfiles();
    console.log('[ProfileManager] Reset to default profiles');
  }
}

export default ProfileManager;
