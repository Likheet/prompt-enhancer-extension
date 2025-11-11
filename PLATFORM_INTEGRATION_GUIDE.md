# Platform Integration Guide

This guide explains how to add support for new AI chat platforms to the prompt enhancer extension.

## Architecture Overview

Each platform has an **isolated** configuration in `src/content/docking-strategies.js`. Changes to one platform **do not affect** others.

## Adding a New Platform

### 1. Identify the Platform

First, ensure the platform is detected in `src/content/dom-observer.js`:

```javascript
detectPlatform() {
  const hostname = window.location.hostname;
  
  if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) {
    return 'chatgpt';
  }
  // Add your platform here:
  if (hostname.includes('yourplatform.com')) {
    return 'yourplatform';
  }
  
  return 'unknown';
}
```

### 2. Add Docking Strategy

Open `src/content/docking-strategies.js` and add a new entry:

```javascript
export const DOCKING_STRATEGIES = {
  // ... existing platforms ...
  
  yourplatform: {
    // STEP 1: Find where to insert the button
    findAnchor(inputElement) {
      // Use queryFirst helper to find DOM elements
      const toolbar = queryFirst([
        'div.your-toolbar-class',
        'div[data-testid="toolbar"]'
      ]);
      
      if (!toolbar) return null;
      
      const sendButton = queryFirst([
        'button[aria-label="Send"]',
        'button.send-btn'
      ], toolbar);
      
      return {
        container: toolbar,           // Where to insert
        referenceNode: sendButton,    // Insert relative to this
        position: 'before'            // 'before', 'after', or 'append'
      };
    },
    
    // STEP 2: Style the button to match the platform
    applyStyles(button) {
      // Always set className first to clear previous platform styles
      button.className = 'ape-inline-button ape-yourplatform-button';
      
      // Set ALL style properties (use '' to clear inherited styles)
      Object.assign(button.style, {
        // Position
        position: 'relative',
        left: 'auto',
        right: 'auto',
        top: 'auto',
        bottom: 'auto',
        zIndex: '',
        
        // Size
        width: 'auto',
        height: '36px',
        minWidth: '36px',
        
        // Visual
        borderRadius: '8px',
        padding: '8px',
        backgroundColor: '',
        color: '',
        border: '',
        boxShadow: '',
        
        // Layout
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        
        // Spacing
        marginLeft: '',
        marginRight: '12px'
      });
      
      // RTL support
      if (document.dir === 'rtl') {
        button.style.marginLeft = '12px';
        button.style.marginRight = '';
      }
    },
    
    // STEP 3: Validate the anchor is still valid
    validate(container) {
      if (!container || !container.isConnected) return false;
      
      // Check if key elements still exist
      const toolbar = queryFirst([
        'div.your-toolbar-class'
      ], container);
      
      return Boolean(toolbar);
    }
  }
};
```

### 3. Test Your Integration

1. Run `npm run build`
2. Reload the extension in your browser
3. Navigate to the platform
4. Verify:
   - Button appears in correct location
   - Button matches platform's visual style
   - Button repositions correctly when page updates
   - Button doesn't affect other platforms

## Platform Examples

### Inline Positioning (ChatGPT, Claude)
Button sits within the native toolbar, next to send button:
- Use relative positioning
- Match native button size/style
- Insert before/after specific elements

### Toolbar Positioning (Gemini)
Button is part of a horizontal toolbar:
- Use flex layout
- Match toolbar button spacing
- Consider left vs right alignment

### Universal Fallback
Fixed position bottom-right corner:
- Use fixed positioning
- Higher z-index for visibility
- Larger size for accessibility

## Style Guidelines

### DO:
✅ Reset ALL style properties in `applyStyles`  
✅ Use unique `className` per platform  
✅ Set empty string `''` to clear styles  
✅ Support RTL layouts  
✅ Match native button dimensions  

### DON'T:
❌ Assume styles from other platforms  
❌ Use `!important` in inline styles  
❌ Hard-code pixel positions  
❌ Forget to clear inherited styles  

## Common Patterns

### Finding Nested Elements
```javascript
const parent = queryFirst(['div.parent']);
const child = queryFirst(['button.child'], parent); // Search within parent
```

### Handling Multiple Selectors
```javascript
const button = queryFirst([
  'button[data-testid="send"]',  // Primary
  'button[aria-label*="Send"]',   // Fallback
  'button.send-btn'               // Last resort
]);
```

### Inserting After Element
```javascript
return {
  container: toolbar,
  referenceNode: element.nextSibling,  // Next sibling
  position: 'before'                    // Insert before that sibling
};
```

### Wrapping Parent Search
```javascript
const wrapper = element.closest('div.wrapper');  // Find ancestor
const parent = element.parentElement;            // Direct parent
```

## Troubleshooting

### Button doesn't appear
- Check browser console for errors
- Verify `findAnchor` returns valid container
- Ensure platform is detected in `dom-observer.js`

### Button in wrong position
- Inspect DOM to find correct selectors
- Test `position: 'before'` vs `'after'` vs `'append'`
- Verify `referenceNode` is correct element

### Styles not applying
- Check `resetButtonStyles()` clears all properties
- Use unique `className` for the platform
- Set all style properties (don't assume defaults)

### Button affects other platforms
- Each platform should reset ALL styles in `applyStyles`
- Never modify shared CSS classes
- Use platform-specific class names

## Adding Platform Support Checklist

- [ ] Add platform detection in `dom-observer.js`
- [ ] Add docking strategy in `docking-strategies.js`
- [ ] Implement `findAnchor()` method
- [ ] Implement `applyStyles()` method with full style reset
- [ ] Implement `validate()` method
- [ ] Test on target platform
- [ ] Verify other platforms still work
- [ ] Run `npm run build` successfully
- [ ] Document any platform-specific quirks

## Future Expansion

The current system supports:
- **ChatGPT** (chat.openai.com)
- **Claude** (claude.ai)
- **Gemini** (gemini.google.com)
- **Universal** (fallback for all sites)
- **Generic** (inline near submit button)

You can add support for:
- Perplexity AI
- Microsoft Copilot
- Anthropic Console
- OpenAI Playground
- Custom AI interfaces
- Any site with a text input + submit button

Each platform configuration is **completely isolated** and won't interfere with others.
