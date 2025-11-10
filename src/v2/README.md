# Prompt Enhancer V2 - Profile-Based Architecture

A Chrome extension that intelligently adds "Enhance Prompt" buttons to AI chat interfaces using a flexible profile-based system.

## 🚀 Quick Start

### 1. Load the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top-right toggle)
3. Click "Load unpacked"
4. Select this directory (`src/v2`)

### 2. Test It

1. Navigate to ChatGPT, Claude, or Gemini
2. The ✨ enhance button should appear automatically
3. Type a prompt and click the button
4. Your prompt will be enhanced (using stub implementation for now)

### 3. Configure Your API

Edit `background.js` and replace the `enhancePrompt` function with your actual API call:

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

  const data = await response.json();
  return data.enhanced_prompt;
}
```

## 📁 File Structure

```
src/v2/
├── manifest.json           # Extension manifest (Manifest V3)
├── background.js          # Background service worker (API calls)
├── content-main.js        # Main content script (entry point)
├── profile-manager.js     # Manages placement profiles
├── prompt-detector.js     # Finds prompt fields (selectors + heuristics)
├── button-controller.js   # Button lifecycle and behavior
├── watcher.js            # DOM monitoring for SPA support
├── styles.css            # Button and UI styles
├── example-profiles.json # Example profile configurations
└── README.md            # This file
```

## 🎯 Core Concepts

### Placement Profiles

Profiles define how to find and place buttons on specific sites:

```javascript
{
  id: "chatgpt-main",
  domain: "chatgpt.com",
  pathPattern: "/c/*",
  promptSelector: "textarea#prompt-textarea",
  anchorSelector: "form div.toolbar",
  mode: "toolbar",
  offsetX: "0px",
  offsetY: "0px",
  enabled: true
}
```

### Placement Modes

- `inside-bottom-right`: Inside prompt box, bottom-right corner
- `inside-top-right`: Inside prompt box, top-right corner
- `inside-bottom-left`: Inside prompt box, bottom-left corner
- `toolbar`: Insert into action toolbar/button bar
- `inline-after`: Insert right after prompt field in DOM

### Profile Matching Priority

1. **Exact URL** match
2. **Domain + path pattern** match
3. **Domain only** match
4. **Universal fallback** (heuristic detection)

## 🛠️ Creating Custom Profiles

### Via Console (Quick)

```javascript
// Open F12 console on the target site
const newProfile = {
  id: "mysite-profile",
  domain: "example.com",
  promptSelector: "textarea.chat-input",
  mode: "inside-bottom-right",
  offsetX: "12px",
  offsetY: "12px",
  enabled: true
};

await window.__PromptEnhancer__.profileManager.saveProfile(newProfile);
window.__PromptEnhancer__.remount();
```

### Via Storage

```javascript
chrome.storage.sync.get(['promptenhancer_profiles'], (data) => {
  const profiles = data.promptenhancer_profiles || [];
  profiles.push(newProfile);
  chrome.storage.sync.set({ promptenhancer_profiles: profiles });
});
```

## 🐛 Debugging

The extension exposes a debug interface:

```javascript
// Available at:
window.__PromptEnhancer__

// Useful commands:
window.__PromptEnhancer__.getActiveProfile()  // Current profile
window.__PromptEnhancer__.getAllProfiles()    // All profiles
window.__PromptEnhancer__.remount()           // Remount button
window.__PromptEnhancer__.resetProfiles()     // Reset to defaults
```

Check console logs with prefixes:
- `[ProfileManager]`
- `[PromptDetector]`
- `[ButtonController]`
- `[Watcher]`

## 📚 Documentation

- **ARCHITECTURE.md**: Detailed architecture overview
- **V2_USAGE_GUIDE.md**: Complete usage and customization guide
- **example-profiles.json**: Pre-configured profiles for popular sites

## ✨ Features

- ✅ Site-specific placement profiles
- ✅ Universal fallback for any site
- ✅ SPA support (automatic DOM tracking)
- ✅ Multiple placement modes
- ✅ Heuristic-based detection
- ✅ Minimal, adaptive styling
- ✅ Framework-compatible (React, Vue, etc.)
- ✅ Profile management via storage
- ✅ Debug interface

## 🔧 Built-in Profiles

The extension includes profiles for:

- ChatGPT (chatgpt.com, chat.openai.com)
- Claude (claude.ai)
- Gemini (gemini.google.com)
- Perplexity (perplexity.ai)
- HuggingFace Chat
- Poe.com
- Microsoft Copilot

More examples in `example-profiles.json`.

## 🚧 Known Limitations

- **Stub API**: The `enhancePrompt` function is stubbed. You need to implement your actual API call.
- **Storage Sync**: Chrome sync storage has quota limits (100KB). Use `chrome.storage.local` for larger datasets.
- **Manifest Permissions**: Currently uses `<all_urls>` for universal support. Restrict in production.

## 📝 TODO

- [ ] Build options page UI for profile management
- [ ] Add import/export for profiles
- [ ] Add keyboard shortcuts (Alt+E, etc.)
- [ ] Add preset enhancement modes (concise, detailed, etc.)
- [ ] Add history/undo functionality
- [ ] Add profile testing/validation tools

## 🤝 Contributing

To add support for a new site:

1. Visit the site
2. Open console (F12)
3. Find the prompt input selector
4. Create a profile (see examples above)
5. Test thoroughly
6. Add to `example-profiles.json`

## 📄 License

MIT License
