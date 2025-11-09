/**
 * Drag and Attach Manager
 * Handles dragging the button and attaching it to elements
 */

import PositionTracker from './position-tracker.js';

class DragAttachManager {
  constructor(button, domObserver, onSave) {
    this.button = button;
    this.domObserver = domObserver;
    this.onSave = onSave; // Callback to save position

    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.snapTargets = [];
    this.currentSnapTarget = null;
    this.snapIndicator = null;
    this.positionTracker = null;

    this.SNAP_DISTANCE = 80; // Distance in pixels to trigger snap
  }

  /**
   * Find all attachable elements on the page
   */
  async findSnapTargets() {
    const targets = [];
    const platform = this.domObserver.platform;

    // Find the input element
    const inputElement = await this.domObserver.findInputElement();
    if (inputElement) {
      targets.push({
        element: inputElement,
        label: 'Input Box',
        type: 'input'
      });
    }

    // Platform-specific send button selectors
    const sendButtonSelectors = {
      chatgpt: [
        'button[data-testid*="send"]',
        'button[data-testid="send-button"]',
        'button[aria-label*="Send"]',
        'button[type="submit"]'
      ],
      claude: [
        'button[type="submit"]',
        'button[aria-label*="Send"]',
        'button.inline-flex'
      ],
      gemini: [
        'button[aria-label*="Send"]',
        'button[type="submit"]',
        'button.send-button'
      ],
      generic: [
        'button[type="submit"]',
        'button[aria-label*="Send"]'
      ]
    };

    const selectors = sendButtonSelectors[platform] || sendButtonSelectors.generic;

    // Find send buttons
    for (const selector of selectors) {
      const buttons = document.querySelectorAll(selector);
      buttons.forEach((btn) => {
        // Avoid adding our own button
        if (btn.id !== this.button.id && !btn.classList.contains('ape-inline-button')) {
          targets.push({
            element: btn,
            label: 'Send Button',
            type: 'submit-button',
            selector: selector
          });
        }
      });
    }

    // Find container elements
    if (inputElement) {
      let parent = inputElement.parentElement;
      let depth = 0;
      while (parent && parent !== document.body && depth < 5) {
        if (parent.tagName === 'FORM' ||
            parent.tagName === 'FIELDSET' ||
            parent.classList.contains('composer') ||
            parent.classList.contains('chat-input')) {
          targets.push({
            element: parent,
            label: `Container (${parent.tagName})`,
            type: 'container'
          });
          break;
        }
        parent = parent.parentElement;
        depth++;
      }
    }

    this.snapTargets = targets;
    console.log(`[DragAttachManager] Found ${targets.length} snap targets:`, targets);
    return targets;
  }

  /**
   * Find the closest snap target to current mouse position
   */
  findClosestSnapTarget(mouseX, mouseY) {
    let closest = null;
    let minDistance = this.SNAP_DISTANCE;

    for (const target of this.snapTargets) {
      const rect = target.element.getBoundingClientRect();

      // Calculate distances to each edge
      const distances = {
        left: { distance: Math.abs(mouseX - rect.left), anchor: 'left', x: rect.left, y: rect.top + rect.height / 2 },
        right: { distance: Math.abs(mouseX - rect.right), anchor: 'right', x: rect.right, y: rect.top + rect.height / 2 },
        top: { distance: Math.abs(mouseY - rect.top), anchor: 'top', x: rect.left + rect.width / 2, y: rect.top },
        bottom: { distance: Math.abs(mouseY - rect.bottom), anchor: 'bottom', x: rect.left + rect.width / 2, y: rect.bottom }
      };

      // Find the closest edge
      for (const [edge, data] of Object.entries(distances)) {
        // Also check if mouse is roughly aligned with the element
        let isAligned = false;
        if (edge === 'left' || edge === 'right') {
          isAligned = mouseY >= rect.top - 50 && mouseY <= rect.bottom + 50;
        } else {
          isAligned = mouseX >= rect.left - 50 && mouseX <= rect.right + 50;
        }

        if (isAligned && data.distance < minDistance) {
          minDistance = data.distance;
          closest = {
            target: target,
            anchor: data.anchor,
            snapPoint: { x: data.x, y: data.y },
            edge: edge
          };
        }
      }
    }

    return closest;
  }

  /**
   * Create visual snap indicator
   */
  createSnapIndicator() {
    if (this.snapIndicator) {
      this.snapIndicator.remove();
    }

    const indicator = document.createElement('div');
    indicator.className = 'ape-snap-indicator';
    indicator.style.cssText = `
      position: fixed;
      width: 12px;
      height: 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: 2px solid white;
      border-radius: 50%;
      pointer-events: none;
      z-index: 10002;
      opacity: 0;
      transition: opacity 0.2s ease;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.5);
    `;
    document.body.appendChild(indicator);
    this.snapIndicator = indicator;
  }

  /**
   * Show snap indicator at position
   */
  showSnapIndicator(x, y) {
    if (!this.snapIndicator) {
      this.createSnapIndicator();
    }

    const buttonRect = this.button.getBoundingClientRect();
    this.snapIndicator.style.left = `${x - 6}px`;
    this.snapIndicator.style.top = `${y - 6}px`;
    this.snapIndicator.style.opacity = '1';
  }

  /**
   * Hide snap indicator
   */
  hideSnapIndicator() {
    if (this.snapIndicator) {
      this.snapIndicator.style.opacity = '0';
    }
  }

  /**
   * Start dragging mode
   */
  async startDragMode(onComplete) {
    console.log('[DragAttachManager] Starting drag mode');

    // Find all snap targets
    await this.findSnapTargets();

    // Create snap indicator
    this.createSnapIndicator();

    // Add visual feedback to button
    this.button.style.cursor = 'move';
    this.button.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.5)';
    this.button.style.transition = 'none';
    this.button.style.zIndex = '10001';

    // Ensure fixed positioning for dragging
    if (this.button.style.position !== 'fixed') {
      const rect = this.button.getBoundingClientRect();
      this.button.style.position = 'fixed';
      this.button.style.left = `${rect.left}px`;
      this.button.style.top = `${rect.top}px`;
      this.button.style.right = 'auto';
      this.button.style.bottom = 'auto';
    }

    // Event handlers
    const handleMouseDown = (e) => {
      e.preventDefault();
      e.stopPropagation();

      this.isDragging = true;
      const rect = this.button.getBoundingClientRect();
      this.dragOffset.x = e.clientX - rect.left;
      this.dragOffset.y = e.clientY - rect.top;

      this.button.style.opacity = '0.8';
    };

    const handleMouseMove = (e) => {
      if (!this.isDragging) return;

      e.preventDefault();

      const x = e.clientX - this.dragOffset.x;
      const y = e.clientY - this.dragOffset.y;

      // Keep button within viewport
      const maxX = window.innerWidth - this.button.offsetWidth;
      const maxY = window.innerHeight - this.button.offsetHeight;
      const boundedX = Math.max(0, Math.min(x, maxX));
      const boundedY = Math.max(0, Math.min(y, maxY));

      this.button.style.left = `${boundedX}px`;
      this.button.style.top = `${boundedY}px`;

      // Check for snap targets
      const snapTarget = this.findClosestSnapTarget(e.clientX, e.clientY);

      if (snapTarget) {
        this.currentSnapTarget = snapTarget;
        this.showSnapIndicator(snapTarget.snapPoint.x, snapTarget.snapPoint.y);
      } else {
        this.currentSnapTarget = null;
        this.hideSnapIndicator();
      }
    };

    const handleMouseUp = async (e) => {
      if (!this.isDragging) return;

      e.preventDefault();
      e.stopPropagation();

      this.isDragging = false;
      this.button.style.opacity = '1';

      // Determine final position
      let positionData;

      if (this.currentSnapTarget) {
        // Attach to target element
        const target = this.currentSnapTarget.target;
        const anchor = this.currentSnapTarget.anchor;
        const snapPoint = this.currentSnapTarget.snapPoint;

        // Calculate offset from snap point
        const buttonRect = this.button.getBoundingClientRect();
        const offset = {
          x: buttonRect.left - snapPoint.x + (buttonRect.width / 2),
          y: buttonRect.top - snapPoint.y + (buttonRect.height / 2)
        };

        // Create CSS selector for the target element
        const selector = this.generateSelector(target.element);

        positionData = {
          mode: 'attached',
          attachedTo: {
            selector: selector,
            platform: this.domObserver.platform,
            offset: offset,
            anchor: anchor,
            label: target.label
          }
        };

        // Start position tracking
        if (this.positionTracker) {
          this.positionTracker.stop();
        }
        this.positionTracker = new PositionTracker(
          this.button,
          target.element,
          offset,
          anchor
        );
        this.positionTracker.start();

        console.log(`[DragAttachManager] Attached to ${target.label} (${anchor} side)`);
      } else {
        // Fixed position
        const buttonRect = this.button.getBoundingClientRect();
        positionData = {
          mode: 'fixed',
          left: `${buttonRect.left}px`,
          top: `${buttonRect.top}px`,
          right: 'auto',
          bottom: 'auto'
        };

        console.log('[DragAttachManager] Set to fixed position');
      }

      // Save position
      if (this.onSave) {
        await this.onSave(positionData);
      }

      // Cleanup
      this.cleanup();

      // Remove event listeners
      this.button.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleCancel);

      // Callback
      if (onComplete) {
        onComplete(positionData);
      }
    };

    const handleCancel = (e) => {
      if (e.key === 'Escape') {
        this.isDragging = false;
        this.cleanup();

        this.button.removeEventListener('mousedown', handleMouseDown);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('keydown', handleCancel);

        if (onComplete) {
          onComplete(null);
        }
      }
    };

    // Add event listeners
    this.button.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleCancel);
  }

  /**
   * Generate a CSS selector for an element
   */
  generateSelector(element) {
    // Try ID first
    if (element.id) {
      return `#${element.id}`;
    }

    // Try data-testid
    if (element.hasAttribute('data-testid')) {
      return `[data-testid="${element.getAttribute('data-testid')}"]`;
    }

    // Try aria-label
    if (element.hasAttribute('aria-label')) {
      return `${element.tagName.toLowerCase()}[aria-label="${element.getAttribute('aria-label')}"]`;
    }

    // Try class + type
    if (element.className && element.type) {
      const classes = Array.from(element.classList).slice(0, 2).join('.');
      return `${element.tagName.toLowerCase()}.${classes}[type="${element.type}"]`;
    }

    // Fallback to tag + type
    if (element.type) {
      return `${element.tagName.toLowerCase()}[type="${element.type}"]`;
    }

    // Last resort: tag name
    return element.tagName.toLowerCase();
  }

  /**
   * Cleanup drag mode
   */
  cleanup() {
    this.button.style.cursor = 'pointer';
    this.button.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)';
    this.button.style.transition = '';
    this.button.style.zIndex = '9999';

    if (this.snapIndicator) {
      this.snapIndicator.remove();
      this.snapIndicator = null;
    }

    this.currentSnapTarget = null;
  }

  /**
   * Load and apply saved attachment
   */
  async loadAttachment(positionData) {
    if (!positionData || positionData.mode !== 'attached') {
      return false;
    }

    const attachmentConfig = positionData.attachedTo;
    if (!attachmentConfig) {
      return false;
    }

    // Find the target element
    const targetElement = document.querySelector(attachmentConfig.selector);
    if (!targetElement) {
      console.warn(`[DragAttachManager] Could not find target element: ${attachmentConfig.selector}`);
      return false;
    }

    // Start position tracking
    if (this.positionTracker) {
      this.positionTracker.stop();
    }

    this.positionTracker = new PositionTracker(
      this.button,
      targetElement,
      attachmentConfig.offset,
      attachmentConfig.anchor
    );
    this.positionTracker.start();

    console.log(`[DragAttachManager] Loaded attachment to ${attachmentConfig.label}`);
    return true;
  }

  /**
   * Stop tracking and detach
   */
  detach() {
    if (this.positionTracker) {
      this.positionTracker.stop();
      this.positionTracker = null;
    }
  }
}

export default DragAttachManager;
