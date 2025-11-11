/**
 * Platform-specific strategies for docking the inline enhance button.
 * 
 * ARCHITECTURE:
 * Each platform has an ISOLATED configuration with:
 * - findAnchor(inputElement?): Locates where to insert the button
 * - applyStyles(button): Sets platform-specific size, spacing, colors
 * - validate(container): Checks if the anchor is still valid
 * 
 * ADDING NEW PLATFORMS:
 * 1. Add a new key to DOCKING_STRATEGIES (e.g., 'perplexity')
 * 2. Implement the three methods above
 * 3. Changes are ISOLATED—won't affect other platforms
 * 
 * UNIVERSAL FALLBACK:
 * Use 'universal' strategy for bottom-right fixed positioning
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
      button.className = 'ape-inline-button ape-chatgpt-button';
      Object.assign(button.style, {
        position: 'relative',
        left: 'auto',
        right: 'auto',
        top: 'auto',
        bottom: 'auto',
        zIndex: '10',
        width: '32px',
        height: '32px',
        minWidth: '32px',
        minHeight: '32px',
        borderRadius: '6px',
        padding: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: '',
        marginRight: '12px',
        backgroundColor: 'transparent',
        color: 'currentColor',
        border: 'none',
        boxShadow: '',
        cursor: 'pointer',
        transition: 'background-color 0.2s ease'
      });

      if (document.dir === 'rtl') {
        button.style.marginLeft = '12px';
        button.style.marginRight = '';
      } else {
        button.style.marginRight = '12px';
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
      button.className = 'ape-inline-button ape-claude-button';
      Object.assign(button.style, {
        position: 'relative',
        left: 'auto',
        bottom: 'auto',
        right: 'auto',
        top: 'auto',
        width: 'auto',
        height: '32px',
        minWidth: '32px',
        borderRadius: '0.5rem',
        padding: '0 7.5px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: '',
        marginRight: '',
        backgroundColor: '',
        color: '',
        border: '',
        boxShadow: '',
        zIndex: ''
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
      button.className = 'ape-inline-button ape-gemini-button';
      Object.assign(button.style, {
        position: 'relative',
        left: 'auto',
        bottom: 'auto',
        right: 'auto',
        top: 'auto',
        width: 'auto',
        height: '32px',
        minWidth: '32px',
        borderRadius: '4px',
        padding: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: '',
        marginRight: '6px',
        backgroundColor: '',
        color: '',
        border: '',
        boxShadow: '',
        zIndex: ''
      });

      if (document.dir === 'rtl') {
        button.style.marginLeft = '6px';
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
  perplexity: {
    findAnchor() {
      console.log('[APE Perplexity] Starting anchor search...');
      
      // Strategy 1: Find the right toolbar wrapper
      const rightToolbar = document.querySelector('div[data-cplx-component="query-box-pplx-right-toolbar-components-wrapper"]');
      console.log('[APE Perplexity] Right toolbar found:', !!rightToolbar);
      if (rightToolbar) {
        console.log('[APE Perplexity] Using right toolbar strategy');
        return {
          container: rightToolbar,
          referenceNode: rightToolbar.firstChild,
          position: 'before',
          needsWrapper: true
        };
      }

      // Strategy 2: Find the sources switcher button's parent
      const sourcesSwitcher = document.querySelector('button[data-testid="sources-switcher-button"]');
      console.log('[APE Perplexity] Sources switcher found:', !!sourcesSwitcher);
      if (sourcesSwitcher) {
        const parent = sourcesSwitcher.closest('div[data-cplx-component="query-box-pplx-right-toolbar-components-wrapper"]') ||
                      sourcesSwitcher.parentElement?.parentElement;
        if (parent) {
          console.log('[APE Perplexity] Using sources switcher parent strategy');
          return {
            container: parent,
            referenceNode: parent.firstChild,
            position: 'before',
            needsWrapper: true
          };
        }
      }

      // Strategy 3: Find any toolbar with matching pattern
      const toolbars = document.querySelectorAll('div.flex.items-center, div[class*="items-center"][class*="justify"]');
      console.log('[APE Perplexity] Found', toolbars.length, 'potential toolbars');
      for (const toolbar of toolbars) {
        const hasButtons = toolbar.querySelector('button[data-testid], button[aria-label]');
        if (hasButtons && toolbar.closest('div[class*="query-box"], div[class*="input"]')) {
          console.log('[APE Perplexity] Using generic toolbar strategy');
          return {
            container: toolbar,
            referenceNode: toolbar.firstChild,
            position: 'before',
            needsWrapper: true
          };
        }
      }

      console.warn('[APE Perplexity] No anchor found!');
      return null;
    },
    applyStyles(button) {
      button.className = 'ape-inline-button ape-perplexity-button';
      Object.assign(button.style, {
        position: 'relative',
        left: 'auto',
        bottom: 'auto',
        right: 'auto',
        top: 'auto',
        width: 'auto',
        height: '32px',
        minWidth: 'auto',
        aspectRatio: '9/8',
        borderRadius: '8px',
        padding: '0px 4px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: '',
        marginRight: '0px',
        backgroundColor: '',
        color: '',
        border: '',
        boxShadow: '',
        zIndex: '',
        fontSize: '14px',
        transition: 'all 300ms ease-out',
        cursor: 'pointer'
      });

      if (document.dir === 'rtl') {
        button.style.marginLeft = '0px';
        button.style.marginRight = '';
      }
    },
    validate(container) {
      if (!container || !container.isConnected) return false;

      // Check if we're in a valid input/actions area
      const inputElement = queryFirst([
        'textarea[placeholder*="Ask"]',
        'textarea',
        'div[contenteditable="true"]'
      ]);

      return Boolean(inputElement && inputElement.isConnected);
    }
  },
  universal: {
    findAnchor() {
      // Universal fallback: fixed position bottom-right
      return {
        container: document.body,
        referenceNode: null,
        position: 'append'
      };
    },
    applyStyles(button) {
      button.className = 'ape-inline-button ape-universal-button';
      Object.assign(button.style, {
        position: 'fixed',
        right: '20px',
        bottom: '20px',
        left: 'auto',
        top: 'auto',
        zIndex: '9999',
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        padding: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        backgroundColor: '#6366f1',
        color: '#fff',
        border: 'none',
        cursor: 'pointer',
        marginLeft: '',
        marginRight: ''
      });
    },
    validate() {
      return true; // Always valid for universal positioning
    }
  },
  
  // Generic strategy for sites without specific configuration
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
      button.className = 'ape-inline-button ape-generic-button';
      Object.assign(button.style, {
        position: 'relative',
        left: 'auto',
        bottom: 'auto',
        right: 'auto',
        top: 'auto',
        width: 'auto',
        height: 'auto',
        borderRadius: '4px',
        padding: '8px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: '',
        marginRight: '',
        backgroundColor: '',
        color: '',
        border: ''
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
