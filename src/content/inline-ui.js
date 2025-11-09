/**
 * Inline UI Component
 * Provides inline button beside chatbox for prompt enhancement
 */

import { UI_CONSTANTS, SUCCESS_MESSAGES, ERROR_MESSAGES, STORAGE_KEYS } from '../shared/constants.js';
import { copyToClipboard, generateId } from '../shared/utils.js';
import browserCompat from '../shared/browser-compat.js';
import EnhancementPresets from './enhancement-presets.js';
import DragAttachManager from './drag-attach-manager.js';

class InlineUI {
  constructor(enhancer, extractor, domObserver, settings) {
    this.enhancer = enhancer;
    this.extractor = extractor;
    this.domObserver = domObserver;
    this.settings = settings;

    this.currentButton = null;
    this.enhancedPrompt = null;
    this.isProcessing = false;
    this.buttonId = `ape-inline-btn-${generateId()}`;
    this.presets = new EnhancementPresets();
    this.extensionInvalidatedNotified = false;
    this.dragAttachManager = null;

    this.init();
  }

  /**
   * Initialize the inline UI
   */
  async init() {
    console.log('[APE InlineUI] Initializing...');

    // Wait for page to stabilize
    await this.waitForStability();

    // Create and attach button
    this.attachButtonToChatbox();

    // Monitor for chatbox changes (SPA navigation, etc.)
    this.observeChatbox();

    console.log('[APE InlineUI] Initialized');
  }

  /**
   * Wait for page to be stable before injecting
   */
  async waitForStability() {
    return new Promise((resolve) => {
      setTimeout(resolve, 1500);
    });
  }

  /**
   * Monitor for chatbox appearance/disappearance
   */
  observeChatbox() {
    const observer = new MutationObserver(() => {
      // Check if button is still attached and valid
      if (!this.isButtonAttached()) {
        console.log('[APE InlineUI] Button detached, reattaching...');
        this.attachButtonToChatbox();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Check if button is still attached to DOM
   */
  isButtonAttached() {
    if (!this.currentButton) return false;
    return document.body.contains(this.currentButton);
  }

  /**
   * Attach button to chatbox
   */
  async attachButtonToChatbox() {
    // Prevent multiple buttons
    if (this.currentButton && this.isButtonAttached()) {
      return;
    }

    const inputArea = await this.domObserver.findInputElement();
    if (!inputArea) {
      console.warn('[APE InlineUI] Input area not found, will retry...');
      setTimeout(() => this.attachButtonToChatbox(), 2000);
      return;
    }

    // Find the appropriate container for positioning
    const container = this.findInputContainer(inputArea);
    if (!container) {
      console.warn('[APE InlineUI] Container not found');
      return;
    }

    // Create button
    this.currentButton = this.createEnhanceButton();

    // Initialize drag-attach manager
    this.dragAttachManager = new DragAttachManager(
      this.currentButton,
      this.domObserver,
      (position) => this.saveButtonPosition(position)
    );

    // Check for saved position preference
    const settings = await this.getSettings();
    const savedPosition = settings.buttonPosition;

    if (savedPosition) {
      if (savedPosition.mode === 'attached') {
        // Try to load attached position
        const attached = await this.dragAttachManager.loadAttachment(savedPosition);
        if (!attached) {
          // Fallback to default if attachment failed
          console.warn('[APE InlineUI] Failed to load attachment, using default position');
          this.positionButton(container, inputArea);
        } else {
          document.body.appendChild(this.currentButton);
        }
      } else if (savedPosition.preset) {
        // Apply saved preset position
        Object.assign(this.currentButton.style, {
          position: 'fixed',
          left: savedPosition.left || 'auto',
          right: savedPosition.right || 'auto',
          top: savedPosition.top || 'auto',
          bottom: savedPosition.bottom || 'auto',
          zIndex: '9999'
        });
        document.body.appendChild(this.currentButton);
      } else if (savedPosition.mode === 'fixed') {
        // Apply saved fixed position
        Object.assign(this.currentButton.style, {
          position: 'fixed',
          left: savedPosition.left || 'auto',
          right: savedPosition.right || 'auto',
          top: savedPosition.top || 'auto',
          bottom: savedPosition.bottom || 'auto',
          zIndex: '9999'
        });
        document.body.appendChild(this.currentButton);
      } else {
        // Use platform-specific default positioning
        this.positionButton(container, inputArea);
      }
    } else {
      // Use platform-specific default positioning
      this.positionButton(container, inputArea);
    }

    console.log('[APE InlineUI] Button attached successfully');
  }

  /**
   * Find the input container element
   */
  findInputContainer(inputElement) {
    const platform = this.domObserver.platform;

    // Platform-specific container logic
    if (platform === 'chatgpt') {
      // ChatGPT: find the parent form or flex container
      let parent = inputElement.parentElement;
      while (parent && parent !== document.body) {
        if (parent.tagName === 'FORM' ||
            parent.classList.contains('flex') ||
            parent.querySelector('button[data-testid*="send"]')) {
          return parent;
        }
        parent = parent.parentElement;
      }
      return inputElement.parentElement;
    } else if (platform === 'claude') {
      // Claude: find the fieldset or editor container
      let parent = inputElement.parentElement;
      while (parent && parent !== document.body) {
        if (parent.tagName === 'FIELDSET' ||
            parent.querySelector('button[type="submit"]')) {
          return parent;
        }
        parent = parent.parentElement;
      }
      return inputElement.parentElement;
    } else {
      // Generic: use parent element
      return inputElement.parentElement;
    }
  }

  /**
   * Create the enhance button element
   */
  createEnhanceButton() {
    const button = document.createElement('button');
    button.id = this.buttonId;
    button.className = 'ape-inline-button';
    button.type = 'button';
    button.setAttribute('aria-label', 'Enhance Prompt (Alt+E)');
    button.title = 'Enhance Prompt (Alt+E)';

    button.innerHTML = `
      <svg class="ape-icon-enhance" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
        <path d="M2 17L12 22L22 17"/>
        <path d="M2 12L12 17L22 12"/>
      </svg>
      <svg class="ape-spinner-inline ape-hidden" width="20" height="20" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"
                fill="none" stroke-dasharray="40" stroke-dashoffset="10"/>
      </svg>
    `;

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleEnhanceClick();
    });

    button.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showContextMenu(e);
    });

    return button;
  }

  /**
   * Show context menu on right-click
   */
  async showContextMenu(event) {
    // Remove any existing context menu
    const existingMenu = document.getElementById('ape-context-menu');
    if (existingMenu) {
      existingMenu.remove();
    }

    const settings = await this.getSettings();
    const currentTemplate = settings.promptTemplateType || 'standard';

    // Create context menu
    const menu = document.createElement('div');
    menu.id = 'ape-context-menu';
    menu.className = 'ape-context-menu';

    menu.innerHTML = `
      <div class="ape-context-menu-header">
        <span>✨ Prompt Templates</span>
      </div>
      <div class="ape-context-menu-section">
        <button class="ape-context-menu-item ${currentTemplate === 'standard' ? 'active' : ''}" data-template="standard">
          <span class="ape-context-menu-emoji">⚡</span>
          <span class="ape-context-menu-text">Direct Enhancer</span>
          ${currentTemplate === 'standard' ? '<span class="ape-context-menu-check">✓</span>' : ''}
        </button>
        <button class="ape-context-menu-item ${currentTemplate === 'structured' ? 'active' : ''}" data-template="structured">
          <span class="ape-context-menu-emoji">🧭</span>
          <span class="ape-context-menu-text">Structured Blueprint</span>
          ${currentTemplate === 'structured' ? '<span class="ape-context-menu-check">✓</span>' : ''}
        </button>
      </div>
      <div class="ape-context-menu-divider"></div>
      <div class="ape-context-menu-section">
        <div class="ape-context-menu-label">Button Position</div>
        <button class="ape-context-menu-item" data-action="position-bottom-left">
          <span class="ape-context-menu-emoji">↙️</span>
          <span class="ape-context-menu-text">Bottom Left</span>
        </button>
        <button class="ape-context-menu-item" data-action="position-bottom-right">
          <span class="ape-context-menu-emoji">↘️</span>
          <span class="ape-context-menu-text">Bottom Right</span>
        </button>
        <button class="ape-context-menu-item" data-action="position-top-left">
          <span class="ape-context-menu-emoji">↖️</span>
          <span class="ape-context-menu-text">Top Left</span>
        </button>
        <button class="ape-context-menu-item" data-action="position-top-right">
          <span class="ape-context-menu-emoji">↗️</span>
          <span class="ape-context-menu-text">Top Right</span>
        </button>
        <div class="ape-context-menu-divider"></div>
        <button class="ape-context-menu-item" data-action="enable-dragging">
          <span class="ape-context-menu-emoji">🎯</span>
          <span class="ape-context-menu-text">Drag & Attach</span>
        </button>
      </div>
      <div class="ape-context-menu-divider"></div>
      <button class="ape-context-menu-item" data-action="open-settings">
        <span class="ape-context-menu-emoji">⚙️</span>
        <span class="ape-context-menu-text">Open Settings</span>
      </button>
    `;

    // Position menu near click
    menu.style.position = 'fixed';
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;
    menu.style.zIndex = '10000';

    document.body.appendChild(menu);

    // Adjust position if menu goes off screen
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = `${event.clientX - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = `${event.clientY - rect.height}px`;
    }

    // Handle menu item clicks
    menu.addEventListener('click', async (e) => {
      const button = e.target.closest('.ape-context-menu-item');
      if (!button) return;

      const template = button.dataset.template;
      const action = button.dataset.action;

      if (template) {
        // Change template
        await this.changeTemplate(template);
        this.showToast(`Switched to ${template === 'standard' ? 'Direct Enhancer' : 'Structured Blueprint'}`, 'success');
        menu.remove();
      } else if (action?.startsWith('position-')) {
        // Change button position
        const position = action.replace('position-', '');
        await this.changeButtonPosition(position);
        menu.remove();
      } else if (action === 'enable-dragging') {
        // Enable drag mode
        await this.enableDragMode();
        menu.remove();
      } else if (action === 'open-settings') {
        browserCompat.sendMessage({ action: 'openOptions' });
        menu.remove();
      }
    });

    // Close menu on outside click
    const closeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }

  /**
   * Change prompt template
   */
  async changeTemplate(templateType) {
    try {
      const settings = await this.getSettings();
      settings.promptTemplateType = templateType;

      await browserCompat.storageSet({
        enhancerSettings: settings
      });

      // Update cached settings
      this.settings = settings;
    } catch (error) {
      console.error('[InlineUI] Failed to change template:', error);
    }
  }

  /**
   * Change button position to fixed quadrant
   */
  async changeButtonPosition(position) {
    if (!this.currentButton) return;

    const positions = {
      'bottom-left': { left: '20px', bottom: '100px', right: 'auto', top: 'auto' },
      'bottom-right': { right: '20px', bottom: '100px', left: 'auto', top: 'auto' },
      'top-left': { left: '20px', top: '20px', right: 'auto', bottom: 'auto' },
      'top-right': { right: '20px', top: '20px', left: 'auto', bottom: 'auto' }
    };

    const coords = positions[position];
    if (!coords) return;

    // Apply new position
    Object.assign(this.currentButton.style, coords);

    // Save to settings
    try {
      const settings = await this.getSettings();
      settings.buttonPosition = {
        preset: position,
        ...coords,
        isCustom: false
      };

      await browserCompat.storageSet({
        enhancerSettings: settings
      });

      this.settings = settings;
      this.showToast(`Button moved to ${position.replace('-', ' ')}`, 'success');
    } catch (error) {
      console.error('[InlineUI] Failed to save button position:', error);
    }
  }

  /**
   * Enable drag and attach mode
   */
  async enableDragMode() {
    if (!this.currentButton || !this.dragAttachManager) return;

    this.showToast('Drag the button to reposition or attach it to an element. Press ESC to cancel.', 'info');

    await this.dragAttachManager.startDragMode((positionData) => {
      if (positionData) {
        if (positionData.mode === 'attached') {
          const label = positionData.attachedTo.label;
          const anchor = positionData.attachedTo.anchor;
          this.showToast(`Button attached to ${label} (${anchor} side)`, 'success');
        } else {
          this.showToast('Button position saved', 'success');
        }
      } else {
        this.showToast('Drag cancelled', 'info');
      }
    });
  }

  /**
   * Enable button movement mode (DEPRECATED - too buggy)
   */
  async enableButtonMovement() {
    if (!this.currentButton) return;

    this.showToast('Drag the button to reposition it. Press ESC to cancel.', 'info');

    // Find the input container for relative positioning
    const inputArea = await this.domObserver.findInputElement();
    const container = inputArea ? this.findInputContainer(inputArea) : null;

    // Temporarily switch to fixed positioning for dragging
    const originalParent = this.currentButton.parentElement;
    const wasAbsolute = this.currentButton.style.position === 'absolute';
    
    if (wasAbsolute && originalParent && originalParent !== document.body) {
      // Preserve position during drag
      const rect = this.currentButton.getBoundingClientRect();
      document.body.appendChild(this.currentButton);
      this.currentButton.style.position = 'fixed';
      this.currentButton.style.left = `${rect.left}px`;
      this.currentButton.style.top = `${rect.top}px`;
    } else {
      this.currentButton.style.position = 'fixed';
    }

    this.currentButton.style.cursor = 'move';
    this.currentButton.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.5)';
    this.currentButton.style.zIndex = '10001';
    this.currentButton.style.right = 'auto';
    this.currentButton.style.bottom = 'auto';

    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    const handleMouseDown = (e) => {
      e.preventDefault();
      e.stopPropagation();

      isDragging = true;
      const rect = this.currentButton.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;

      this.currentButton.style.opacity = '0.8';
    };

    const handleMouseMove = (e) => {
      if (!isDragging) return;

      e.preventDefault();
      
      const x = e.clientX - offsetX;
      const y = e.clientY - offsetY;

      // Keep button within viewport bounds
      const maxX = window.innerWidth - this.currentButton.offsetWidth;
      const maxY = window.innerHeight - this.currentButton.offsetHeight;

      const boundedX = Math.max(0, Math.min(x, maxX));
      const boundedY = Math.max(0, Math.min(y, maxY));

      this.currentButton.style.left = `${boundedX}px`;
      this.currentButton.style.top = `${boundedY}px`;
    };

    const handleMouseUp = async (e) => {
      if (!isDragging) return;

      e.preventDefault();
      e.stopPropagation();

      isDragging = false;
      this.currentButton.style.opacity = '1';

      // Calculate relative position to container if available
      const buttonRect = this.currentButton.getBoundingClientRect();
      
      if (container) {
        const containerRect = container.getBoundingClientRect();
        
        // Calculate distances from all edges
        const left = buttonRect.left - containerRect.left;
        const right = containerRect.right - buttonRect.right;
        const top = buttonRect.top - containerRect.top;
        const bottom = containerRect.bottom - buttonRect.bottom;

        // Determine which edges to use (closest ones)
        const useRight = right < left;
        const useBottom = bottom < top;

        const positionData = {
          x: buttonRect.left,
          y: buttonRect.top,
          isCustom: true,
          relativeToContainer: true,
          left: useRight ? 'auto' : `${Math.max(0, left)}px`,
          right: useRight ? `${Math.max(0, right)}px` : 'auto',
          top: useBottom ? 'auto' : `${Math.max(0, top)}px`,
          bottom: useBottom ? `${Math.max(0, bottom)}px` : 'auto'
        };

        await this.saveButtonPosition(positionData);
        
        // Re-attach to container with relative positioning
        this.positionButtonRelativeToContainer(container, inputArea, positionData);
      } else {
        // Fallback to fixed positioning
        await this.saveButtonPosition({ 
          x: buttonRect.left, 
          y: buttonRect.top, 
          isCustom: true,
          relativeToContainer: false
        });
      }

      // Cleanup
      this.currentButton.style.cursor = 'pointer';
      this.currentButton.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)';
      this.currentButton.style.zIndex = container ? '100' : '1000';

      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleCancel);

      this.showToast('Button position saved! It will stay relative to the input area.', 'success');
    };

    const handleCancel = (e) => {
      if (e.key === 'Escape') {
        isDragging = false;
        this.currentButton.style.cursor = 'pointer';
        this.currentButton.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)';
        this.currentButton.style.opacity = '1';
        this.currentButton.style.zIndex = '1000';

        document.removeEventListener('mousedown', handleMouseDown);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('keydown', handleCancel);

        this.showToast('Button movement cancelled', 'info');
      }
    };

    // Add event listeners
    this.currentButton.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleCancel);
  }

  /**
   * Save button position to storage
   */
  async saveButtonPosition(position) {
    try {
      const settings = await this.getSettings();
      settings.buttonPosition = position;
      
      await browserCompat.storageSet({
        enhancerSettings: settings
      });

      this.settings = settings;
    } catch (error) {
      console.error('[InlineUI] Failed to save button position:', error);
    }
  }

  /**
   * Load and apply saved button position
   */
  async loadButtonPosition() {
    try {
      const settings = await this.getSettings();
      const position = settings.buttonPosition;

      if (position && position.isCustom && this.currentButton) {
        console.log('[APE InlineUI] Loading custom button position:', position);
        
        this.currentButton.style.position = 'fixed';
        this.currentButton.style.left = `${position.x}px`;
        this.currentButton.style.top = `${position.y}px`;
        this.currentButton.style.right = 'auto';
        this.currentButton.style.bottom = 'auto';
        this.currentButton.style.zIndex = '1000';
        
        console.log('[APE InlineUI] Custom position applied');
      }
    } catch (error) {
      console.error('[InlineUI] Failed to load button position:', error);
    }
  }

  /**
   * Position button relative to container (smart positioning)
   */
  positionButtonRelativeToContainer(container, inputElement, savedPosition) {
    if (!this.currentButton || !container) return;

    // Make container relative if needed
    const computedStyle = window.getComputedStyle(container);
    if (computedStyle.position === 'static') {
      container.style.position = 'relative';
    }

    // Append button to container for relative positioning
    container.appendChild(this.currentButton);

    // Use saved relative position or default
    const position = savedPosition || {};
    
    if (position.relativeToContainer) {
      // Apply saved relative position
      this.currentButton.style.position = 'absolute';
      this.currentButton.style.right = position.right || 'auto';
      this.currentButton.style.left = position.left || 'auto';
      this.currentButton.style.top = position.top || 'auto';
      this.currentButton.style.bottom = position.bottom || 'auto';
      this.currentButton.style.zIndex = '100';
      
      console.log('[APE InlineUI] Applied relative position:', position);
    } else {
      // Convert fixed position to relative position
      this.convertFixedToRelative(container, savedPosition);
    }

    // Observe container for size/position changes to maintain relative positioning
    this.observeContainerChanges(container);
  }

  /**
   * Convert fixed position to relative position
   */
  convertFixedToRelative(container, savedPosition) {
    const containerRect = container.getBoundingClientRect();
    const buttonRect = this.currentButton.getBoundingClientRect();

    // Calculate relative position
    const left = savedPosition.x - containerRect.left;
    const top = savedPosition.y - containerRect.top;
    const right = containerRect.right - (savedPosition.x + buttonRect.width);
    const bottom = containerRect.bottom - (savedPosition.y + buttonRect.height);

    // Use right/bottom if they're smaller (button is closer to that edge)
    this.currentButton.style.position = 'absolute';
    
    if (right < left) {
      this.currentButton.style.right = `${Math.max(0, right)}px`;
      this.currentButton.style.left = 'auto';
    } else {
      this.currentButton.style.left = `${Math.max(0, left)}px`;
      this.currentButton.style.right = 'auto';
    }

    if (bottom < top) {
      this.currentButton.style.bottom = `${Math.max(0, bottom)}px`;
      this.currentButton.style.top = 'auto';
    } else {
      this.currentButton.style.top = `${Math.max(0, top)}px`;
      this.currentButton.style.bottom = 'auto';
    }

    this.currentButton.style.zIndex = '100';
  }

  /**
   * Observe container for changes to maintain relative positioning
   */
  observeContainerChanges(container) {
    if (this.containerObserver) {
      this.containerObserver.disconnect();
    }

    this.containerObserver = new ResizeObserver(() => {
      // Button will naturally stay positioned relative to container
      // This observer is for future enhancements if needed
    });

    this.containerObserver.observe(container);
  }

  /**
   * Position button based on platform
   */
  positionButton(container, inputElement) {
    // Note: container parameter unused after switching to fixed positioning
    // This is intentional - fixed positioning is simpler and more reliable
    const platform = this.domObserver.platform;

    // Platform-specific positioning strategies
    const positions = {
      chatgpt: () => {
        // ChatGPT: FIXED positioning to avoid container confusion bugs
        // Position in bottom-left of viewport, near input area

        // Use fixed positioning - simple and reliable
        Object.assign(this.currentButton.style, {
          position: 'fixed',
          left: '20px',
          bottom: '100px',
          right: 'auto',
          top: 'auto',
          zIndex: '9999'
        });

        // Append to body for fixed positioning
        document.body.appendChild(this.currentButton);
      },

      claude: () => {
        // Claude: FIXED positioning for reliability
        // Position in bottom-left, similar to ChatGPT for consistency

        Object.assign(this.currentButton.style, {
          position: 'fixed',
          left: '20px',
          bottom: '100px',
          right: 'auto',
          top: 'auto',
          zIndex: '9999'
        });

        document.body.appendChild(this.currentButton);
      },

      gemini: () => {
        // Gemini: FIXED positioning for reliability
        // Position in bottom-left for consistency

        Object.assign(this.currentButton.style, {
          position: 'fixed',
          left: '20px',
          bottom: '100px',
          right: 'auto',
          top: 'auto',
          zIndex: '9999'
        });

        document.body.appendChild(this.currentButton);
      },

      generic: () => {
        // Generic: FIXED positioning for reliability
        // Default bottom-left position

        Object.assign(this.currentButton.style, {
          position: 'fixed',
          left: '20px',
          bottom: '100px',
          right: 'auto',
          top: 'auto',
          zIndex: '9999'
        });

        document.body.appendChild(this.currentButton);
      }
    };

    // Execute platform-specific positioning or use generic
    const positionFn = positions[platform] || positions.generic;
    positionFn();
  }

  /**
   * Handle enhance button click
   */
  async handleEnhanceClick() {
    if (this.isProcessing) {
      console.log('[APE InlineUI] Already processing...');
      return;
    }

    this.isProcessing = true;
    this.showLoading();

    try {
      // Get current settings
      const settings = await this.getSettings();

      // Extract context
      const context = await this.extractor.extractFullContext();

      if (!context.currentPrompt || context.currentPrompt.trim().length === 0) {
        this.showToast('No prompt to enhance', 'error');
        return;
      }

      console.log('[APE InlineUI] Enhancing prompt...', {
        originalLength: context.currentPrompt.length,
        contextMessages: context.conversationHistory.length
      });

      // Get enhancement type from settings
      const enhancementType = settings.currentEnhancementType || 'balanced';

      // Enhance prompt
      const enhanced = await this.enhancePrompt(context, enhancementType, settings);

      if (!enhanced) {
        this.showToast('Enhancement failed', 'error');
        return;
      }
        const trimmedOriginal = context.currentPrompt.trim();
        const trimmedEnhanced = enhanced.trim();
        if (!trimmedEnhanced.length) {
          this.showToast('No enhanced content returned', 'warning');
          return;
        }
        if (trimmedEnhanced === trimmedOriginal) {
          this.showToast('No changes were applied to the prompt', 'info');
          return;
        }

      this.enhancedPrompt = enhanced;

      console.log('[APE InlineUI] Enhancement complete', {
        enhancedLength: enhanced.length,
        difference: enhanced.length - context.currentPrompt.length
      });

      // Replace text in chatbox
      const success = await this.domObserver.injectEnhancedPrompt(enhanced);

      if (success) {
        this.showToast('Prompt enhanced!', 'success');

        // Track enhancement
        await this.trackEnhancement(enhancementType);
      } else {
        this.showToast('Failed to apply enhancement', 'error');
      }

    } catch (error) {
      console.error('[APE InlineUI] Enhancement error:', error);
      this.showToast('Enhancement failed', 'error');
    } finally {
      this.isProcessing = false;
      this.hideLoading();
    }
  }

  /**
   * Enhance prompt using current settings
   */
  async enhancePrompt(context, enhancementType, settings) {
    // Use the preset system
    const customPrompt = enhancementType === 'custom' ? settings.customEnhancementPrompt : null;

    try {
      const enhanced = await this.presets.enhanceWithPreset(
        context,
        enhancementType || 'balanced',
        customPrompt
      );

      return enhanced;
    } catch (error) {
      console.error('[InlineUI] Enhancement error:', error);

      // Fallback to basic enhancement
      const fallback = await this.enhancer.enhancePrompt(context, settings);
      return fallback.enhanced;
    }
  }

  /**
   * Get current settings
   */
  async getSettings() {
    try {
      const response = await browserCompat.sendMessage({
        action: 'getSettings'
      });
      if (response) {
        this.settings = response;
      }
      return this.settings || {};
    } catch (error) {
      const message = error?.message || String(error);

      if (message.includes('Extension context invalidated')) {
        if (!this.extensionInvalidatedNotified) {
          this.showToast('Extension reloaded. Refresh the page to continue.', 'warning');
          this.extensionInvalidatedNotified = true;
        }
      } else {
        console.error('[APE InlineUI] Failed to get settings:', error);
      }

      try {
        const fallback = await browserCompat.storageGet([STORAGE_KEYS.SETTINGS]);
        if (fallback?.[STORAGE_KEYS.SETTINGS]) {
          this.settings = {
            ...this.settings,
            ...fallback[STORAGE_KEYS.SETTINGS]
          };
        }
      } catch (storageError) {
        console.error('[APE InlineUI] Storage fallback failed:', storageError);
      }

      return this.settings || {};
    }
  }

  /**
   * Track enhancement event
   */
  async trackEnhancement(enhancementType) {
    try {
      await browserCompat.sendMessage({
        action: 'trackEvent',
        data: {
          eventName: 'prompt_enhanced',
          eventData: {
            platform: this.domObserver.platform,
            enhancementType,
            timestamp: Date.now()
          }
        }
      });

      // Update usage stats
      const stats = await browserCompat.storageGet(['usageStats']) || {};
      const usageStats = stats.usageStats || { totalEnhancements: 0, byokEnhancements: 0 };

      usageStats.totalEnhancements++;

      const subscription = await browserCompat.sendMessage({ action: 'getSubscription' });
      if (subscription && subscription.type === 'byok') {
        usageStats.byokEnhancements++;
      }

      await browserCompat.storageSet({ usageStats });
    } catch (error) {
      console.error('[APE InlineUI] Failed to track enhancement:', error);
    }
  }

  /**
   * Show loading state
   */
  showLoading() {
    if (!this.currentButton) return;

    const icon = this.currentButton.querySelector('.ape-icon-enhance');
    const spinner = this.currentButton.querySelector('.ape-spinner-inline');

    if (icon) icon.classList.add('ape-hidden');
    if (spinner) spinner.classList.remove('ape-hidden');

    this.currentButton.disabled = true;
    this.currentButton.classList.add('ape-processing');
  }

  /**
   * Hide loading state
   */
  hideLoading() {
    if (!this.currentButton) return;

    const icon = this.currentButton.querySelector('.ape-icon-enhance');
    const spinner = this.currentButton.querySelector('.ape-spinner-inline');

    if (icon) icon.classList.remove('ape-hidden');
    if (spinner) spinner.classList.add('ape-hidden');

    this.currentButton.disabled = false;
    this.currentButton.classList.remove('ape-processing');
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'info') {
    // Remove any existing toast
    const existingToast = document.querySelector('.ape-toast');
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `ape-toast ape-toast-${type}`;

    // Add icon based on type
    const icons = {
      success: '✓',
      error: '✕',
      info: 'ℹ',
      warning: '⚠'
    };

    toast.innerHTML = `
      <span class="ape-toast-icon">${icons[type] || icons.info}</span>
      <span class="ape-toast-message">${message}</span>
    `;

    document.body.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('ape-toast-show'), 10);

    // Auto-remove after delay
    setTimeout(() => {
      toast.classList.remove('ape-toast-show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /**
   * Copy enhanced prompt to clipboard
   */
  async copyEnhancedToClipboard() {
    if (!this.enhancedPrompt) {
      this.showToast('No enhanced prompt to copy', 'warning');
      return;
    }

    const success = await copyToClipboard(this.enhancedPrompt);
    if (success) {
      this.showToast('Copied to clipboard', 'success');
    } else {
      this.showToast('Failed to copy', 'error');
    }
  }

  /**
   * Cleanup/destroy
   */
  destroy() {
    if (this.currentButton) {
      this.currentButton.remove();
      this.currentButton = null;
    }
  }
}

export default InlineUI;
