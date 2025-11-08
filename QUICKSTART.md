# Quick Start Guide

Get the AI Prompt Enhancer running in 5 minutes!

## Step 1: Create Icon Files (Required)

The extension needs three icon files to load properly. Create simple placeholder PNGs:

**Option A: Use an online tool**
1. Go to https://www.favicon-generator.org/
2. Upload any purple image or create a simple one
3. Download and rename to: `icon-16.png`, `icon-48.png`, `icon-128.png`
4. Place in: `assets/icons/`

**Option B: Use DALL-E/Midjourney**
```
Prompt: "Create a modern purple gradient app icon with a sparkle symbol,
clean minimal design, transparent background, 128x128 pixels"
```
Then resize to 48x48 and 16x16.

**Option C: Create placeholder squares (fastest)**
Use any image editor to create three solid purple (#667eea) square PNGs:
- 16x16 pixels → `assets/icons/icon-16.png`
- 48x48 pixels → `assets/icons/icon-48.png`
- 128x128 pixels → `assets/icons/icon-128.png`

## Step 2: Install Dependencies

```bash
cd prompt-enhancer-extension
npm install
```

## Step 3: Load Extension in Chrome

1. Open Chrome
2. Go to: `chrome://extensions/`
3. Toggle ON "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the `prompt-enhancer-extension` folder
6. Extension should appear in your toolbar!

## Step 4: Test It Out

### Test Free Tier:

1. Go to https://chat.openai.com or https://claude.ai
2. Start typing a prompt (e.g., "explain this")
3. Look for the purple ✨ button in the bottom-right
4. Click it to open the enhancement panel
5. Click "Enhance" button
6. Review the enhanced prompt
7. Click "Apply" to inject it into the input field

### Test BYOK Tier:

1. Get a free Gemini API key: https://aistudio.google.com/app/apikey
2. Click the extension icon in Chrome toolbar
3. Click "Setup" in the BYOK section
4. Paste your API key
5. Click "Save Key"
6. Go back to ChatGPT/Claude
7. Type a prompt and click "Enhance"
8. You should see AI-powered enhancement!

## Troubleshooting

### Extension not loading?
- Check that all three icon files exist in `assets/icons/`
- Look for errors in `chrome://extensions/` (click "Errors" button)
- Try refreshing the extension

### Floating button not appearing?
- Make sure you're on ChatGPT or Claude
- Type something in the input field
- Refresh the page
- Check browser console (F12) for errors

### Enhancement not working?
- Open browser console (F12) and look for `[APE]` messages
- Check your API key if using BYOK
- Try Free tier to isolate the issue

### Selectors breaking?
ChatGPT and Claude update their UI frequently. If the extension can't find the input field:
1. Open `src/content/dom-observer.js`
2. Update selectors in `getPlatformSelectors()`
3. Save and refresh the extension

## Quick Fixes

### Reset Everything:
1. Go to `chrome://extensions/`
2. Find AI Prompt Enhancer
3. Click "Remove"
4. Click "Load unpacked" again

### Clear Settings:
1. Right-click extension icon → "Inspect popup"
2. Go to "Application" tab
3. Storage → Local Storage → Clear

### Check Logs:
```javascript
// In ChatGPT/Claude page console (F12):
window.APE_Extension // See extension state
```

## Development Mode

### Watch for changes:
```bash
npm run watch
```

### Manual reload:
1. Make code changes
2. Go to `chrome://extensions/`
3. Click refresh icon on the extension card
4. Refresh the ChatGPT/Claude tab

### View logs:
- Content script logs: Page console (F12)
- Background worker logs: `chrome://extensions/` → "Service worker" link
- Popup logs: Right-click extension icon → "Inspect popup"

## Next Steps

Once everything works:

1. ✅ Test on multiple ChatGPT conversations
2. ✅ Test on Claude conversations
3. ✅ Test all enhancement strategies
4. ✅ Test BYOK with your Gemini key
5. ✅ Try different settings combinations
6. ✅ Check for edge cases (very long prompts, special characters, etc.)

Then you're ready to share with beta users!

## Need Help?

- Check [IMPLEMENTATION-SUMMARY.md](IMPLEMENTATION-SUMMARY.md) for detailed info
- Read [README.md](README.md) for full documentation
- Look at browser console for `[APE]` debug messages

---

**Happy enhancing! ✨**
