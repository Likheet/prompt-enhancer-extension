# Adding a New Platform Guide

This guide provides step-by-step instructions for adding support for a new AI chat platform to the AI Prompt Enhancer extension.

## Overview

Adding a new platform requires modifications to 4 files:
1. `manifest.json` - Add permissions and content script matches
2. `src/shared/constants.js` - Add platform constant
3. `src/content/dom-observer.js` - Add platform detection and selectors
4. `src/content/docking-strategies.js` - Add positioning strategy

## Step-by-Step Process

### 1. Update `manifest.json`

Add the new platform's URL to both `host_permissions` and `content_scripts.matches`:

```json
{
  "host_permissions": [
    "https://chat.openai.com/*",
    "https://chatgpt.com/*",
    "https://claude.ai/*",
    "https://gemini.google.com/*",
    "https://www.perplexity.ai/*",
    "https://new-platform.com/*"  // ← Add this
  ],
  
  "content_scripts": [
    {
      "matches": [
        "https://chat.openai.com/*",
        "https://chatgpt.com/*",
        "https://claude.ai/*",
        "https://gemini.google.com/*",
        "https://www.perplexity.ai/*",
        "https://new-platform.com/*"  // ← Add this
      ],
      ...
    }
  ]
}
```

**⚠️ Critical:** Without this step, the extension won't run on the new platform at all!

---

### 2. Add Platform Constant

**File:** `src/shared/constants.js`

Add the new platform to the `PLATFORMS` object:

```javascript
export const PLATFORMS = {
  CHATGPT: 'chatgpt',
  CLAUDE: 'claude',
  GEMINI: 'gemini',
  PERPLEXITY: 'perplexity',
  NEW_PLATFORM: 'newplatform',  // ← Add this (use lowercase for value)
  GENERIC: 'generic'
};
```

---

### 3. Add Platform Detection and Selectors

**File:** `src/content/dom-observer.js`

#### 3.1 Add Detection Logic

In the `detectPlatform()` method, add hostname detection:

```javascript
detectPlatform() {
  const hostname = window.location.hostname.toLowerCase();
  console.log('[APE] Detecting platform for hostname:', hostname);

  if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) {
    console.log('[APE] Platform detected: ChatGPT');
    return PLATFORMS.CHATGPT;
  }
  // ... other platforms ...
  
  if (hostname.includes('new-platform.com')) {  // ← Add this
    console.log('[APE] Platform detected: NewPlatform');
    return PLATFORMS.NEW_PLATFORM;
  }

  console.log('[APE] Platform detected: Generic');
  return PLATFORMS.GENERIC;
}
```

#### 3.2 Add DOM Selectors

In the `getPlatformSelectors()` method, add selectors for finding key elements:

```javascript
[PLATFORMS.NEW_PLATFORM]: {
  inputArea: [
    'textarea[placeholder*="keyword"]',  // Most specific first
    'textarea',                          // Generic fallback
    'div[contenteditable="true"]'        // Alternative input type
  ],
  sendButton: [
    'button[data-testid="send-button"]',
    'button[type="submit"]',
    'button:has(svg)'                    // Button containing SVG icon
  ],
  messageContainer: [
    'div[class*="message"]',
    'div[role="article"]'
  ],
  userMessage: [
    'div[class*="user"]',
    'div[data-role="user"]'
  ],
  assistantMessage: [
    'div[class*="assistant"]',
    'div[data-role="assistant"]'
  ],
  conversationArea: [
    'main',
    'div[class*="conversation"]'
  ]
},
```

**Tips for finding selectors:**
- Open browser DevTools (F12)
- Use "Inspect Element" on the textarea, buttons, and messages
- Look for unique attributes: `data-testid`, `data-*`, `id`, unique classes
- Order selectors from most specific to most generic
- Test with `document.querySelector()` in console

---

### 4. Add Docking Strategy

**File:** `src/content/docking-strategies.js`

Add a complete docking strategy with three methods:

```javascript
newplatform: {
  findAnchor() {
    console.log('[APE NewPlatform] Starting anchor search...');
    
    // Strategy 1: Find the specific toolbar/container
    const toolbar = document.querySelector('div[data-component="toolbar"]');
    console.log('[APE NewPlatform] Toolbar found:', !!toolbar);
    if (toolbar) {
      console.log('[APE NewPlatform] Using toolbar strategy');
      return {
        container: toolbar,
        referenceNode: toolbar.firstChild,
        position: 'before',        // 'before', 'after', or omit for append
        needsWrapper: false        // Set true if button needs <span> wrapper
      };
    }

    // Strategy 2: Fallback approach
    const inputElement = queryFirst([
      'textarea',
      'div[contenteditable="true"]'
    ]);
    
    if (!inputElement) {
      console.warn('[APE NewPlatform] No anchor found!');
      return null;
    }

    const container = inputElement.closest('div[class*="input-container"]');
    if (container) {
      console.log('[APE NewPlatform] Using input container strategy');
      return {
        container: container,
        referenceNode: null,
        position: 'append'
      };
    }

    return null;
  },
  
  applyStyles(button) {
    button.className = 'ape-inline-button ape-newplatform-button';
    Object.assign(button.style, {
      position: 'relative',
      left: 'auto',
      bottom: 'auto',
      right: 'auto',
      top: 'auto',
      width: 'auto',
      height: '32px',           // Match platform's button height
      minWidth: '32px',
      borderRadius: '8px',      // Match platform's border radius
      padding: '6px',           // Match platform's padding
      display: 'inline-flex',   // or 'flex' depending on layout
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: '',
      marginRight: '8px',       // Spacing from adjacent elements
      backgroundColor: '',      // Leave empty to inherit
      color: '',                // Leave empty to inherit
      border: '',
      boxShadow: '',
      zIndex: '',
      transition: 'all 300ms ease-out',
      cursor: 'pointer'
    });

    // RTL support
    if (document.dir === 'rtl') {
      button.style.marginLeft = '8px';
      button.style.marginRight = '';
    }
  },
  
  validate(container) {
    if (!container || !container.isConnected) return false;

    // Validate the anchor is still valid
    const inputElement = queryFirst([
      'textarea',
      'div[contenteditable="true"]'
    ]);

    return Boolean(inputElement && inputElement.isConnected);
  }
},
```

**Key configuration options:**

| Property | Values | Description |
|----------|--------|-------------|
| `position` | `'before'`, `'after'`, omit | Where to insert relative to `referenceNode` |
| `needsWrapper` | `true`, `false` | Wrap button in `<span>` (needed for Perplexity) |
| `height` | `'32px'`, `'36px'`, etc. | Match native button size |
| `borderRadius` | `'6px'`, `'8px'`, etc. | Match native button style |
| `padding` | `'6px'`, `'4px 8px'`, etc. | Internal button spacing |
| `marginRight` | `'6px'`, `'8px'`, etc. | Space between buttons |

---

## Testing Checklist

After adding the new platform:

- [ ] Run `npm run build` successfully
- [ ] Reload extension in browser (`chrome://extensions/` → Reload)
- [ ] Navigate to the new platform
- [ ] Check browser console for `[APE] Platform detected: NewPlatform`
- [ ] Verify button appears in correct location
- [ ] Test button click functionality
- [ ] Test button styling matches native buttons
- [ ] Test on page navigation (SPA routing)
- [ ] Test RTL support if applicable

---

## Common Issues & Solutions

### Button Doesn't Appear

**Problem:** Extension not running on the platform
- **Solution:** Check `manifest.json` includes the domain in both `host_permissions` and `content_scripts.matches`
- **Verify:** Reload extension after manifest changes

**Problem:** Platform detection failing
- **Solution:** Check console for detection logs, verify hostname pattern in `detectPlatform()`

**Problem:** `findAnchor()` returning null
- **Solution:** Add console logs to strategy, inspect actual DOM structure with DevTools

### Button Appears in Wrong Location

**Problem:** Wrong container selected
- **Solution:** Inspect the actual button toolbar in DevTools, update selectors in `findAnchor()`

**Problem:** Button position incorrect
- **Solution:** Try different `position` values: `'before'`, `'after'`, or append
- **Solution:** Check if `needsWrapper: true` is needed (compare to native buttons)

### Button Styling Doesn't Match

**Problem:** Size/spacing wrong
- **Solution:** Inspect native platform buttons, copy their computed styles (height, padding, margin, border-radius)

**Problem:** Colors don't match theme
- **Solution:** Leave `backgroundColor`, `color`, `border` as empty strings to inherit platform styles

### Button Disappears After Navigation

**Problem:** SPA routing removes button
- **Solution:** The `MutationObserver` should handle this automatically
- **Verify:** `validate()` method correctly checks if anchor still exists

---

## Example: Real Implementation (Perplexity)

Here's the actual working implementation for reference:

### manifest.json
```json
"https://www.perplexity.ai/*"
```

### constants.js
```javascript
PERPLEXITY: 'perplexity'
```

### dom-observer.js
```javascript
// Detection
if (hostname.includes('perplexity.ai')) {
  return PLATFORMS.PERPLEXITY;
}

// Selectors
[PLATFORMS.PERPLEXITY]: {
  inputArea: [
    'textarea[placeholder*="Ask anything"]',
    'textarea[placeholder*="Type @"]',
    'textarea',
    'div[contenteditable="true"][role="textbox"]'
  ],
  sendButton: [
    'button[aria-label*="Send"]',
    'button[type="submit"]',
    'button:has(svg)'
  ],
  messageContainer: [
    'div[class*="message"]',
    'div[class*="Message"]'
  ]
}
```

### docking-strategies.js
```javascript
perplexity: {
  findAnchor() {
    const rightToolbar = document.querySelector('div[data-cplx-component="query-box-pplx-right-toolbar-components-wrapper"]');
    if (rightToolbar) {
      return {
        container: rightToolbar,
        referenceNode: rightToolbar.firstChild,
        position: 'before',
        needsWrapper: true
      };
    }
    return null;
  },
  applyStyles(button) {
    button.className = 'ape-inline-button ape-perplexity-button';
    Object.assign(button.style, {
      height: '32px',
      aspectRatio: '9/8',
      borderRadius: '8px',
      padding: '0px 4px',
      display: 'inline-flex',
      marginRight: '0px',
      // ... other styles
    });
  },
  validate(container) {
    return container?.isConnected && !!document.querySelector('textarea, div[contenteditable="true"]');
  }
}
```

---

## Quick Reference: Files to Modify

| File | What to Add | Example |
|------|-------------|---------|
| `manifest.json` | Domain permissions | `"https://platform.com/*"` |
| `src/shared/constants.js` | Platform constant | `PLATFORM: 'platform'` |
| `src/content/dom-observer.js` | Detection + selectors | `if (hostname.includes('platform.com'))` |
| `src/content/docking-strategies.js` | Complete strategy | `platform: { findAnchor, applyStyles, validate }` |

---

## Architecture Notes

### Isolation Principles

Each platform's configuration is **completely isolated**:
- Unique className: `ape-{platform}-button`
- Independent styles: No style inheritance between platforms
- Separate anchor logic: Platform changes don't affect others

### Style Reset System

Before applying platform styles, all properties are cleared:
```javascript
resetButtonStyles() {
  this.currentButton.className = 'ape-inline-button';
  Object.assign(this.currentButton.style, {
    position: '', left: '', right: '', top: '', bottom: '',
    // ... 30+ properties reset to empty
  });
}
```

This ensures no cross-contamination between platforms.

---

## Need Help?

1. Check console logs for `[APE]` prefixed messages
2. Inspect the platform's DOM structure with DevTools
3. Reference existing platform implementations in the codebase
4. Test incrementally: detection → selectors → docking → styling

---

**Last Updated:** November 2025  
**Supported Platforms:** ChatGPT, Claude, Gemini, Perplexity
