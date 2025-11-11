/**
 * Platform-specific strategies for docking the inline enhance button.
 * Each strategy exposes:
 * - findAnchor(inputElement?): returns { container, referenceNode, position }
 * - applyStyles(button, container?): applies inline styles for native alignment
 * - validate(container): optional sanity check to confirm the anchor is still usable
 */

const queryFirst = (selectors, root = document) => {
  if (!Array.isArray(selectors)) return null;
  for (const selector of selectors) {
    if (!selector) continue;
    try {
      const node = root.querySelector(selector);
      if (node) {
        return node;
      }
    } catch (error) {
      continue;
    }
  }
  return null;
};

export const DOCKING_STRATEGIES = {
  chatgpt: {
    findAnchor() {
      const actionBarSelectors = [
        'div[data-testid="composer-actions"]',
        'form div.ms-auto.flex.items-center',
        'form div.ms-auto.flex',
        'form div.flex.items-center.gap-2'
      ];
      const sendButtonSelectors = [
        'button[data-testid="send-button"]',
        'button[id="composer-submit-button"]',
        'button[aria-label*="Send"]'
      ];

      const actionBar = queryFirst(actionBarSelectors);
      if (!actionBar) return null;

      const sendButton = queryFirst(sendButtonSelectors, actionBar);
      const referenceNode = sendButton || actionBar.firstElementChild;

      return {
        container: actionBar,
        referenceNode,
        position: 'before'
      };
    },
    applyStyles(button) {
      button.classList.add('ape-inline-button-chatgpt');
      Object.assign(button.style, {
        position: 'relative',
        left: 'auto',
        right: 'auto',
        top: 'auto',
        bottom: 'auto',
        zIndex: '10'
      });

      if (document.dir === 'rtl') {
        button.style.marginLeft = '0.5rem';
        button.style.marginRight = '';
      } else {
        button.style.marginRight = '0.5rem';
        button.style.marginLeft = '';
      }
    },
    validate(container) {
      if (!container || !container.isConnected) return false;
      const sendButton = queryFirst([
        'button[data-testid="send-button"]',
        'button[id="composer-submit-button"]'
      ], container);
      return Boolean(sendButton);
    }
  },
  claude: {
    findAnchor() {
      const sendButton = queryFirst([
        'fieldset button[aria-label*="Send"]',
        'fieldset button[type="submit"]',
        'button[data-testid*="composer-send"]'
      ]);
      if (!sendButton) return null;

      const controlsRoot = sendButton.closest('div.flex.gap-2\\.5.w-full.items-center');
      if (!controlsRoot) return null;

      const modelDropdown = queryFirst([
        'button[data-testid="model-selector-dropdown"]',
        'button[aria-label*="Sonnet"]',
        'button[data-testid*="model"]'
      ], controlsRoot);

      if (modelDropdown) {
        // Find the wrapper div that contains the dropdown
        const modelWrapper = modelDropdown.closest('div[type="button"]') || 
                            modelDropdown.parentElement;
        
        if (modelWrapper) {
          return {
            container: modelWrapper.parentElement,
            referenceNode: modelWrapper.nextSibling,
            position: 'before'
          };
        }
      }

      return {
        container: controlsRoot,
        referenceNode: null,
        position: 'append'
      };
    },
    applyStyles(button) {
      button.classList.remove('ape-inline-button-chatgpt');
      Object.assign(button.style, {
        position: 'relative',
        left: 'auto',
        bottom: 'auto',
        right: 'auto',
        top: 'auto',
        marginLeft: '',
        marginRight: '',
        height: '32px',
        minWidth: '32px',
        borderRadius: '0.5rem',
        padding: '0 7.5px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      });

      if (document.dir === 'rtl') {
        button.style.marginLeft = '';
      } else {
        button.style.marginRight = '';
      }
    },
    validate(container) {
      if (!container || !container.isConnected) {
        return false;
      }

      const modelDropdownStillPresent = queryFirst([
        'button[data-testid="model-selector-dropdown"]',
        'button[aria-label*="Sonnet"]',
        'button[data-testid*="model"]'
      ], container);

      return Boolean(modelDropdownStillPresent);
    }
  },
  gemini: {
    findAnchor() {
      // Look for the trailing-actions-wrapper (right side of input)
      const trailingActionsWrapper = queryFirst([
        'div.trailing-actions-wrapper',
        'div[class*="trailing-actions"]'
      ]);

      if (trailingActionsWrapper) {
        // Find the model picker container within trailing actions
        const modelPickerContainer = queryFirst([
          'div.model-picker-container',
          'div[class*="model-picker"]'
        ], trailingActionsWrapper);

        if (modelPickerContainer) {
          return {
            container: trailingActionsWrapper,
            referenceNode: modelPickerContainer,
            position: 'before'
          };
        }

        // Fallback: insert at the start of trailing actions
        return {
          container: trailingActionsWrapper,
          referenceNode: trailingActionsWrapper.firstChild,
          position: 'before'
        };
      }

      // Fallback to leading-actions-wrapper if trailing not found
      const leadingActionsWrapper = queryFirst([
        'div.leading-actions-wrapper',
        'div[class*="leading-actions"]'
      ]);

      if (leadingActionsWrapper) {
        return {
          container: leadingActionsWrapper,
          referenceNode: null,
          position: 'append'
        };
      }

      return null;
    },
    applyStyles(button) {
      button.classList.remove('ape-inline-button-chatgpt');
      Object.assign(button.style, {
        position: 'relative',
        left: 'auto',
        bottom: 'auto',
        right: 'auto',
        top: 'auto',
        height: '40px',
        minWidth: '40px',
        borderRadius: '4px',
        padding: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: '',
        marginRight: '8px'
      });

      if (document.dir === 'rtl') {
        button.style.marginLeft = '8px';
        button.style.marginRight = '';
      }
    },
    validate(container) {
      if (!container || !container.isConnected) return false;

      const trailingActionsWrapper = container.closest('div.trailing-actions-wrapper') || 
                                    container;

      return Boolean(trailingActionsWrapper && trailingActionsWrapper.isConnected);
    }
  },
  generic: {
    findAnchor(inputElement) {
      if (!inputElement) return null;
      const container = inputElement.parentElement;
      if (!container) return null;

      const submit = container.querySelector('button[type="submit"], input[type="submit"]');
      if (submit) {
        return {
          container,
          referenceNode: submit,
          position: 'before'
        };
      }
      return null;
    },
    applyStyles(button) {
      button.classList.remove('ape-inline-button-chatgpt');
      Object.assign(button.style, {
        position: 'relative',
        left: 'auto',
        bottom: 'auto',
        right: 'auto',
        top: 'auto',
        marginLeft: '',
        marginRight: ''
      });

      if (document.dir === 'rtl') {
        button.style.marginLeft = '0.5rem';
      } else {
        button.style.marginRight = '0.5rem';
      }
    },
    validate(container) {
      return Boolean(container && container.isConnected);
    }
  }
};

export default DOCKING_STRATEGIES;
