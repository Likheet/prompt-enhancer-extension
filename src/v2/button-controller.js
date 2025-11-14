import { renderStaticHTML } from '../shared/utils.js';

/**
 * ButtonController
 * Creates, positions, and manages the enhance button lifecycle
 */

class ButtonController {
  constructor() {
    this.button = null;
    this.promptElement = null;
    this.anchorElement = null;
    this.placement = null;
    this.isProcessing = false;
  }

  /**
   * Mount button to the DOM with specified placement
   * @param {HTMLElement} promptElement - The prompt input field
   * @param {HTMLElement} anchorElement - The element to anchor button positioning to
   * @param {Object} placement - Placement configuration { mode, offsetX, offsetY, size }
   */
  mount(promptElement, anchorElement, placement) {
    if (!promptElement || !anchorElement) {
      console.error('[ButtonController] Invalid elements provided');
      return false;
    }

    // Unmount existing button if any
    this.unmount();

    this.promptElement = promptElement;
    this.anchorElement = anchorElement;
    this.placement = placement;

    // Create button element
    this.button = this.createButton();

    // Apply placement
    this.applyPlacement();

    console.log('[ButtonController] Button mounted with mode:', placement.mode);
    return true;
  }

  /**
   * Unmount and remove button from DOM
   */
  unmount() {
    if (this.button && this.button.parentElement) {
      this.button.remove();
    }
    this.button = null;
    this.promptElement = null;
    this.anchorElement = null;
    this.placement = null;
  }

  /**
   * Check if button is currently mounted and attached to DOM
   */
  isMounted() {
    return this.button && document.body.contains(this.button);
  }

  /**
   * Create the button element
   */
  createButton() {
    const button = document.createElement('button');
    button.id = 'prompt-enhancer-btn';
    button.className = 'prompt-enhancer-button';
    button.type = 'button';
    button.setAttribute('aria-label', 'Enhance Prompt');
    button.title = 'Enhance Prompt';

    // Button icon (sparkles emoji and loading spinner)
    renderStaticHTML(button, `
      <span class="pe-icon" aria-hidden="true">✨</span>
      <span class="pe-spinner pe-hidden" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <circle cx="12" cy="12" r="10" opacity="0.25"/>
          <path d="M12 2 A10 10 0 0 1 22 12" opacity="0.75">
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 12 12"
              to="360 12 12"
              dur="1s"
              repeatCount="indefinite"/>
          </path>
        </svg>
      </span>
    `);

    // Add click handler
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleClick();
    });

    return button;
  }

  /**
   * Apply placement based on mode
   */
  applyPlacement() {
    const mode = this.placement.mode;

    switch (mode) {
      case 'inside-bottom-right':
        this.applyInsidePlacement('bottom', 'right');
        break;

      case 'inside-top-right':
        this.applyInsidePlacement('top', 'right');
        break;

      case 'inside-bottom-left':
        this.applyInsidePlacement('bottom', 'left');
        break;

      case 'inside-top-left':
        this.applyInsidePlacement('top', 'left');
        break;

      case 'inline-after':
        this.applyInlinePlacement();
        break;

      case 'toolbar':
        this.applyToolbarPlacement();
        break;

      default:
        console.warn('[ButtonController] Unknown mode, using inside-bottom-right');
        this.applyInsidePlacement('bottom', 'right');
    }

    // Apply size
    if (this.placement.size) {
      this.button.style.width = this.placement.size;
      this.button.style.height = this.placement.size;
    }

    // Copy some styles from prompt element for blending
    this.copyStyles();
  }

  /**
   * Apply "inside" placement (absolute positioning within anchor)
   */
  applyInsidePlacement(vertical, horizontal) {
    // Ensure anchor has relative/absolute positioning
    const anchorPosition = window.getComputedStyle(this.anchorElement).position;
    if (anchorPosition === 'static') {
      this.anchorElement.style.position = 'relative';
    }

    // Position button
    this.button.style.position = 'absolute';
    this.button.style.zIndex = '1000';

    // Apply offsets
    if (vertical === 'bottom') {
      this.button.style.bottom = this.placement.offsetY || '8px';
      this.button.style.top = 'auto';
    } else {
      this.button.style.top = this.placement.offsetY || '8px';
      this.button.style.bottom = 'auto';
    }

    if (horizontal === 'right') {
      this.button.style.right = this.placement.offsetX || '8px';
      this.button.style.left = 'auto';
    } else {
      this.button.style.left = this.placement.offsetX || '8px';
      this.button.style.right = 'auto';
    }

    // Append to anchor
    this.anchorElement.appendChild(this.button);
  }

  /**
   * Apply "inline-after" placement (insert after prompt in DOM)
   */
  applyInlinePlacement() {
    this.button.style.position = 'relative';
    this.button.style.display = 'inline-flex';
    this.button.style.marginLeft = this.placement.offsetX || '8px';
    this.button.style.verticalAlign = 'middle';

    // Insert after prompt element
    if (this.promptElement.nextSibling) {
      this.promptElement.parentElement.insertBefore(this.button, this.promptElement.nextSibling);
    } else {
      this.promptElement.parentElement.appendChild(this.button);
    }
  }

  /**
   * Apply "toolbar" placement (insert into toolbar/action bar)
   */
  applyToolbarPlacement() {
    this.button.style.position = 'relative';
    this.button.style.display = 'inline-flex';

    // Find a good insertion point in the toolbar
    // Try to insert before the first button, or append if none found
    const firstButton = this.anchorElement.querySelector('button');
    if (firstButton) {
      this.anchorElement.insertBefore(this.button, firstButton);
    } else {
      this.anchorElement.appendChild(this.button);
    }
  }

  /**
   * Copy visual styles from prompt element to blend in
   */
  copyStyles() {
    try {
      const promptStyles = window.getComputedStyle(this.promptElement);

      // Copy background color if not transparent
      const bgColor = promptStyles.backgroundColor;
      if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
        // Make it slightly different for visibility
        this.button.style.backgroundColor = this.adjustColor(bgColor, 10);
      }

      // Copy text color
      const textColor = promptStyles.color;
      if (textColor) {
        this.button.style.color = textColor;
      }

      // Copy border radius
      const borderRadius = promptStyles.borderRadius;
      if (borderRadius && borderRadius !== '0px') {
        this.button.style.borderRadius = borderRadius;
      }

      // Copy font family
      const fontFamily = promptStyles.fontFamily;
      if (fontFamily) {
        this.button.style.fontFamily = fontFamily;
      }

    } catch (error) {
      console.warn('[ButtonController] Failed to copy styles:', error);
    }
  }

  /**
   * Adjust color brightness (for subtle background color)
   */
  adjustColor(color, amount) {
    // Simple adjustment - parse rgba/rgb and adjust lightness
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (!match) return color;

    const r = Math.min(255, parseInt(match[1]) + amount);
    const g = Math.min(255, parseInt(match[2]) + amount);
    const b = Math.min(255, parseInt(match[3]) + amount);
    const a = match[4] || '1';

    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  /**
   * Handle button click - orchestrate enhancement workflow
   */
  async handleClick() {
    if (this.isProcessing) {
      console.log('[ButtonController] Already processing...');
      return;
    }

    // Extract text from prompt
    const text = this.extractText();
    if (!text || text.trim().length === 0) {
      console.log('[ButtonController] No text to enhance');
      this.showTooltip('No text to enhance', 'warning');
      return;
    }

    this.isProcessing = true;
    this.showLoading();

    try {
      console.log('[ButtonController] Enhancing prompt...', text.length, 'chars');

      // Send message to background script
      const response = await chrome.runtime.sendMessage({
        type: 'ENHANCE_PROMPT',
        text: text
      });

      if (response.ok && response.text) {
        // Replace text in prompt field
        const success = this.replaceText(response.text);

        if (success) {
          console.log('[ButtonController] Enhancement successful');
          this.showTooltip('Prompt enhanced!', 'success');
        } else {
          console.error('[ButtonController] Failed to replace text');
          this.showTooltip('Failed to apply enhancement', 'error');
        }
      } else {
        console.error('[ButtonController] Enhancement failed:', response.error);
        this.showTooltip(response.error || 'Enhancement failed', 'error');
      }

    } catch (error) {
      console.error('[ButtonController] Error during enhancement:', error);
      this.showTooltip('Enhancement error', 'error');
    } finally {
      this.isProcessing = false;
      this.hideLoading();
    }
  }

  /**
   * Extract text from prompt element
   */
  extractText() {
    if (!this.promptElement) return '';

    if (this.promptElement.tagName === 'TEXTAREA' || this.promptElement.tagName === 'INPUT') {
      return this.promptElement.value;
    } else if (this.promptElement.contentEditable === 'true') {
      return this.promptElement.innerText || this.promptElement.textContent || '';
    }

    return '';
  }

  /**
   * Replace text in prompt element
   */
  replaceText(newText) {
    if (!this.promptElement) return false;

    try {
      if (this.promptElement.tagName === 'TEXTAREA' || this.promptElement.tagName === 'INPUT') {
        // For textarea/input
        this.setNativeValue(this.promptElement, newText);

        // Dispatch events so frameworks detect the change
        this.promptElement.dispatchEvent(new Event('input', { bubbles: true }));
        this.promptElement.dispatchEvent(new Event('change', { bubbles: true }));

        // Focus and move cursor to end
        this.promptElement.focus();
        this.promptElement.setSelectionRange(newText.length, newText.length);

      } else if (this.promptElement.contentEditable === 'true') {
        // For contenteditable
        this.promptElement.focus();

        // Clear and set new content
        this.promptElement.replaceChildren();

        // Handle newlines properly
        const lines = newText.split('\n');
        const fragment = document.createDocumentFragment();

        lines.forEach((line, index) => {
          fragment.appendChild(document.createTextNode(line));
          if (index < lines.length - 1) {
            fragment.appendChild(document.createElement('br'));
          }
        });

        this.promptElement.appendChild(fragment);

        // Dispatch input event
        this.promptElement.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: newText
        }));

        // Move cursor to end
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(this.promptElement);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }

      return true;

    } catch (error) {
      console.error('[ButtonController] Error replacing text:', error);
      return false;
    }
  }

  /**
   * Set native value property (for React and other frameworks)
   */
  setNativeValue(element, value) {
    const descriptor = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(element),
      'value'
    );

    if (descriptor && descriptor.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }
  }

  /**
   * Show loading state
   */
  showLoading() {
    if (!this.button) return;

    const icon = this.button.querySelector('.pe-icon');
    const spinner = this.button.querySelector('.pe-spinner');

    if (icon) icon.classList.add('pe-hidden');
    if (spinner) spinner.classList.remove('pe-hidden');

    this.button.disabled = true;
    this.button.classList.add('pe-loading');
  }

  /**
   * Hide loading state
   */
  hideLoading() {
    if (!this.button) return;

    const icon = this.button.querySelector('.pe-icon');
    const spinner = this.button.querySelector('.pe-spinner');

    if (icon) icon.classList.remove('pe-hidden');
    if (spinner) spinner.classList.add('pe-hidden');

    this.button.disabled = false;
    this.button.classList.remove('pe-loading');
  }

  /**
   * Show a temporary tooltip near the button
   */
  showTooltip(message, type = 'info') {
    // Remove existing tooltip
    const existing = document.querySelector('.pe-tooltip');
    if (existing) existing.remove();

    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.className = `pe-tooltip pe-tooltip-${type}`;
    tooltip.textContent = message;

    // Position near button
    if (this.button) {
      const rect = this.button.getBoundingClientRect();
      tooltip.style.position = 'fixed';
      tooltip.style.left = rect.left + 'px';
      tooltip.style.top = (rect.top - 40) + 'px';
      tooltip.style.zIndex = '10001';
    }

    document.body.appendChild(tooltip);

    // Fade in
    setTimeout(() => tooltip.classList.add('pe-tooltip-show'), 10);

    // Remove after delay
    setTimeout(() => {
      tooltip.classList.remove('pe-tooltip-show');
      setTimeout(() => tooltip.remove(), 300);
    }, 3000);
  }
}

export default ButtonController;
