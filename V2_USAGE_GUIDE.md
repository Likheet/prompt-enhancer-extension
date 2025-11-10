# Prompt Enhancer V2 - Usage Guide

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [How It Works](#how-it-works)
4. [Using the Extension](#using-the-extension)
5. [Managing Profiles](#managing-profiles)
6. [Creating Custom Profiles](#creating-custom-profiles)
7. [Debugging](#debugging)
8. [Integrating Your API](#integrating-your-api)
9. [Troubleshooting](#troubleshooting)

---

## Overview

The Prompt Enhancer V2 uses a **profile-based architecture** to intelligently place an "Enhance" button on AI chat interfaces. It supports:

- **Site-specific profiles**: Pre-configured for ChatGPT, Claude, Gemini, and more
- **Universal fallback**: Works on any site with chat-like input fields
- **SPA support**: Automatically adapts to DOM changes and route navigation
- **Flexible placement**: Multiple positioning modes (toolbar, inside input, inline, etc.)

---

## Installation

### Option 1: Load Unpacked (Development)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right)
4. Click "Load unpacked"
5. Select the `src/v2` directory

### Option 2: Build and Load

If you have a build process:

```bash
npm install
npm run build
```

Then load the `dist` directory as an unpacked extension.

---

## How It Works

### Architecture Components

1. **ProfileManager**: Loads and matches profiles for the current URL
2. **PromptDetector**: Finds prompt input fields using selectors or heuristics
3. **ButtonController**: Creates and manages the enhance button
4. **Watcher**: Monitors DOM changes and keeps the button attached

### Profile Matching Priority

1. Exact URL match
2. Domain + path pattern match (e.g., `chatgpt.com` + `/c/*`)
3. Domain-only match
4. Universal fallback (heuristic detection)

---

## Using the Extension

### Basic Usage

1. Navigate to an AI chat site (e.g., ChatGPT, Claude)
2. The extension automatically detects the prompt input
3. An enhance button (✨) appears near the input field
4. Type your prompt
5. Click the enhance button
6. The prompt is enhanced and replaced in the input field

### Keyboard Shortcuts

Currently, the extension uses click-based interaction. Keyboard shortcuts can be added by editing the button controller.

---

## Managing Profiles

### Viewing Current Profile

Open the browser console (F12) and run:

```javascript
window.__PromptEnhancer__.getActiveProfile()
```

This returns the profile being used for the current page.

### Viewing All Profiles

```javascript
window.__PromptEnhancer__.getAllProfiles()
```

Returns an array of all loaded profiles.

### Reset to Default Profiles

If you've made changes and want to reset:

```javascript
await window.__PromptEnhancer__.resetProfiles()
```

This restores the built-in profiles for ChatGPT, Claude, and Gemini.

---

## Creating Custom Profiles

### Profile Structure

Each profile is a JavaScript object with these fields:

```javascript
{
  id: "unique-profile-id",           // Required: Unique identifier
  name: "Human-readable name",       // Optional: For UI display
  domain: "example.com",             // Required: Domain to match
  pathPattern: "/chat/*",            // Optional: Path glob pattern
  url: null,                         // Optional: Exact URL match (highest priority)

  promptSelector: "textarea#input",  // Required: CSS selector for prompt field
  anchorSelector: "div.toolbar",     // Optional: CSS selector for anchor element

  mode: "inside-bottom-right",       // Required: Placement mode
  offsetX: "12px",                   // Required: Horizontal offset
  offsetY: "12px",                   // Required: Vertical offset
  size: "32px",                      // Optional: Button size

  enabled: true                      // Required: Whether profile is active
}
```

### Placement Modes

- `inside-bottom-right`: Button positioned absolutely inside the prompt box, bottom-right corner
- `inside-top-right`: Button positioned absolutely inside the prompt box, top-right corner
- `inside-bottom-left`: Button positioned absolutely inside the prompt box, bottom-left corner
- `inside-top-left`: Button positioned absolutely inside the prompt box, top-left corner
- `inline-after`: Button inserted in DOM right after the prompt field
- `toolbar`: Button inserted into a toolbar/action bar (requires `anchorSelector`)

### Adding a Profile (Via Console)

1. Open the page you want to create a profile for
2. Open browser console (F12)
3. Inspect the prompt input element to find its CSS selector
4. Run:

```javascript
// Example: Adding a profile for a custom site
const newProfile = {
  id: "mysite-custom-profile",
  name: "My Custom Chat Site",
  domain: "mychatsite.com",
  pathPattern: null,  // Matches all paths on this domain
  promptSelector: "textarea.chat-input",
  anchorSelector: null,  // Use prompt element as anchor
  mode: "inside-bottom-right",
  offsetX: "16px",
  offsetY: "16px",
  size: "32px",
  enabled: true
};

// Save the profile
const pm = window.__PromptEnhancer__.profileManager;
await pm.saveProfile(newProfile);

// Remount button to test
await window.__PromptEnhancer__.remount();
```

### Adding a Profile (Via Storage)

You can also directly edit `chrome.storage.sync`:

```javascript
chrome.storage.sync.get(['promptenhancer_profiles'], (data) => {
  const profiles = data.promptenhancer_profiles || [];

  profiles.push({
    id: "mysite-profile",
    domain: "example.com",
    pathPattern: "/chat/*",
    promptSelector: "textarea.chat-input",
    mode: "inside-bottom-right",
    offsetX: "12px",
    offsetY: "12px",
    enabled: true
  });

  chrome.storage.sync.set({ promptenhancer_profiles: profiles }, () => {
    console.log('Profile saved! Reload the page to apply.');
  });
});
```

### Example: ChatGPT Profile

```javascript
{
  id: "chatgpt-main",
  domain: "chatgpt.com",
  pathPattern: "/c/*",
  promptSelector: "textarea#prompt-textarea",
  anchorSelector: "form div.ms-auto.flex.items-center",
  mode: "toolbar",
  offsetX: "0px",
  offsetY: "0px",
  size: "32px",
  enabled: true
}
```

This profile:
- Matches `chatgpt.com/c/*` (all chat pages)
- Finds the prompt textarea by ID
- Inserts the button into the action toolbar
- Uses toolbar mode (inline with other buttons)

### Example: Generic Contenteditable Profile

```javascript
{
  id: "generic-contenteditable",
  domain: "*.ai",  // Wildcard domain
  pathPattern: null,
  promptSelector: "div[contenteditable=\"true\"]",
  anchorSelector: null,
  mode: "inside-bottom-right",
  offsetX: "12px",
  offsetY: "12px",
  size: "28px",
  enabled: true
}
```

---

## Debugging

### Debug Interface

The extension exposes a global debug interface:

```javascript
window.__PromptEnhancer__
```

#### Available Methods

```javascript
// Remount the button (useful after making changes)
window.__PromptEnhancer__.remount()

// Get active profile for current page
window.__PromptEnhancer__.getActiveProfile()

// Get all loaded profiles
window.__PromptEnhancer__.getAllProfiles()

// Reset to default profiles
await window.__PromptEnhancer__.resetProfiles()

// Access components directly
window.__PromptEnhancer__.profileManager
window.__PromptEnhancer__.promptDetector
window.__PromptEnhancer__.buttonController
window.__PromptEnhancer__.watcher
```

### Checking Button State

```javascript
// Check if button is mounted
window.__PromptEnhancer__.buttonController.isMounted()

// Check current prompt element
window.__PromptEnhancer__.watcher.currentPromptElement

// Check current profile
window.__PromptEnhancer__.watcher.currentProfile
```

### Console Logging

The extension logs important events to the console with prefixes:

- `[ProfileManager]`: Profile loading and matching
- `[PromptDetector]`: Element detection
- `[ButtonController]`: Button lifecycle and events
- `[Watcher]`: DOM monitoring and remounting
- `[PromptEnhancer]`: General application logs

Enable verbose logging in your browser console to see all messages.

---

## Integrating Your API

### 1. Update the Background Script

Edit `src/v2/background.js` and replace the `enhancePrompt` function:

```javascript
async function enhancePrompt(text) {
  const response = await fetch('https://your-api.com/enhance', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_API_KEY'
    },
    body: JSON.stringify({ prompt: text })
  });

  if (!response.ok) {
    throw new Error('API request failed: ' + response.statusText);
  }

  const data = await response.json();
  return data.enhanced_prompt;
}
```

### 2. Using API Keys from Storage

For better security, store API keys in `chrome.storage`:

```javascript
// Save API key
chrome.storage.sync.set({ apiKey: 'your-api-key' });

// Use in background script
async function enhancePrompt(text) {
  const { apiKey } = await chrome.storage.sync.get(['apiKey']);

  if (!apiKey) {
    throw new Error('API key not configured');
  }

  const response = await fetch('https://your-api.com/enhance', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({ prompt: text })
  });

  // ... rest of implementation
}
```

### 3. Error Handling

The background script should return:

```javascript
// Success
{
  ok: true,
  text: "Enhanced prompt text..."
}

// Error
{
  ok: false,
  error: "Error message"
}
```

The button controller will display appropriate tooltips based on these responses.

---

## Troubleshooting

### Button Not Appearing

1. **Check Console**: Open F12 and look for errors
2. **Check Profile**: Run `window.__PromptEnhancer__.getActiveProfile()` - is it correct?
3. **Check Selector**: The `promptSelector` might be wrong. Inspect the page to find the correct selector.
4. **Manual Remount**: Try `window.__PromptEnhancer__.remount()`

### Button Appears But Doesn't Work

1. **Check Background Script**: Is it loaded? Check `chrome://extensions/` for errors
2. **Check API Implementation**: The stub implementation in `background.js` needs to be replaced with your actual API
3. **Check Console**: Look for error messages during enhancement

### Button Disappears on SPA Navigation

The Watcher should handle this automatically, but if it doesn't:

1. Check console for `[Watcher]` logs
2. The MutationObserver might be getting overwhelmed. Try increasing `mutationDebounceMs` in `watcher.js`

### Selector Not Working

If your `promptSelector` isn't finding the element:

1. **Use Multiple Selectors**: Separate with commas:
   ```javascript
   promptSelector: "textarea#input, textarea.chat-input, div[contenteditable]"
   ```

2. **Wait for Element**: The Watcher retries up to 5 times. If the element appears late, increase `maxRetries` or adjust the delay.

3. **Check Specificity**: Your selector might be too specific or not specific enough.

### Styling Issues

If the button doesn't blend well:

1. **Check Button Styles**: The button tries to copy colors from the input field
2. **Override in CSS**: Edit `src/v2/styles.css` to customize appearance
3. **Adjust Placement**: Try different modes (`inside-*`, `inline-after`, `toolbar`)

---

## Advanced Topics

### Custom Heuristic Scoring

To adjust how the fallback detection scores candidates, edit `src/v2/prompt-detector.js`:

```javascript
// Adjust scoring weights in defaultProfile
this.defaultProfile = {
  minWidth: 300,
  minHeight: 60,
  preferBottom: true,
  scoreWeights: {
    size: 1.0,       // Weight for element size
    position: 0.5,   // Weight for position (bottom of page)
    semantics: 0.3   // Weight for semantic attributes (placeholder, aria-label, etc.)
  }
};
```

### Path Pattern Examples

```javascript
// Exact path
pathPattern: "/chat"

// Wildcard (any characters except /)
pathPattern: "/chat/*"

// Deep wildcard (any characters including /)
pathPattern: "/chat/**"

// Multiple levels
pathPattern: "/user/*/chat/*"

// Optional segments
pathPattern: "/chat?"

// Regex (converted internally)
pathPattern: "/c/[a-f0-9-]+"
```

### Domain Pattern Examples

```javascript
// Exact domain
domain: "chatgpt.com"

// Subdomain wildcard
domain: "*.openai.com"  // Matches api.openai.com, chat.openai.com, etc.

// Note: Cross-domain matching requires host_permissions in manifest.json
```

---

## Examples

See `src/v2/example-profiles.json` for ready-to-use profiles for popular AI chat sites:

- ChatGPT
- Claude
- Gemini
- Perplexity
- HuggingFace Chat
- Poe.com
- Microsoft Copilot

Copy and modify these profiles as needed for your use case.

---

## API Reference

### ProfileManager

```javascript
await profileManager.initialize()
profileManager.getActiveProfile(url)
await profileManager.saveProfile(profile)
await profileManager.deleteProfile(profileId)
profileManager.getProfileById(profileId)
profileManager.getAllProfiles()
await profileManager.updateDefaultProfile(settings)
profileManager.getDefaultProfile()
await profileManager.resetToDefaults()
```

### PromptDetector

```javascript
promptDetector.detectWithProfile(profile)
promptDetector.detectWithHeuristics()
promptDetector.findElement(selector)
promptDetector.isUsableElement(element)
```

### ButtonController

```javascript
buttonController.mount(promptElement, anchorElement, placement)
buttonController.unmount()
buttonController.isMounted()
buttonController.showLoading()
buttonController.hideLoading()
```

### Watcher

```javascript
await watcher.start()
watcher.stop()
await watcher.remount()
```

---

## Contributing

To contribute profiles for new sites:

1. Create a profile following the structure above
2. Test it thoroughly on the target site
3. Add it to `example-profiles.json`
4. Submit a pull request

---

## License

MIT License - see LICENSE file for details
