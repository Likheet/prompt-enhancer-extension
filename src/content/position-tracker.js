/**
 * Position Tracker
 * Tracks and updates button position when attached to elements
 */

class PositionTracker {
  constructor(button, targetElement, offset, anchor) {
    this.button = button;
    this.targetElement = targetElement;
    this.offset = offset; // { x, y }
    this.anchor = anchor; // 'left', 'right', 'top', 'bottom'
    this.isTracking = false;
    this.animationFrameId = null;

    this.mutationObserver = null;
    this.resizeObserver = null;
    this.scrollHandler = null;
  }

  /**
   * Start tracking the target element's position
   */
  start() {
    if (this.isTracking) return;

    this.isTracking = true;
    this.updatePosition();

    // Track DOM mutations (element position changes, style changes)
    this.mutationObserver = new MutationObserver(() => {
      this.scheduleUpdate();
    });

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });

    // Track resize events
    this.resizeObserver = new ResizeObserver(() => {
      this.scheduleUpdate();
    });

    if (this.targetElement) {
      this.resizeObserver.observe(this.targetElement);
    }

    // Track scroll events
    this.scrollHandler = () => this.scheduleUpdate();
    window.addEventListener('scroll', this.scrollHandler, true);
    window.addEventListener('resize', this.scrollHandler);

    console.log('[PositionTracker] Started tracking');
  }

  /**
   * Schedule a position update (debounced with requestAnimationFrame)
   */
  scheduleUpdate() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    this.animationFrameId = requestAnimationFrame(() => {
      this.updatePosition();
    });
  }

  /**
   * Update button position based on target element
   */
  updatePosition() {
    if (!this.targetElement || !this.button) {
      console.warn('[PositionTracker] Missing target element or button');
      return;
    }

    // Check if target still exists in DOM
    if (!document.body.contains(this.targetElement)) {
      console.warn('[PositionTracker] Target element no longer in DOM');
      this.stop();
      return;
    }

    const targetRect = this.targetElement.getBoundingClientRect();
    const buttonRect = this.button.getBoundingClientRect();

    let left, top;

    // Calculate position based on anchor
    switch (this.anchor) {
      case 'left':
        left = targetRect.left + this.offset.x;
        top = targetRect.top + (targetRect.height / 2) - (buttonRect.height / 2) + this.offset.y;
        break;
      case 'right':
        left = targetRect.right + this.offset.x;
        top = targetRect.top + (targetRect.height / 2) - (buttonRect.height / 2) + this.offset.y;
        break;
      case 'top':
        left = targetRect.left + (targetRect.width / 2) - (buttonRect.width / 2) + this.offset.x;
        top = targetRect.top + this.offset.y;
        break;
      case 'bottom':
        left = targetRect.left + (targetRect.width / 2) - (buttonRect.width / 2) + this.offset.x;
        top = targetRect.bottom + this.offset.y;
        break;
      default:
        left = targetRect.left + this.offset.x;
        top = targetRect.top + this.offset.y;
    }

    // Apply position with smooth transition
    this.button.style.position = 'fixed';
    this.button.style.left = `${left}px`;
    this.button.style.top = `${top}px`;
    this.button.style.right = 'auto';
    this.button.style.bottom = 'auto';
  }

  /**
   * Stop tracking
   */
  stop() {
    this.isTracking = false;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler, true);
      window.removeEventListener('resize', this.scrollHandler);
      this.scrollHandler = null;
    }

    console.log('[PositionTracker] Stopped tracking');
  }

  /**
   * Update tracking parameters
   */
  updateTracking(targetElement, offset, anchor) {
    this.stop();
    this.targetElement = targetElement;
    this.offset = offset;
    this.anchor = anchor;
    this.start();
  }
}

export default PositionTracker;
