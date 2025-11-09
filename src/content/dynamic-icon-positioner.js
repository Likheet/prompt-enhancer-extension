/**
 * Dynamic Icon Positioner
 *
 * Sophisticated icon positioning system that adapts to AI platform UI changes.
 * Tracks input area transitions (centered → bottom), handles viewport changes,
 * and maintains smooth animations across all platforms.
 */

import { PLATFORMS } from '../shared/constants.js';
import { throttle, debounce } from '../shared/utils.js';

class DynamicIconPositioner {
  constructor(iconElement, domObserver) {
    this.icon = iconElement;
    this.domObserver = domObserver;
    this.platform = domObserver.platform;

    // Observer instances
    this.mutationObserver = null;
    this.resizeObserver = null;
    this.intersectionObserver = null;

    // State tracking
    this.currentInputElement = null;
    this.currentInputContainer = null;
    this.inputState = 'unknown'; // 'centered', 'bottom', 'unknown'
    this.lastKnownPosition = null;
    this.isDestroyed = false;

    // Performance optimization
    this.updateScheduled = false;
    this.updateThrottled = throttle(() => this.updateIconPosition(), 16); // ~60fps
    this.recalculateDebounced = debounce(() => this.recalculatePosition(), 150);

    // Platform-specific configurations
    this.config = this.getPlatformConfig();

    // Bind methods
    this.handleScroll = throttle(() => this.onScroll(), 100);
    this.handleResize = debounce(() => this.onResize(), 200);
    this.handleVisibilityChange = () => this.onVisibilityChange();
  }

  /**
   * Get platform-specific configuration
   */
  getPlatformConfig() {
    const configs = {
      [PLATFORMS.CHATGPT]: {
        // ChatGPT input area transitions from center to bottom
        inputContainerSelectors: [
          'form.w-full',
          'div.relative.flex.h-full',
          'div[class*="composer"]'
        ],
        // Detect if input is in "new chat" centered state
        centeredStateDetector: (inputEl, containerEl) => {
          if (!containerEl) return false;
          const rect = containerEl.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          // If container is in middle 50% of viewport, it's likely centered
          const centerY = rect.top + rect.height / 2;
          return centerY > viewportHeight * 0.3 && centerY < viewportHeight * 0.7;
        },
        // Icon positioning strategy
        positioning: {
          centered: {
            relativeTo: 'container',
            offset: { right: '-50px', top: '12px' },
            alignment: 'top-right-outside'
          },
          bottom: {
            relativeTo: 'viewport',
            offset: { left: '20px', bottom: '100px' },
            alignment: 'fixed-bottom-left'
          }
        },
        // Transition detection selectors
        transitionIndicators: [
          'div[data-testid^="conversation"]',
          'main > div > div > div' // Message containers
        ]
      },

      [PLATFORMS.CLAUDE]: {
        inputContainerSelectors: [
          'fieldset',
          'div[class*="InputContainer"]',
          'div.relative.flex.flex-col'
        ],
        centeredStateDetector: (inputEl, containerEl) => {
          if (!containerEl) return false;
          const rect = containerEl.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          const centerY = rect.top + rect.height / 2;
          return centerY > viewportHeight * 0.35 && centerY < viewportHeight * 0.65;
        },
        positioning: {
          centered: {
            relativeTo: 'container',
            offset: { right: '-50px', top: '12px' },
            alignment: 'top-right-outside'
          },
          bottom: {
            relativeTo: 'viewport',
            offset: { left: '20px', bottom: '100px' },
            alignment: 'fixed-bottom-left'
          }
        },
        transitionIndicators: [
          'div[data-is-user]',
          'div.font-claude-message'
        ]
      },

      [PLATFORMS.GEMINI]: {
        inputContainerSelectors: [
          'div.input-area-container',
          'div[class*="InputArea"]',
          'mat-form-field'
        ],
        centeredStateDetector: (inputEl, containerEl) => {
          if (!containerEl) return false;
          const rect = containerEl.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          const centerY = rect.top + rect.height / 2;
          return centerY > viewportHeight * 0.4 && centerY < viewportHeight * 0.7;
        },
        positioning: {
          centered: {
            relativeTo: 'container',
            offset: { right: '-50px', top: '12px' },
            alignment: 'top-right-outside'
          },
          bottom: {
            relativeTo: 'viewport',
            offset: { left: '20px', bottom: '100px' },
            alignment: 'fixed-bottom-left'
          }
        },
        transitionIndicators: [
          'message-content',
          'model-response'
        ]
      },

      [PLATFORMS.GENERIC]: {
        inputContainerSelectors: [
          'form',
          'div.input-container',
          'div[class*="input"]'
        ],
        centeredStateDetector: () => false, // Default to bottom positioning
        positioning: {
          centered: {
            relativeTo: 'container',
            offset: { right: '-50px', top: '12px' },
            alignment: 'top-right-outside'
          },
          bottom: {
            relativeTo: 'viewport',
            offset: { left: '20px', bottom: '100px' },
            alignment: 'fixed-bottom-left'
          }
        },
        transitionIndicators: []
      }
    };

    return configs[this.platform] || configs[PLATFORMS.GENERIC];
  }

  /**
   * Initialize the dynamic positioning system
   */
  async initialize() {
    console.log('[APE DynamicPositioner] Initializing for platform:', this.platform);

    try {
      // Find input element and container
      await this.findAndTrackInput();

      // Set initial position
      this.updateIconPosition();

      // Start observing
      this.startObserving();

      // Add event listeners
      this.attachEventListeners();

      console.log('[APE DynamicPositioner] Initialized successfully');
    } catch (error) {
      console.error('[APE DynamicPositioner] Initialization failed:', error);
    }
  }

  /**
   * Find input element and its container
   */
  async findAndTrackInput() {
    this.currentInputElement = await this.domObserver.findInputElement();

    if (!this.currentInputElement) {
      console.warn('[APE DynamicPositioner] Input element not found');
      return;
    }

    // Find the container
    this.currentInputContainer = this.findInputContainer(this.currentInputElement);

    // Detect initial state
    this.detectInputState();

    console.log('[APE DynamicPositioner] Tracked input:', {
      inputElement: this.currentInputElement.tagName,
      container: this.currentInputContainer?.tagName,
      state: this.inputState
    });
  }

  /**
   * Find the input container element
   */
  findInputContainer(inputElement) {
    // Try platform-specific selectors first
    let parent = inputElement.parentElement;
    let depth = 0;
    const maxDepth = 10;

    while (parent && parent !== document.body && depth < maxDepth) {
      // Check if parent matches any platform selector
      for (const selector of this.config.inputContainerSelectors) {
        try {
          if (parent.matches(selector)) {
            return parent;
          }
        } catch (e) {
          // Invalid selector, continue
        }
      }

      // Heuristic: look for form or significant container
      if (parent.tagName === 'FORM' ||
          parent.tagName === 'FIELDSET' ||
          (parent.offsetHeight > 60 && parent.offsetWidth > 200)) {
        return parent;
      }

      parent = parent.parentElement;
      depth++;
    }

    // Fallback to immediate parent
    return inputElement.parentElement;
  }

  /**
   * Detect current input state (centered vs bottom)
   */
  detectInputState() {
    if (!this.currentInputElement || !this.currentInputContainer) {
      this.inputState = 'unknown';
      return;
    }

    // Use platform-specific detector
    const isCentered = this.config.centeredStateDetector(
      this.currentInputElement,
      this.currentInputContainer
    );

    // Check for conversation messages to confirm state
    const hasMessages = this.hasConversationMessages();

    if (isCentered && !hasMessages) {
      this.inputState = 'centered';
    } else {
      this.inputState = 'bottom';
    }

    console.log('[APE DynamicPositioner] Detected input state:', this.inputState);
  }

  /**
   * Check if conversation has messages
   */
  hasConversationMessages() {
    if (this.config.transitionIndicators.length === 0) return false;

    for (const selector of this.config.transitionIndicators) {
      try {
        const messages = document.querySelectorAll(selector);
        if (messages.length > 0) return true;
      } catch (e) {
        // Invalid selector
      }
    }

    return false;
  }

  /**
   * Update icon position based on current state
   */
  updateIconPosition() {
    if (this.isDestroyed || !this.icon) return;

    // Re-detect state in case it changed
    this.detectInputState();

    const positioning = this.config.positioning[this.inputState] || this.config.positioning.bottom;

    if (positioning.relativeTo === 'viewport') {
      this.positionRelativeToViewport(positioning);
    } else if (positioning.relativeTo === 'container') {
      this.positionRelativeToContainer(positioning);
    }

    this.updateScheduled = false;
  }

  /**
   * Position icon relative to viewport (fixed positioning)
   */
  positionRelativeToViewport(positioning) {
    if (!this.icon) return;

    // Apply smooth transition
    this.icon.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    this.icon.style.position = 'fixed';

    // Clear previous positioning
    this.icon.style.left = 'auto';
    this.icon.style.right = 'auto';
    this.icon.style.top = 'auto';
    this.icon.style.bottom = 'auto';

    // Apply new positioning
    Object.assign(this.icon.style, positioning.offset);

    // Ensure proper z-index
    this.icon.style.zIndex = '9999';

    // Ensure icon is in body for fixed positioning
    if (this.icon.parentElement !== document.body) {
      document.body.appendChild(this.icon);
    }
  }

  /**
   * Position icon relative to container (absolute positioning)
   */
  positionRelativeToContainer(positioning) {
    if (!this.icon || !this.currentInputContainer) {
      // Fallback to viewport positioning
      this.positionRelativeToViewport(this.config.positioning.bottom);
      return;
    }

    // Ensure container has position context
    const containerStyle = window.getComputedStyle(this.currentInputContainer);
    if (containerStyle.position === 'static') {
      this.currentInputContainer.style.position = 'relative';
    }

    // Apply smooth transition
    this.icon.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    this.icon.style.position = 'absolute';

    // Clear previous positioning
    this.icon.style.left = 'auto';
    this.icon.style.right = 'auto';
    this.icon.style.top = 'auto';
    this.icon.style.bottom = 'auto';

    // Apply new positioning
    Object.assign(this.icon.style, positioning.offset);

    // Adjust z-index for absolute positioning
    this.icon.style.zIndex = '100';

    // Append to container if not already there
    if (this.icon.parentElement !== this.currentInputContainer) {
      this.currentInputContainer.appendChild(this.icon);
    }
  }

  /**
   * Start observing for changes
   */
  startObserving() {
    // MutationObserver for DOM structure changes
    this.mutationObserver = new MutationObserver((mutations) => {
      let shouldUpdate = false;

      for (const mutation of mutations) {
        // Check if input area or container was modified
        if (mutation.type === 'childList' && mutation.target) {
          // Check if conversation messages were added
          for (const selector of this.config.transitionIndicators) {
            try {
              if (mutation.target.querySelector?.(selector)) {
                shouldUpdate = true;
                break;
              }
            } catch (e) {
              // Invalid selector
            }
          }
        }

        // Check for attribute changes that might affect layout
        if (mutation.type === 'attributes') {
          const attrName = mutation.attributeName;
          if (attrName === 'class' || attrName === 'style') {
            shouldUpdate = true;
          }
        }
      }

      if (shouldUpdate && !this.updateScheduled) {
        this.updateScheduled = true;
        this.recalculateDebounced();
      }
    });

    // Observe the main content area
    const observeTarget = document.querySelector('main') || document.body;
    this.mutationObserver.observe(observeTarget, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'data-testid']
    });

    // ResizeObserver for container size changes
    if (this.currentInputContainer) {
      this.resizeObserver = new ResizeObserver(() => {
        if (!this.updateScheduled) {
          this.updateScheduled = true;
          this.updateThrottled();
        }
      });

      this.resizeObserver.observe(this.currentInputContainer);
    }

    // IntersectionObserver for visibility tracking
    if (this.currentInputElement) {
      this.intersectionObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting !== undefined) {
              // Input visibility changed
              if (!this.updateScheduled) {
                this.updateScheduled = true;
                this.updateThrottled();
              }
            }
          }
        },
        { threshold: [0, 0.5, 1] }
      );

      this.intersectionObserver.observe(this.currentInputElement);
    }
  }

  /**
   * Recalculate position (more comprehensive update)
   */
  async recalculatePosition() {
    if (this.isDestroyed) return;

    // Re-find input if it changed
    const oldInput = this.currentInputElement;
    await this.findAndTrackInput();

    // If input changed, restart observers
    if (this.currentInputElement !== oldInput) {
      console.log('[APE DynamicPositioner] Input element changed, restarting observers');
      this.stopObserving();
      this.startObserving();
    }

    this.updateIconPosition();
  }

  /**
   * Attach event listeners for viewport changes
   */
  attachEventListeners() {
    window.addEventListener('scroll', this.handleScroll, { passive: true });
    window.addEventListener('resize', this.handleResize);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  /**
   * Handle scroll events
   */
  onScroll() {
    if (!this.updateScheduled) {
      this.updateScheduled = true;
      this.updateThrottled();
    }
  }

  /**
   * Handle resize events
   */
  onResize() {
    this.recalculatePosition();
  }

  /**
   * Handle visibility change
   */
  onVisibilityChange() {
    if (document.visibilityState === 'visible') {
      // Page became visible, recalculate position
      this.recalculatePosition();
    }
  }

  /**
   * Stop observing
   */
  stopObserving() {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }
  }

  /**
   * Remove event listeners
   */
  detachEventListeners() {
    window.removeEventListener('scroll', this.handleScroll);
    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  /**
   * Destroy the positioner
   */
  destroy() {
    console.log('[APE DynamicPositioner] Destroying...');

    this.isDestroyed = true;
    this.stopObserving();
    this.detachEventListeners();

    this.icon = null;
    this.currentInputElement = null;
    this.currentInputContainer = null;
  }
}

export default DynamicIconPositioner;
