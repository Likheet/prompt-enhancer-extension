/**
 * PromptDetector
 * Finds prompt input fields using either profiles or heuristics
 */

class PromptDetector {
  constructor(defaultProfile) {
    this.defaultProfile = defaultProfile || {
      minWidth: 300,
      minHeight: 60,
      preferBottom: true,
      scoreWeights: {
        size: 1.0,
        position: 0.5,
        semantics: 0.3
      }
    };
  }

  /**
   * Detect prompt field using a profile
   * Returns { promptElement, anchorElement } or null
   */
  detectWithProfile(profile) {
    if (!profile) return null;

    console.log('[PromptDetector] Detecting with profile:', profile.id);

    // Find prompt element using promptSelector
    const promptElement = this.findElement(profile.promptSelector);
    if (!promptElement) {
      console.warn('[PromptDetector] Prompt element not found with selector:', profile.promptSelector);
      return null;
    }

    // Validate element is usable
    if (!this.isUsableElement(promptElement)) {
      console.warn('[PromptDetector] Prompt element is not usable');
      return null;
    }

    // Find anchor element if specified, otherwise use prompt element
    let anchorElement = promptElement;
    if (profile.anchorSelector) {
      const foundAnchor = this.findElement(profile.anchorSelector);
      if (foundAnchor) {
        anchorElement = foundAnchor;
      } else {
        console.warn('[PromptDetector] Anchor not found, using prompt element');
      }
    }

    console.log('[PromptDetector] Detected prompt and anchor elements');
    return { promptElement, anchorElement };
  }

  /**
   * Detect prompt field using heuristics (fallback mode)
   * Returns { promptElement, anchorElement } or null
   */
  detectWithHeuristics() {
    console.log('[PromptDetector] Using heuristic detection');

    const candidates = this.findCandidates();
    if (candidates.length === 0) {
      console.warn('[PromptDetector] No candidates found');
      return null;
    }

    // Score and rank candidates
    const scored = candidates.map(element => ({
      element,
      score: this.scoreCandidate(element)
    }));

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    console.log('[PromptDetector] Found', scored.length, 'candidates, best score:', scored[0].score);

    const best = scored[0].element;
    return {
      promptElement: best,
      anchorElement: best.parentElement || best
    };
  }

  /**
   * Find candidate prompt elements
   */
  findCandidates() {
    const candidates = [];

    // Find textareas
    const textareas = Array.from(document.querySelectorAll('textarea'));
    for (const textarea of textareas) {
      if (this.isUsableElement(textarea) && this.meetsMinimumSize(textarea)) {
        candidates.push(textarea);
      }
    }

    // Find large text inputs
    const textInputs = Array.from(document.querySelectorAll('input[type="text"], input[type="search"]'));
    for (const input of textInputs) {
      if (this.isUsableElement(input) && this.meetsMinimumSize(input)) {
        candidates.push(input);
      }
    }

    // Find contenteditable elements
    const editables = Array.from(document.querySelectorAll('[contenteditable="true"]'));
    for (const editable of editables) {
      if (this.isUsableElement(editable) && this.meetsMinimumSize(editable)) {
        candidates.push(editable);
      }
    }

    return candidates;
  }

  /**
   * Score a candidate element based on multiple heuristics
   */
  scoreCandidate(element) {
    let score = 0;
    const weights = this.defaultProfile.scoreWeights;

    // Size score: larger elements are more likely to be chat inputs
    const sizeScore = this.getSizeScore(element);
    score += sizeScore * weights.size;

    // Position score: chat inputs are often near the bottom
    const positionScore = this.getPositionScore(element);
    score += positionScore * weights.position;

    // Semantic score: check for chat-like attributes
    const semanticScore = this.getSemanticScore(element);
    score += semanticScore * weights.semantics;

    return score;
  }

  /**
   * Calculate size score (0-1)
   */
  getSizeScore(element) {
    const rect = element.getBoundingClientRect();
    const area = rect.width * rect.height;

    // Normalize: larger areas get higher scores
    // Assuming max relevant area is ~1000px * 500px = 500,000px²
    const maxArea = 500000;
    const normalizedArea = Math.min(area / maxArea, 1);

    return normalizedArea;
  }

  /**
   * Calculate position score (0-1)
   * Higher score for elements near the bottom of the viewport
   */
  getPositionScore(element) {
    if (!this.defaultProfile.preferBottom) {
      return 0.5; // Neutral if no preference
    }

    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const elementMiddle = rect.top + rect.height / 2;

    // Normalize: bottom elements get higher scores
    const normalizedPosition = elementMiddle / viewportHeight;

    // Convert to 0-1 where 1 is at the bottom
    return normalizedPosition;
  }

  /**
   * Calculate semantic score (0-1)
   * Check for prompt-like attributes and text
   */
  getSemanticScore(element) {
    let score = 0;
    let checks = 0;

    // Check placeholder text
    const placeholder = element.placeholder || element.getAttribute('placeholder') || '';
    if (placeholder) {
      checks++;
      if (this.isPromptLikePlaceholder(placeholder)) {
        score += 1;
      }
    }

    // Check aria-label
    const ariaLabel = element.getAttribute('aria-label') || '';
    if (ariaLabel) {
      checks++;
      if (this.isPromptLikeLabel(ariaLabel)) {
        score += 1;
      }
    }

    // Check ID and class names
    const id = element.id || '';
    const className = element.className || '';
    const combined = (id + ' ' + className).toLowerCase();

    checks++;
    if (combined.includes('prompt') || combined.includes('message') ||
        combined.includes('input') || combined.includes('chat')) {
      score += 1;
    }

    // Check if element is in a form
    checks++;
    if (element.closest('form')) {
      score += 0.5;
    }

    return checks > 0 ? score / checks : 0;
  }

  /**
   * Check if placeholder text suggests this is a prompt input
   */
  isPromptLikePlaceholder(text) {
    const lower = text.toLowerCase();
    const keywords = [
      'message', 'prompt', 'ask', 'chat', 'type', 'send',
      'enter', 'question', 'reply', 'write'
    ];
    return keywords.some(keyword => lower.includes(keyword));
  }

  /**
   * Check if label suggests this is a prompt input
   */
  isPromptLikeLabel(text) {
    const lower = text.toLowerCase();
    const keywords = [
      'message', 'prompt', 'input', 'chat', 'send', 'enter'
    ];
    return keywords.some(keyword => lower.includes(keyword));
  }

  /**
   * Check if element meets minimum size requirements
   */
  meetsMinimumSize(element) {
    const rect = element.getBoundingClientRect();
    return rect.width >= this.defaultProfile.minWidth &&
           rect.height >= this.defaultProfile.minHeight;
  }

  /**
   * Check if element is usable (visible, enabled, etc.)
   */
  isUsableElement(element) {
    if (!element) return false;
    if (!element.isConnected) return false;

    // Check if visible
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;

    // Check display and visibility
    const style = window.getComputedStyle(element);
    if (style.display === 'none') return false;
    if (style.visibility === 'hidden') return false;
    if (style.opacity === '0') return false;

    // Check if disabled or readonly
    if (element.disabled) return false;
    if (element.readOnly) return false;
    if (element.hasAttribute('disabled')) return false;
    if (element.hasAttribute('readonly')) return false;

    return true;
  }

  /**
   * Find element by CSS selector with error handling
   * Supports comma-separated selectors (tries each until one works)
   */
  findElement(selector) {
    if (!selector) return null;

    // Split by comma for multiple selectors
    const selectors = selector.split(',').map(s => s.trim());

    for (const sel of selectors) {
      try {
        const element = document.querySelector(sel);
        if (element) {
          return element;
        }
      } catch (error) {
        console.warn('[PromptDetector] Invalid selector:', sel, error);
        continue;
      }
    }

    return null;
  }

  /**
   * Find all elements matching selector
   */
  findElements(selector) {
    if (!selector) return [];

    const selectors = selector.split(',').map(s => s.trim());
    const elements = [];

    for (const sel of selectors) {
      try {
        const found = Array.from(document.querySelectorAll(sel));
        elements.push(...found);
      } catch (error) {
        console.warn('[PromptDetector] Invalid selector:', sel, error);
        continue;
      }
    }

    return elements;
  }
}

export default PromptDetector;
