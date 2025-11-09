# 🔍 API Key Debugging Workflow

## Complete Testing Flow: Start to Finish

---

## 1️⃣ RELOAD EXTENSION (30 seconds)

### In Chrome:
```
1. Go to: chrome://extensions/
2. Find: "AI Prompt Enhancer"
3. Click: Refresh icon ↻
```

**Expected:** Extension reloads with new code

---

## 2️⃣ OPEN OPTIONS PAGE (30 seconds)

### Method A (Quick):
```
Right-click extension icon → Options
```

### Method B (Manual):
```
1. Go to: chrome://extensions/
2. Click: "AI Prompt Enhancer"
3. Click: Extension options link
```

---

## 3️⃣ VERIFY TEST MODE IS ACTIVE (15 seconds)

### You should see:

**⚠️ Yellow Warning Banner:**
```
⚠️ TEST MODE ENABLED - Using hardcoded API key for testing
```

**🔑 API Key Field:**
```
[AIzaSyAMfSKy8_8X6nenE9-_RFuBbWGPiVDBPm8]  (pre-filled)
```

**📊 Subscription Status:**
```
BYOK Tier - Using AI-powered enhancement with Gemini
```

### If you DON'T see this:
- ❌ Test mode not enabled
- ❌ Extension not reloaded
- ❌ Cache issue

**Fix:**
1. Hard refresh: `Ctrl+Shift+R`
2. Reload extension again
3. Check `test-config.js` has `TEST_MODE_ENABLED = true`

---

## 4️⃣ TEST ON CHATGPT (2 minutes)

### Visit ChatGPT:
```
https://chatgpt.com/
```

### Type a Simple Prompt:
```
"improve this code"
```

### Look for Enhancement Button:
- Should appear inline next to the input
- Has a gradient background
- Shows "✨" icon

### Click Enhancement Button:
```
[✨ Enhance]
```

### Expected Result:
- ⏳ Spinner appears briefly
- ✅ Prompt updates with enhanced version
- 🎉 Toast notification: "Prompt enhanced successfully!"

**Example:**
```
Before: "improve this code"
After:  "Please review and improve this code. Identify 
        any issues, suggest optimizations, and provide 
        the corrected version with explanatory comments."
```

---

## 5️⃣ VERIFY IN DEVTOOLS (2 minutes)

### Check Service Worker Logs:

```
1. Go to: chrome://extensions/
2. Find: "AI Prompt Enhancer"
3. Click: "Inspect views" → "service worker"
4. Open: DevTools Console (F12)
```

### Look for Success Logs:
```
✅ VALID:
[APE] Validating API key with model: gemini-1.5-flash
[APE] API validation response status: 200
[APE] API key validation result: ✓ VALID
```

### Troubleshoot Errors:
```
❌ INVALID:
[APE] API validation response status: 403
[APE] API key validation failed. Status: 403
[APE] Error details: Invalid or missing API key
```

---

## 6️⃣ CHECK CONTENT SCRIPT LOGS (Optional)

### In ChatGPT Page DevTools:

```
1. Visit: chatgpt.com
2. Open: DevTools (F12)
3. Go to: Console tab
4. Click Enhance button
```

### Look for Logs:
```
✅ SUCCESS:
[Content Script] Initialized
[DOM Observer] Watching for input elements
[Prompt Enhancer] Enhancement started
[Inline UI] Button created and injected

After clicking enhance:
[Prompt Enhancer] Using preset: balanced
[Prompt Enhancer] Enhanced prompt applied
[Content Script] Success: Prompt replaced
```

---

## 7️⃣ VERIFY API CALL (Advanced)

### In Chrome DevTools Network Tab:

```
1. Click: "Network" tab
2. Filter: "generativelanguage"
3. Click: Enhance button on ChatGPT
4. You should see: API request to generativelanguage.googleapis.com
```

### Check Request:
- **URL:** `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`
- **Method:** `POST`
- **Headers:** Contains `x-goog-api-key`
- **Status:** `200` (success)

### Check Response:
- **Status:** `200 OK`
- **Body:** JSON with `candidates` array containing enhancement result

---

## ✅ SUCCESS CHECKLIST

- [ ] Yellow banner visible in Options
- [ ] API key pre-filled
- [ ] Button appears on ChatGPT
- [ ] Enhancement works
- [ ] Toast shows success message
- [ ] Service worker logs show "✓ VALID"
- [ ] Prompt actually gets enhanced

---

## ❌ TROUBLESHOOTING MATRIX

| Issue | Check | Fix |
|-------|-------|-----|
| No yellow banner | `test-config.js` line 8 | Set to `true` |
| Key not pre-filled | Hard refresh (Ctrl+Shift+R) | Reload extension |
| Button doesn't appear | Check ChatGPT input selector | May have changed UI |
| "Invalid API key" error | DevTools Service Worker console | Check status code (403/401) |
| Network error | DevTools Network tab | Check internet connection |
| Slow response | Network tab timing | May be rate limited |

---

## 🔧 Quick Debug Commands

Run in **Service Worker Console**:
```javascript
// Check if test config loaded
console.log('Test mode config available');

// Check stored API key (masked)
chrome.storage.local.get(['enhancerSettings'], (r) => {
  if (r.enhancerSettings?.geminiKey) {
    console.log('Key stored (first 10):', r.enhancerSettings.geminiKey.substring(0, 10));
  }
});
```

Run in **Page Console** (on ChatGPT):
```javascript
// Find enhancement button
const btn = document.querySelector('[data-testid*="enhance"], button:has-text("Enhance")');
console.log('Button found:', !!btn);

// Manually trigger enhancement
if (window.__promptEnhancer) {
  window.__promptEnhancer.enhance('test', 'balanced');
}
```

---

## 📋 Test Scenarios

### Scenario 1: Basic Enhancement
1. Type: `"help with this"`
2. Click enhance
3. **Result:** Should be enhanced ✅

### Scenario 2: Long Prompt
1. Type: 500+ character prompt
2. Click enhance
3. **Result:** Should handle it ✅

### Scenario 3: Multiple Enhancements
1. Enhance 3 times in a row
2. Each time should work
3. **Result:** No errors ✅

### Scenario 4: Switch Presets
1. Go to Options → Select "Technical"
2. Go to ChatGPT
3. Enhance a prompt
4. **Result:** Should use technical preset ✅

---

## 🎯 Expected Flow Summary

```
Enable Test Mode
    ↓
Rebuild Extension (npm run build)
    ↓
Reload in Chrome (chrome://extensions/ refresh)
    ↓
Open Options → See yellow banner ✅
    ↓
Go to ChatGPT → Type prompt
    ↓
Click enhance button
    ↓
See spinner → Prompt updates ✅
    ↓
Toast shows success ✅
    ↓
Check DevTools → Logs show "✓ VALID" ✅
    ↓
SUCCESS! 🎉
```

---

## Next Steps After Verification

If everything works:
1. ✅ Test all presets (Concise, Detailed, Balanced, etc.)
2. ✅ Test keyboard shortcuts (Alt+E, Alt+1, Alt+2, Alt+3)
3. ✅ Test on both ChatGPT and Claude
4. ✅ Read through TESTING.md for comprehensive test cases

If something fails:
1. ❌ Check DevTools console for detailed error
2. ❌ Enable `VERBOSE_LOGGING = true` in test-config.js
3. ❌ Try `BYPASS_API_VALIDATION = true` temporarily
4. ❌ Check Google Cloud API is enabled
5. ❌ Try incognito window (no cache issues)

---

**Happy testing! 🚀**
