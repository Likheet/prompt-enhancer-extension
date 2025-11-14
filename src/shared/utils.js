/**
 * Utility Functions
 */

/**
 * Throttle function execution
 */
export function throttle(func, wait) {
  let timeout;
  let lastRan;

  return function executedFunction(...args) {
    const context = this;

    if (!lastRan) {
      func.apply(context, args);
      lastRan = Date.now();
    } else {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (Date.now() - lastRan >= wait) {
          func.apply(context, args);
          lastRan = Date.now();
        }
      }, wait - (Date.now() - lastRan));
    }
  };
}

/**
 * Debounce function execution
 */
export function debounce(func, wait) {
  let timeout;

  return function executedFunction(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

/**
 * Generate unique ID
 */
export function generateId() {
  return `ape-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Sanitize HTML to prevent XSS
 */
const HTML_ESCAPE_LOOKUP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

const HTML_ESCAPE_REGEX = /[&<>"']/g;

export function sanitizeHTML(html) {
  if (typeof html !== 'string') {
    return '';
  }

  return html.replace(HTML_ESCAPE_REGEX, char => HTML_ESCAPE_LOOKUP[char] || char);
}

const DOM_PARSER = typeof DOMParser !== 'undefined' ? new DOMParser() : null;

/**
 * Safely replace element content using DOMParser to avoid innerHTML
 */
export function renderStaticHTML(target, html) {
  if (!target) return;

  if (!html) {
    target.replaceChildren();
    return;
  }

  if (!DOM_PARSER) {
    target.textContent = html;
    return;
  }

  const parsed = DOM_PARSER.parseFromString(`<body>${html}</body>`, 'text/html');
  const fragment = document.createDocumentFragment();

  while (parsed.body.firstChild) {
    fragment.appendChild(parsed.body.firstChild);
  }

  target.replaceChildren(fragment);
}

/**
 * Extract keywords from text
 */
export function extractKeywords(text, minLength = 4) {
  const stopWords = new Set([
    'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'as', 'are',
    'was', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does',
    'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
    'can', 'to', 'of', 'in', 'for', 'with', 'from', 'up', 'about',
    'into', 'through', 'during', 'how', 'when', 'where', 'why',
    'what', 'which', 'who', 'whom', 'whose', 'this', 'that', 'these',
    'those', 'then', 'than', 'there', 'their', 'they'
  ]);

  return text
    .toLowerCase()
    .split(/\W+/)
    .filter(word => word.length >= minLength && !stopWords.has(word));
}

/**
 * Calculate text similarity (simple Jaccard similarity)
 */
export function calculateSimilarity(text1, text2) {
  const words1 = new Set(extractKeywords(text1));
  const words2 = new Set(extractKeywords(text2));

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Hash string (simple hash for deduplication)
 */
export function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Wait for element to appear in DOM
 */
export function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        obs.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

/**
 * Detect intent from prompt
 */
export function detectIntent(prompt) {
  const lower = prompt.toLowerCase();

  const patterns = {
    question: /^(what|who|where|when|why|how|is|are|can|could|would|should)/,
    request: /(please|could you|can you|would you|i need|i want|help me)/,
    code: /(write|create|implement|function|code|program|script|debug|fix|error)/,
    explanation: /(explain|describe|tell me about|what is|define)/,
    analysis: /(analyze|compare|evaluate|assess|review)/,
    creative: /(story|poem|creative|imagine|design|idea|draft)/,
    troubleshooting: /(error|problem|issue|not working|bug|broken|failed)/
  };

  for (const [intent, pattern] of Object.entries(patterns)) {
    if (pattern.test(lower)) return intent;
  }

  return 'general';
}

/**
 * Format timestamp
 */
export function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  }
}

/**
 * Retry async function with exponential backoff
 */
export async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      const delay = baseDelay * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
