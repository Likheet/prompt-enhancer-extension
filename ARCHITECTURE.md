# Prompt Enhancer Extension - Profile-Based Architecture

## Overview

This extension uses a **profile-based architecture** to intelligently place "Enhance Prompt" buttons on AI chat interfaces across different websites. The system supports both site-specific placement profiles and universal fallback detection.

## Architecture Components

### 1. ProfileManager (`profile-manager.js`)

**Responsibility**: Manages placement profiles and determines which profile to use for a given URL.

**Key Functions**:
- `loadProfiles()`: Loads profiles from `chrome.storage.sync`
- `getActiveProfile(url)`: Returns the best matching profile for a URL
- `saveProfile(profile)`: Saves a new or updated profile
- `deleteProfile(profileId)`: Removes a profile

**Profile Matching Priority**:
1. **Exact URL match**: If a profile has a `url` field that exactly matches the current URL
2. **Domain + Path pattern**: Profiles with matching `domain` and `pathPattern`
3. **Domain only**: Profiles with matching `domain` but no `pathPattern`
4. **Universal fallback**: Returns `null`, triggering heuristic detection

### 2. PromptDetector (`prompt-detector.js`)

**Responsibility**: Finds prompt input fields using either profiles or heuristics.

**Key Functions**:
- `detectWithProfile(profile)`: Uses selectors from a profile to find the prompt field
- `detectWithHeuristics()`: Uses smart heuristics to find the best candidate prompt field
- `findElement(selector)`: Helper to query DOM with error handling

**Fallback Heuristics**:
When no profile matches, the detector:
1. Finds all `<textarea>`, large `<input type="text">`, and `contenteditable` elements
2. Filters by visibility, size, and enabled state
3. Scores candidates based on:
   - Size (larger is better)
   - Position (lower on page is better for chat UIs)
   - Semantic attributes (placeholder text, ARIA labels)
4. Returns the highest-scoring candidate

### 3. ButtonController (`button-controller.js`)

**Responsibility**: Creates, positions, and manages the enhance button lifecycle.

**Key Functions**:
- `mount(targetField, anchorElement, placement)`: Creates and positions the button
- `unmount()`: Removes the button from DOM
- `showLoading()` / `hideLoading()`: Loading state management
- `handleClick()`: Orchestrates the enhancement workflow

**Placement Modes**:
- `inside-bottom-right`: Position button absolutely inside prompt box, bottom-right corner
- `inside-top-right`: Position button absolutely inside prompt box, top-right corner
- `inside-bottom-left`: Position button absolutely inside prompt box, bottom-left corner
- `inline-after`: Insert button right after the prompt field in DOM flow
- `toolbar`: Insert button into a toolbar/action bar (requires `anchorSelector`)

**Behavior**:
1. On click: Extract text from prompt field
2. Send to background script via `chrome.runtime.sendMessage`
3. Show loading state
4. Receive enhanced text
5. Replace field content and dispatch events
6. Hide loading state

### 4. Watcher (`watcher.js`)

**Responsibility**: Monitors DOM changes and manages button lifecycle for SPAs.

**Key Functions**:
- `start()`: Initializes detection and sets up MutationObserver
- `stop()`: Stops observing and cleans up
- `handleMutation(mutations)`: Responds to DOM changes

**Behavior**:
- On page load: Detects prompt field and mounts button
- Uses `MutationObserver` on `document.documentElement`
- On DOM mutations:
  - Checks if current button is still attached
  - Looks for new prompt fields matching the profile
  - Re-mounts button if needed
- Ensures only **one active button** exists at a time

### 5. Background Service Worker (`background-main.js`)

**Responsibility**: Handles API calls and message passing.

**Key Functions**:
- Listens for `ENHANCE_PROMPT` messages
- Calls enhancement API (stubbed as `enhancePrompt()`)
- Returns `{ ok: true, text: "..." }` or `{ ok: false, error: "..." }`

## Data Structures

### PlacementProfile

```javascript
{
  id: "chatgpt-main",           // Unique identifier
  domain: "chatgpt.com",         // Domain to match (without protocol)
  pathPattern: "/c/*",           // Optional: glob pattern for path
  url: null,                     // Optional: exact URL match (highest priority)

  promptSelector: "textarea#prompt-textarea",  // CSS selector for prompt field
  anchorSelector: null,          // Optional: CSS selector for anchor element

  mode: "inside-bottom-right",   // Placement mode (see above)
  offsetX: "16px",               // Horizontal offset from anchor
  offsetY: "16px",               // Vertical offset from anchor
  size: "32px",                  // Optional: button size

  enabled: true                  // Whether this profile is active
}
```

### DefaultProfile (Fallback Configuration)

```javascript
{
  mode: "inside-bottom-right",
  offsetX: "12px",
  offsetY: "12px",
  size: "28px",
  minWidth: 300,    // Minimum width for candidate fields
  minHeight: 60,    // Minimum height for candidate fields
  preferBottom: true // Prefer fields in lower viewport
}
```

### Enhancement Message Format

**Request** (content script → background):
```javascript
{
  type: "ENHANCE_PROMPT",
  text: "Original prompt text..."
}
```

**Response** (background → content script):
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

## Storage Schema

Stored in `chrome.storage.sync`:

```javascript
{
  "promptenhancer_profiles": [
    { /* Profile 1 */ },
    { /* Profile 2 */ },
    // ...
  ],
  "promptenhancer_defaultProfile": {
    // Default/fallback settings
  }
}
```

## Event Flow

### Initial Page Load

1. Content script loads
2. `Watcher.start()` is called
3. Watcher asks `ProfileManager.getActiveProfile(location.href)`
4. If profile found:
   - `PromptDetector.detectWithProfile(profile)` finds the field
5. If no profile:
   - `PromptDetector.detectWithHeuristics()` finds best candidate
6. `ButtonController.mount(field, anchor, placement)` creates button
7. `MutationObserver` starts watching for DOM changes

### Button Click

1. User clicks enhance button
2. `ButtonController.handleClick()` fires
3. Extract text from field (`.value` or `.innerText`)
4. Send message to background: `{ type: "ENHANCE_PROMPT", text }`
5. Background calls API and responds
6. On success:
   - Replace field content
   - Dispatch `input` and `change` events
   - Show success notification
7. On error:
   - Log error and show error notification

### SPA Navigation / DOM Change

1. `MutationObserver` fires
2. `Watcher.handleMutation()` checks:
   - Is button still attached?
   - Did the prompt field disappear?
   - Are there new matching elements?
3. If button detached or field gone:
   - Unmount old button
   - Re-run detection
   - Mount new button

## Styling Strategy

The button copies visual cues from the target prompt field to blend in:

- **Background color**: Sampled from prompt field's computed style
- **Text color**: Sampled from prompt field's computed style
- **Border radius**: Inherited if present
- **Icon**: Simple `✨` emoji or minimal SVG
- **Size**: Small (24-32px) and non-intrusive
- **Hover effect**: Subtle scale or opacity change

## Cross-Site Compatibility

### Known Site Profiles (Examples)

- **ChatGPT** (`chatgpt.com/c/*`)
  - Selector: `textarea#prompt-textarea`
  - Mode: `toolbar`
  - Anchor: Button toolbar container

- **Claude** (`claude.ai`)
  - Selector: `div.ProseMirror[contenteditable="true"]`
  - Mode: `inside-bottom-right`

- **Gemini** (`gemini.google.com`)
  - Selector: `rich-textarea`
  - Mode: `inside-bottom-right`

### Universal Fallback

For unknown sites, the detector uses heuristics to find:
- Large `<textarea>` elements
- `contenteditable` divs that are chat-like in size
- Text inputs that are wider than 300px

Then places the button using the default placement mode.

## Extension Points

### Adding a New Profile (Manual)

1. Open DevTools console on the extension's background page
2. Run:
```javascript
chrome.storage.sync.get(['promptenhancer_profiles'], (data) => {
  const profiles = data.promptenhancer_profiles || [];
  profiles.push({
    id: "mysite-profile",
    domain: "example.com",
    pathPattern: "/chat/*",
    promptSelector: "textarea.chat-input",
    mode: "inside-bottom-right",
    offsetX: "16px",
    offsetY: "16px",
    enabled: true
  });
  chrome.storage.sync.set({ promptenhancer_profiles: profiles });
});
```

### Future: Profile Editor UI

A future enhancement would be an options page where users can:
- View all profiles in a list
- Add/edit/delete profiles with a form
- Test selectors on the current page
- Export/import profile sets

## Performance Considerations

- **MutationObserver throttling**: Mutations are throttled/debounced to avoid excessive re-runs
- **Selector caching**: Found elements are cached and validated before re-querying
- **Lazy detection**: Fallback heuristics only run when no profile matches
- **Single button instance**: At most one button exists per page at any time

## Security Considerations

- All selectors are sanitized before use
- No eval() or innerHTML with user input
- API calls go through background script only
- Content script has minimal permissions

## Testing Strategy

- **Unit tests**: Test profile matching logic, heuristic scoring
- **Integration tests**: Test on known sites (ChatGPT, Claude, Gemini)
- **Fallback tests**: Test on generic pages with various input types
- **SPA tests**: Verify button persistence through route changes
- **Event tests**: Verify frameworks detect text changes (React, Vue, etc.)
