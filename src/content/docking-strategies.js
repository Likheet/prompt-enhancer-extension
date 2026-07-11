/**
 * Composer-scoped strategies for placing the enhancer beside native controls.
 * Selectors are intentionally resolved from the selected prompt editor outwards:
 * a control from another (possibly hidden) composer must never become the anchor.
 */

const CONTROL_SELECTOR = 'button, input[type="submit"], [role="button"]';

const SELECTORS = {
  attach: [
    '[data-testid*="attachment" i]',
    '[data-testid*="attach" i]',
    'button[iconname="add_circle"]',
    '[aria-label*="attach" i]',
    '[aria-label*="add file" i]',
    '[aria-label*="add content" i]',
    '[aria-label*="upload" i]',
    '[aria-label*="insert asset" i]'
  ],
  model: [
    '[data-testid="model-selector-dropdown"]',
    '[data-testid*="model-selector" i]',
    '[data-test-id="bard-mode-menu-button"]',
    'button.__composer-pill[aria-haspopup="menu"]',
    'button[data-pill="true"][aria-haspopup="menu"]',
    '[aria-label*="model picker" i]',
    '[aria-label*="model selector" i]',
    '[aria-label*="choose model" i]',
    '[aria-label*="mode picker" i]'
  ],
  send: [
    '#composer-submit-button',
    '[data-testid="send-button"]',
    '[data-testid="composer-send-button"]',
    '[data-testid*="send-button" i]',
    'button[type="submit"]',
    'input[type="submit"]',
    '[aria-label*="send" i]',
    '[aria-label*="submit" i]',
    '[aria-label*="run prompt" i]',
    'button[aria-label="Run" i]'
  ],
  sources: [
    '[data-testid="sources-switcher-button"]',
    '[data-testid*="source" i]',
    '[aria-label*="source" i]',
    '[aria-label="Search" i]'
  ]
};

function isUsable(element) {
  if (!element || !element.isConnected || element.hidden) return false;
  if (element.getAttribute?.('aria-hidden') === 'true') return false;

  try {
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  } catch (_error) {
    return true;
  }
}

function queryAll(selectors, root = document) {
  const matches = [];
  for (const selector of selectors || []) {
    try {
      for (const node of root.querySelectorAll(selector)) {
        if (!matches.includes(node) && isUsable(node)) matches.push(node);
      }
    } catch (_error) {
      // A site must not break mounting if one experimental selector is invalid.
    }
  }
  return matches;
}

function findAction(root, kind) {
  return queryAll(SELECTORS[kind], root)[0] || null;
}

function hasComposerSignal(element) {
  const signal = [
    element.tagName,
    element.id,
    element.className,
    element.getAttribute?.('data-testid'),
    element.getAttribute?.('data-type')
  ].filter(Boolean).join(' ').toLowerCase();

  return /form|fieldset|composer|prompt|query-box|chat-input|input-area|text-input/.test(signal);
}

function findComposerRoot(inputElement) {
  if (!inputElement?.isConnected) return null;

  const ancestors = [];
  let current = inputElement.parentElement;
  while (current && current !== document.body) {
    ancestors.push(current);
    current = current.parentElement;
  }

  const withActions = ancestors.find((candidate) => {
    if (!isUsable(candidate)) return false;
    return Boolean(
      findAction(candidate, 'send') ||
      findAction(candidate, 'attach') ||
      findAction(candidate, 'model') ||
      findAction(candidate, 'sources')
    );
  });

  if (withActions) {
    const semantic = ancestors.find((candidate) =>
      candidate.contains(withActions) && hasComposerSignal(candidate)
    );
    return semantic || withActions;
  }

  return ancestors.find(hasComposerSignal) || inputElement.parentElement;
}

function directChildFor(element, container) {
  if (!element || !container?.contains(element)) return null;
  let directChild = element;
  while (directChild.parentElement && directChild.parentElement !== container) {
    directChild = directChild.parentElement;
  }
  return directChild.parentElement === container ? directChild : null;
}

function findToolbar(action, composer) {
  if (!action || !composer?.contains(action)) return null;
  let current = action.parentElement;
  let oneControlFallback = null;

  while (current && current !== composer.parentElement) {
    const signal = [
      current.className,
      current.id,
      current.getAttribute?.('data-testid'),
      current.getAttribute?.('data-cplx-component'),
      current.getAttribute?.('role')
    ].filter(Boolean).join(' ').toLowerCase();
    const controlCount = current.querySelectorAll(CONTROL_SELECTOR).length;

    if (controlCount >= 2 || /toolbar|actions|controls|trailing|leading/.test(signal)) {
      return current;
    }
    if (!oneControlFallback && controlCount === 1) oneControlFallback = current;
    if (current === composer) break;
    current = current.parentElement;
  }

  return oneControlFallback || composer;
}

function createActionAnchor(inputElement, action, position = 'before', extra = {}) {
  const composer = findComposerRoot(inputElement);
  if (!composer || !action || !composer.contains(action)) return null;
  const container = findToolbar(action, composer);
  const referenceNode = directChildFor(action, container);
  if (!container || !referenceNode) return null;

  return {
    composer,
    inputElement,
    action,
    container,
    referenceNode,
    position,
    ...extra
  };
}

function appendAnchor(inputElement, composer = findComposerRoot(inputElement)) {
  if (!composer) return null;
  const action = findAction(composer, 'send') || findAction(composer, 'attach');
  const container = action ? findToolbar(action, composer) : composer;
  return {
    composer,
    inputElement,
    action,
    container,
    referenceNode: null,
    position: 'append'
  };
}

function controlSize(anchor) {
  const reference = anchor?.action || anchor?.referenceNode;
  const height = reference?.getBoundingClientRect?.().height || 36;
  return Math.max(32, Math.min(40, Math.round(height))) || 36;
}

function applyNativeControlStyles(button, platform, anchor) {
  const size = controlSize(anchor);
  const nativeControl = anchor?.action || anchor?.referenceNode;
  let nativeColor = '#5f6368';
  try {
    const computedColor = nativeControl && window.getComputedStyle(nativeControl).color;
    if (computedColor && computedColor !== 'rgba(0, 0, 0, 0)') nativeColor = computedColor;
  } catch (_error) {
    // The neutral fallback works in isolated and test documents.
  }

  button.className = `ape-inline-button ape-${platform}-button`;
  button.dataset.apeDockMode = anchor?.position || 'append';
  Object.assign(button.style, {
    position: 'relative',
    inset: 'auto',
    width: `${size}px`,
    height: `${size}px`,
    minWidth: `${size}px`,
    minHeight: `${size}px`,
    maxWidth: `${size}px`,
    maxHeight: `${size}px`,
    flex: `0 0 ${size}px`,
    borderRadius: '9999px',
    padding: '0',
    margin: '0 2px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    backgroundColor: 'transparent',
    color: nativeColor,
    border: 'none',
    boxShadow: 'none',
    cursor: 'pointer',
    zIndex: 'auto'
  });
}

function validate(container, anchor) {
  if (!container?.isConnected) return false;
  if (!anchor) return true;
  return Boolean(
    anchor.composer?.isConnected &&
    anchor.inputElement?.isConnected &&
    anchor.composer.contains(anchor.inputElement) &&
    (!anchor.action || anchor.composer.contains(anchor.action))
  );
}

function platformStrategy(platform, findAnchor) {
  return {
    findAnchor,
    applyStyles(button, _container, anchor) {
      applyNativeControlStyles(button, platform, anchor);
    },
    validate
  };
}

function genericAnchor(inputElement, options = {}) {
  const composer = findComposerRoot(inputElement);
  if (!composer) return null;

  const placement = options.placement || 'auto';
  const attach = findAction(composer, 'attach');
  const send = findAction(composer, 'send');

  if (placement === 'after-attach' && attach) {
    return createActionAnchor(inputElement, attach, 'after');
  }
  if (placement === 'before-send' && send) {
    return createActionAnchor(inputElement, send, 'before');
  }
  if (placement === 'composer-end') {
    return appendAnchor(inputElement, composer);
  }

  if (send) return createActionAnchor(inputElement, send, 'before');
  if (attach) return createActionAnchor(inputElement, attach, 'after');
  return appendAnchor(inputElement, composer);
}

export const DOCKING_STRATEGIES = {
  chatgpt: platformStrategy('chatgpt', (inputElement) => {
    const composer = findComposerRoot(inputElement);
    if (!composer) return null;
    const model = findAction(composer, 'model');
    if (model) return createActionAnchor(inputElement, model, 'before');
    const send = findAction(composer, 'send');
    if (send) return createActionAnchor(inputElement, send, 'before');
    const attach = findAction(composer, 'attach');
    return attach ? createActionAnchor(inputElement, attach, 'after') : null;
  }),

  claude: platformStrategy('claude', (inputElement) => {
    const composer = findComposerRoot(inputElement);
    if (!composer) return null;
    const attach = findAction(composer, 'attach');
    if (attach) return createActionAnchor(inputElement, attach, 'after');
    const model = findAction(composer, 'model');
    if (model) return createActionAnchor(inputElement, model, 'before');
    const send = findAction(composer, 'send');
    return send ? createActionAnchor(inputElement, send, 'before') : null;
  }),

  gemini: platformStrategy('gemini', (inputElement) => {
    const composer = findComposerRoot(inputElement);
    if (!composer) return null;
    const model = findAction(composer, 'model');
    if (model) return createActionAnchor(inputElement, model, 'before');
    const send = findAction(composer, 'send');
    if (send) return createActionAnchor(inputElement, send, 'before');
    const attach = findAction(composer, 'attach');
    return attach ? createActionAnchor(inputElement, attach, 'after') : null;
  }),

  perplexity: platformStrategy('perplexity', (inputElement) => {
    const composer = findComposerRoot(inputElement);
    if (!composer) return null;
    const attach = findAction(composer, 'attach');
    if (attach) return createActionAnchor(inputElement, attach, 'after');
    const sources = findAction(composer, 'sources');
    if (sources) return createActionAnchor(inputElement, sources, 'before');
    const send = findAction(composer, 'send');
    return send ? createActionAnchor(inputElement, send, 'before') : null;
  }),

  aistudio: platformStrategy('aistudio', (inputElement) => {
    const composer = findComposerRoot(inputElement);
    if (!composer) return null;
    const attach = findAction(composer, 'attach');
    if (attach) {
      return createActionAnchor(inputElement, attach, 'before', {
        needsWrapper: true,
        wrapperClass: 'button-wrapper',
        wrapperTag: 'div'
      });
    }
    const run = findAction(composer, 'send');
    return run ? createActionAnchor(inputElement, run, 'before') : null;
  }),

  generic: platformStrategy('generic', genericAnchor),

  universal: platformStrategy('universal', (inputElement, options) =>
    genericAnchor(inputElement, options)
  )
};

export default DOCKING_STRATEGIES;
