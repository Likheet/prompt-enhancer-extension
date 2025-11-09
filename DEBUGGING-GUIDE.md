# 🔧 API Key Hardcoding & Testing Guide

## Quick Start: Enable Test Mode

### Option 1: Automatic Test Mode (RECOMMENDED)
To use the hardcoded API key for testing, update `src/shared/test-config.js`:

```javascript
// Set to true to enable test mode
export const TEST_MODE_ENABLED = true;  // ← Change this to true
```

When enabled:
- ✅ API key field auto-fills with `AIzaSyAMfSKy8_8X6nenE9-_RFuBbWGPiVDBPm8`
- ✅ Shows warning banner: "⚠️ TEST MODE ENABLED"
- ✅ Easy to disable for production

### Option 2: Bypass Validation (For Network Issues)
If the API key validation keeps failing due to network/CORS issues:

```javascript
export const BYPASS_API_VALIDATION = true;  // ← Change this to true
```

**⚠️ WARNING**: This completely skips API validation. Only use for development!

### Option 3: Verbose Logging
For detailed debugging information:

```javascript
export const VERBOSE_LOGGING = true;  // ← Already enabled for debugging
```

---

## Step-by-Step: Hardcoding API Key for Testing

### 1. Enable Test Mode
Edit `src/shared/test-config.js`:
```javascript
export const TEST_MODE_ENABLED = true;
```

### 2. Rebuild Extension
```bash
npm run build
```

### 3. Refresh in Chrome
1. Go to `chrome://extensions/`
2. Find "AI Prompt Enhancer"
3. Click the refresh icon (or just reload by clicking "Load unpacked" again)

### 4. Open Options Page
- Right-click extension icon → **Options**
- You should see:
  - ⚠️ **Yellow banner** saying "TEST MODE ENABLED"
  - API key field **pre-filled** with the hardcoded key
  - Everything ready to test!

### 5. Try the Extension
1. Visit `chatgpt.com` or `claude.ai`
2. Type a prompt
3. Click the "Enhance" button
4. Your prompt should be enhanced using the Gemini API!

---

## API Key Details

**Your Test API Key:**
```
AIzaSyAMfSKy8_8X6nenE9-_RFuBbWGPiVDBPm8
```

**Important Notes:**
- ⚠️ This key is **shared/public** for testing only
- 🔐 Never commit this to version control
- 🛡️ Always use secure key management in production
- 📧 Consider rotating the key if used extensively

---

## Debugging: Check if API Key is Working

### In Chrome DevTools (Service Worker)

1. Go to `chrome://extensions/`
2. Click **"Inspect views"** → **"service worker"**
3. Check the **Console** for these logs:

**Successful validation:**
```
[APE] Validating API key with model: gemini-1.5-flash
[APE] API validation response status: 200
[APE] API key validation result: ✓ VALID
```

**Validation failed:**
```
[APE] Validating API key with model: gemini-1.5-flash
[APE] API validation response status: 403
[APE] API validation failed. Status: 403
[APE] Error details: API key not valid. Please pass a valid API key.
[APE] API key validation result: ✗ INVALID
```

---

## Common Issues & Solutions

### ❌ "Invalid API key or API access denied"

**Possible Causes:**

1. **API not enabled in Google Cloud**
   - Visit: https://console.cloud.google.com
   - Enable "Generative Language API"
   - Wait 5-10 minutes for changes to propagate

2. **Key is for wrong project**
   - Get a new key from: https://aistudio.google.com/app/apikey
   - This is simpler and usually works

3. **CORS/Network blocking**
   - Try enabling `BYPASS_API_VALIDATION` temporarily
   - Check Network tab in DevTools for blocked requests

4. **Invalid characters in key**
   - Test mode should handle this, but check:
     - No spaces
     - No special characters
     - Full key copied correctly

**Solution:**
```javascript
// test-config.js
export const TEST_MODE_ENABLED = true;
export const BYPASS_API_VALIDATION = true;  // ← Add this temporarily
export const VERBOSE_LOGGING = true;
```

Then rebuild and test with enhanced logging.

---

## Testing the Full Enhancement Flow

### Manual Test Flow

1. **Enable test mode** → Rebuild → Refresh extension

2. **Open Options page:**
   - Should see yellow warning banner ✓
   - API key pre-filled ✓
   - Subscription shows "BYOK Tier" ✓

3. **Open ChatGPT:**
   - Type: `"improve this code"`
   - Click enhance button
   - Should see spinner
   - Prompt should update with enhanced version

4. **Check DevTools:**
   - Service Worker console should show:
     ```
     [APE] API key validation result: ✓ VALID
     [APE] Subscription Manager loaded
     ```
   - Page Console should show:
     ```
     [Content Script] Enhancement started
     [Content Script] Using preset: balanced
     [Content Script] Enhanced prompt applied
     ```

### Expected Behavior

| Component | Expected | What to Check |
|-----------|----------|---------------|
| **Options Page** | Yellow warning banner | `chrome://extensions/` → Options |
| **API Field** | Pre-filled key | Look for `AIzaSy...` |
| **Subscription** | "BYOK Tier" badge | Options page badge |
| **Enhancement** | Works without saving | Click enhance on ChatGPT |
| **Console** | Validation success | F12 → Console on ChatGPT page |

---

## Advanced: Custom API Key Validation

To test with your own API key instead of the hardcoded one:

### Option A: Manual Entry (Easiest)
1. Disable test mode: `TEST_MODE_ENABLED = false`
2. Rebuild
3. Open Options page
4. Paste your own API key
5. Click "Save Key"

### Option B: Change Hardcoded Key
1. Edit `src/shared/test-config.js`
2. Change the `HARDCODED_API_KEY` value
3. Keep `TEST_MODE_ENABLED = true`
4. Rebuild

```javascript
export const HARDCODED_API_KEY = 'YOUR_OWN_KEY_HERE';
```

### Option C: Multiple Test Keys
Create a simple selection UI:

```javascript
export const TEST_MODE_ENABLED = true;
export const AVAILABLE_TEST_KEYS = {
  'Primary Key': 'AIzaSyAMfSKy8_8X6nenE9-_RFuBbWGPiVDBPm8',
  'Secondary Key': 'YOUR_BACKUP_KEY_HERE',
};
export const DEFAULT_TEST_KEY = 'Primary Key';
```

---

## Cleanup Checklist: Before Production

- [ ] Set `TEST_MODE_ENABLED = false`
- [ ] Set `BYPASS_API_VALIDATION = false`
- [ ] Remove hardcoded API key (or use env variable)
- [ ] Remove test-config.js from production build
- [ ] Add test-config.js to .gitignore
- [ ] Verify API key validation works properly
- [ ] Test with real API key in production

---

## Debugging Commands in DevTools Console

Run these in the appropriate DevTools console:

**Service Worker Console:**
```javascript
// Check subscription status
chrome.storage.local.get(['subscription'], (result) => {
  console.log('Subscription:', result);
});

// Check if API key is stored
chrome.storage.local.get(['enhancerSettings'], (result) => {
  console.log('Settings (key will be masked):', result);
});
```

**Page Console (ChatGPT/Claude):**
```javascript
// Check if content script loaded
console.log('[Debug] Content script active:', window.location.href);

// Check stored API key (masked)
chrome.storage.local.get(['enhancerSettings'], (result) => {
  if (result.enhancerSettings?.geminiKey) {
    console.log('API Key found (first 10 chars):', result.enhancerSettings.geminiKey.substring(0, 10));
  }
});
```

---

## File Reference

| File | Purpose |
|------|---------|
| `src/shared/test-config.js` | Test configuration & hardcoded key |
| `src/background/subscription-manager.js` | API validation logic (updated for test mode) |
| `src/options/options.js` | Options page (auto-fills key in test mode) |
| `src/shared/constants.js` | API constants & configuration |

---

## Quick Reference: Test Mode Toggle

**To ENABLE test mode:**
```javascript
// src/shared/test-config.js
export const TEST_MODE_ENABLED = true;  // ← TRUE
```

**To DISABLE test mode:**
```javascript
// src/shared/test-config.js
export const TEST_MODE_ENABLED = false;  // ← FALSE
```

**Then:**
```bash
npm run build
```

**Then:**
1. Reload extension in `chrome://extensions/`
2. Or refresh the options page

---

## Next Steps

1. ✅ Enable test mode in `test-config.js`
2. ✅ Run `npm run build`
3. ✅ Reload extension
4. ✅ Open Options page → Verify yellow banner + pre-filled key
5. ✅ Test on ChatGPT → Try enhancement
6. ✅ Check DevTools console → Verify logs
7. ✅ Iterate & debug as needed

Good luck! 🚀
