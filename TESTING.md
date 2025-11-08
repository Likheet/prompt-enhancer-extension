# Testing Guide - AI Prompt Enhancer Extension

## Pre-Testing Setup

### 1. Install Extension
1. Open Chrome/Chromium browser
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `prompt-enhancer-extension` directory

### 2. Verify Installation
- Extension icon should appear in toolbar
- Click icon to open popup
- Right-click icon → Options to open settings page

---

## Testing Checklist

### ✅ Phase 1: Basic Functionality

#### Platform Detection
- [ ] **ChatGPT (chat.openai.com)**
  - [ ] Extension loads without errors
  - [ ] Inline button appears beside textarea
  - [ ] Button positioned correctly
  - [ ] Button animates in smoothly

- [ ] **ChatGPT (chatgpt.com)**
  - [ ] Extension loads without errors
  - [ ] Inline button appears beside textarea
  - [ ] Button positioned correctly
  - [ ] Button animates in smoothly

- [ ] **Claude AI (claude.ai)**
  - [ ] Extension loads without errors
  - [ ] Inline button appears beside textarea
  - [ ] Button positioned correctly
  - [ ] Button animates in smoothly

#### Inline Button Behavior
- [ ] Button appears after typing text
- [ ] Button stays visible during typing
- [ ] Button repositions on page resize
- [ ] Button survives page navigation (SPA routing)
- [ ] Hover effect works smoothly
- [ ] Click triggers enhancement

#### Loading States
- [ ] Spinner appears when processing
- [ ] Button shows "processing" state
- [ ] Button disabled during processing
- [ ] Button returns to normal after completion

---

### ✅ Phase 2: Enhancement Presets

#### Free Tier (Rule-Based)
- [ ] **Concise preset works**
  - [ ] Makes prompts shorter and clearer
  - [ ] Removes unnecessary words
  - [ ] Maintains original intent

- [ ] **Detailed preset works**
  - [ ] Adds more context
  - [ ] Structures prompt with sections
  - [ ] Includes requirements

- [ ] **Balanced preset works (default)**
  - [ ] Good middle ground
  - [ ] Adds clarity without over-complicating

- [ ] **Technical preset works**
  - [ ] Adds technical specifications
  - [ ] Includes error handling requirements
  - [ ] Mentions documentation needs

- [ ] **Creative preset works**
  - [ ] Adds tone/style guidelines
  - [ ] Includes audience specification
  - [ ] Adds creative constraints

#### BYOK Tier (AI-Powered)
- [ ] **Gemini API integration**
  - [ ] API key validation works
  - [ ] Enhancement calls Gemini API
  - [ ] Response properly parsed
  - [ ] Error handling for API failures
  - [ ] Fallback to rule-based on error

- [ ] **Custom preset works**
  - [ ] User-defined instructions applied
  - [ ] Custom prompt saved correctly
  - [ ] Switch to custom preset automatic

---

### ✅ Phase 3: Settings & Options Page

#### Access
- [ ] Right-click extension icon → Options opens settings
- [ ] Settings page loads without errors
- [ ] All sections render correctly

#### Enhancement Type Selector
- [ ] All 6 presets display with cards
- [ ] Radio selection works
- [ ] Selected preset highlighted
- [ ] Custom section shows when custom selected
- [ ] Custom section hides for other presets

#### Custom Enhancement Section
- [ ] Textarea appears when custom selected
- [ ] Can type custom instructions
- [ ] Instructions saved on change
- [ ] Instructions persist on reload

#### Keyboard Shortcuts Configuration
- [ ] All 3 shortcuts display (Alt+1/2/3)
- [ ] Dropdowns populated with presets
- [ ] Custom excluded from shortcuts
- [ ] Selection saved correctly
- [ ] Changes persist

#### API Configuration
- [ ] API key input field works
- [ ] Show/hide password toggle works
- [ ] Save button validates key
- [ ] Invalid key shows error
- [ ] Valid key shows success
- [ ] Remove button appears after save
- [ ] Remove button clears key
- [ ] Subscription badge updates (Free ↔ BYOK)

#### General Settings
- [ ] Enhancement level dropdown works
- [ ] Context window number input works
- [ ] Auto-enhance checkbox works
- [ ] Show diff checkbox works
- [ ] All settings save on change
- [ ] Settings persist on reload

#### Platform Support Display
- [ ] ChatGPT marked as active
- [ ] Claude marked as active
- [ ] Other platforms marked as coming soon

#### Usage Statistics
- [ ] Total enhancements counter works
- [ ] BYOK enhancements counter works
- [ ] Free tier enhancements calculated correctly
- [ ] Counters increment on enhancement

---

### ✅ Phase 6: Keyboard Shortcuts

#### Alt+E (Enhance)
- [ ] Works when focused on chat input
- [ ] Triggers enhancement immediately
- [ ] Shows loading state
- [ ] Displays feedback notification
- [ ] Doesn't interfere with native Alt+E behavior

#### Alt+1/2/3 (Quick Preset Switch)
- [ ] Alt+1 switches to configured preset
- [ ] Alt+2 switches to configured preset
- [ ] Alt+3 switches to configured preset
- [ ] Feedback notification shows preset name
- [ ] Setting saved immediately
- [ ] Next enhancement uses new preset

#### Alt+C (Quick Custom Editor)
- [ ] Opens modal when pressed
- [ ] Modal animates in smoothly
- [ ] Textarea focused automatically
- [ ] Existing custom prompt pre-filled
- [ ] Can type new instructions
- [ ] Ctrl+Enter saves and closes
- [ ] Escape closes without saving
- [ ] Click outside closes
- [ ] Save button works
- [ ] Cancel button works
- [ ] Close X button works
- [ ] Switches to custom preset on save

#### Shortcut Feedback
- [ ] Appears in top-right corner
- [ ] Animates in smoothly
- [ ] Shows correct message
- [ ] Auto-dismisses after 2.5s
- [ ] Doesn't stack multiple notifications
- [ ] Colors match action type

---

### ✅ Text Injection & Replacement

#### ChatGPT
- [ ] Enhanced text replaces original
- [ ] Textarea updates correctly
- [ ] Send button becomes enabled
- [ ] No duplicate text
- [ ] Special characters handled
- [ ] Long prompts (2000+ chars) work
- [ ] Emojis preserved

#### Claude
- [ ] Enhanced text replaces original
- [ ] ContentEditable updates correctly
- [ ] Send button becomes enabled
- [ ] No duplicate text
- [ ] Special characters handled
- [ ] Long prompts (2000+ chars) work
- [ ] Emojis preserved

---

### ✅ Context Extraction

#### Conversation History
- [ ] Extracts user messages
- [ ] Extracts assistant messages
- [ ] Maintains correct order
- [ ] Respects context window setting
- [ ] Handles empty conversations
- [ ] Handles very long conversations

#### Metadata Detection
- [ ] Detects code content correctly
- [ ] Identifies programming language
- [ ] Extracts topic from messages
- [ ] Counts messages accurately

---

### ✅ Edge Cases & Error Handling

#### Empty/Invalid Input
- [ ] Empty prompt shows error toast
- [ ] Very short prompt (1-2 words) enhances
- [ ] Very long prompt (5000+ chars) enhances

#### Network Issues
- [ ] Offline shows error gracefully
- [ ] Slow network shows loading state
- [ ] API timeout handled
- [ ] Retry logic works

#### Page Navigation
- [ ] Button survives page reload
- [ ] Button reappears after navigation
- [ ] Settings persist across sessions
- [ ] No memory leaks on navigation

#### Multiple Tabs
- [ ] Works in multiple ChatGPT tabs
- [ ] Works in multiple Claude tabs
- [ ] Settings sync across tabs
- [ ] No conflicts between tabs

#### Browser Compatibility
- [ ] Chrome (latest) works
- [ ] Edge (latest) works
- [ ] Brave works
- [ ] Arc works

---

### ✅ Performance

#### Load Time
- [ ] Extension initializes in <2s
- [ ] Button appears in <500ms after page load
- [ ] Settings load instantly

#### Enhancement Speed
- [ ] Rule-based enhancement <1s
- [ ] BYOK enhancement <3s average
- [ ] No UI freezing during processing

#### Memory Usage
- [ ] No memory leaks after 10+ enhancements
- [ ] Browser stays responsive
- [ ] Extension cleanup on page unload

---

### ✅ UI/UX Polish

#### Animations
- [ ] All transitions smooth (60fps)
- [ ] No janky animations
- [ ] Loading spinner spins smoothly
- [ ] Toasts slide in/out smoothly

#### Visual Feedback
- [ ] Success toasts show on success
- [ ] Error toasts show on error
- [ ] Feedback messages are clear
- [ ] Colors match message type

#### Accessibility
- [ ] Button has aria-label
- [ ] Keyboard navigation works
- [ ] Focus states visible
- [ ] Screen reader compatible

---

## Test Scenarios

### Scenario 1: First-Time User
1. Install extension
2. Visit ChatGPT
3. Type a simple prompt
4. Click enhance button
5. See enhanced prompt applied
6. **Expected**: Smooth experience, clear what happened

### Scenario 2: BYOK Setup
1. Get Gemini API key
2. Open settings
3. Enter API key
4. Save key
5. Go to ChatGPT
6. Enhance a prompt
7. **Expected**: Uses AI enhancement, shows BYOK badge

### Scenario 3: Power User with Shortcuts
1. Configure Alt+1/2/3 shortcuts
2. Type prompt in ChatGPT
3. Press Alt+1 (switch to concise)
4. Press Alt+E (enhance)
5. See concise enhancement
6. **Expected**: Fast workflow, clear feedback

### Scenario 4: Custom Enhancement
1. Press Alt+C
2. Write custom instructions
3. Save with Ctrl+Enter
4. Type new prompt
5. Click enhance
6. **Expected**: Custom instructions applied

---

## Bug Reporting Template

If you find a bug, report it with:

```
**Bug Description:**
What happened vs what should happen

**Steps to Reproduce:**
1.
2.
3.

**Environment:**
- Browser: Chrome/Edge/etc
- Platform: ChatGPT/Claude
- Extension Version: 0.1.0

**Console Errors:**
(Open DevTools → Console, copy any errors)

**Screenshots:**
(If applicable)
```

---

## Performance Testing

### Memory Leak Test
1. Open ChatGPT
2. Enhance 20 prompts in a row
3. Check Chrome Task Manager (Shift+Esc)
4. **Expected**: Memory stays stable (<100MB)

### Stress Test
1. Type a 5000 character prompt
2. Click enhance
3. **Expected**: Completes in <5s, no errors

### Concurrent Test
1. Open 5 ChatGPT tabs
2. Enhance in each tab simultaneously
3. **Expected**: All work independently, no conflicts

---

## Automated Testing (Future)

### Unit Tests (Jest)
- [ ] Enhancement preset logic
- [ ] Context extraction
- [ ] Settings management
- [ ] Keyboard shortcut handling

### Integration Tests
- [ ] End-to-end enhancement flow
- [ ] Settings persistence
- [ ] API integration

### E2E Tests (Playwright/Puppeteer)
- [ ] Full user workflows
- [ ] Cross-platform testing
- [ ] UI interaction testing

---

## Sign-Off Criteria

Extension is ready for release when:
- [ ] All critical tests pass (Phases 1, 2, 3, 6)
- [ ] No critical bugs found
- [ ] Performance acceptable (<3s enhancements)
- [ ] Works on ChatGPT and Claude
- [ ] Documentation complete
- [ ] README updated with features

---

## Known Limitations

Document any known limitations:
- Gemini, Poe, Perplexity support coming later
- Custom platform configuration not yet available
- Diff viewer not yet implemented
