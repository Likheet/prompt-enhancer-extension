# Testing the AI Prompt Enhancer

## Automated checks

Run these commands from the project root:

```bash
npm install
npm run lint
npm test
npm run test:e2e
```

`npm test` covers the local enhancement engine, free-tier presets, browser/background message contracts, hostname matching, and credential-safety rules.

`npm run test:e2e` builds the extension, loads it into headless Chromium, and verifies:

- Inline placement without covering the composer.
- Prompt enhancement in textareas and rich-text editors.
- Keyboard preset switching and Alt+E enhancement.
- Reattachment after a single-page app replaces its composer.
- Correct usage counting.
- Options and popup pages loading without browser errors.

The browser smoke test uses a local fixture and does not call Gemini or require an API key.

## Manual Chrome check

1. Run `npm run build`.
2. Open `chrome://extensions` and enable Developer mode.
3. Choose Load unpacked and select this project directory.
4. Open a supported AI site and refresh the tab.
5. Type a short prompt and confirm the enhancement button appears inside or beside the composer without covering its text or Send button.
6. Click the button and confirm the prompt changes without being sent automatically.
7. Replace or reload the page composer through normal navigation and confirm the button reappears.

For BYOK testing, use your own active Gemini key. Never commit keys to source files, fixtures, screenshots, or logs.
