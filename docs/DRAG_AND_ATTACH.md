# Drag and Attach Feature

## Overview

The drag-and-attach feature allows you to reposition the enhancement button anywhere on the page and optionally "attach" it to specific UI elements (like the send button or input box). When attached, the button will automatically follow the element as you scroll, resize the window, or navigate through the app.

## How to Use

### Enabling Drag Mode

1. **Right-click** on the enhancement button (the purple gradient button with layers icon)
2. From the context menu, select **"🎯 Drag & Attach"**
3. You'll see a toast notification: _"Drag the button to reposition or attach it to an element. Press ESC to cancel."_

### Moving the Button

Once in drag mode:

1. **Click and hold** on the button
2. **Drag** it to your desired location
3. **Release** to drop it

The button will stay at the position where you released it.

### Attaching to Elements

The system automatically detects "attachable" elements on the page:

- **Send Button** - The submit/send button in the chat interface
- **Input Box** - The text input area where you type messages
- **Container** - The form or fieldset containing the input area

#### How Snapping Works

1. While dragging, move the button **close to** an attachable element (within 80 pixels)
2. You'll see a **purple dot indicator** appear, showing the snap point
3. The button will highlight when it detects a snap target
4. **Release the mouse** to attach

The button can attach to any of the four sides of an element:
- **Left side** - Button appears to the left of the element
- **Right side** - Button appears to the right of the element
- **Top side** - Button appears above the element
- **Bottom side** - Button appears below the element

The system automatically determines which side based on where you release the button.

### Position Tracking

Once attached, the button will:

- ✅ **Follow the element** as it moves (scroll, layout changes)
- ✅ **Maintain its relative position** to the element
- ✅ **Automatically reposition** when the page layout changes
- ✅ **Survive page reloads** - Your attachment is saved and restored

### Canceling Drag Mode

Press **ESC** at any time during dragging to cancel without making changes.

## Position Modes

The button supports two position modes:

### 1. Fixed Mode (default)
- Button is positioned relative to the **viewport** (browser window)
- Position stays the same when you scroll
- This is the mode when you drag and release without snapping to an element

### 2. Attached Mode
- Button is positioned relative to a **specific element**
- Automatically tracks the element's position
- Perfect for keeping the button next to UI elements that move

## Storage

Your button position is automatically saved to browser storage and will be restored:
- ✅ When you reload the page
- ✅ When you open a new chat
- ✅ Across browser sessions

## Technical Details

### Architecture

The implementation consists of three main components:

1. **DragAttachManager** (`drag-attach-manager.js`)
   - Handles drag interactions
   - Detects snap targets
   - Manages visual feedback
   - Generates element selectors for persistence

2. **PositionTracker** (`position-tracker.js`)
   - Tracks attached element position changes
   - Uses MutationObserver, ResizeObserver, and scroll events
   - Updates button position with requestAnimationFrame for smooth tracking

3. **InlineUI Integration** (`inline-ui.js`)
   - Initializes the drag system
   - Loads and saves position data
   - Provides UI feedback (toasts, context menu)

### Saved Data Structure

```javascript
// Attached mode
{
  mode: 'attached',
  attachedTo: {
    selector: 'button[data-testid="send-button"]',
    platform: 'chatgpt',
    offset: { x: -40, y: 0 },
    anchor: 'left',
    label: 'Send Button'
  }
}

// Fixed mode
{
  mode: 'fixed',
  left: '100px',
  top: '200px',
  right: 'auto',
  bottom: 'auto'
}
```

### Element Detection

The system identifies attachable elements using platform-specific selectors:

**ChatGPT:**
- `button[data-testid*="send"]`
- `button[data-testid="send-button"]`
- `button[aria-label*="Send"]`

**Claude:**
- `button[type="submit"]`
- `button[aria-label*="Send"]`

**Gemini:**
- `button[aria-label*="Send"]`
- `button.send-button`

### Snap Distance

The snap detection triggers when the button is within **80 pixels** of an attachable element's edge.

## Browser Compatibility

- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari (with vendor prefixes)

The feature uses modern web APIs:
- MutationObserver (supported by all modern browsers)
- ResizeObserver (supported by all modern browsers)
- requestAnimationFrame (widely supported)

## Troubleshooting

**Button doesn't attach:**
- Make sure you're dragging close enough to the target element (within 80px)
- Look for the purple snap indicator dot
- Try different sides of the element

**Button position resets:**
- Check browser storage permissions
- Ensure the extension has permission to store data
- The element selector might have changed (page update)

**Button doesn't follow element:**
- The target element might have been removed from the DOM
- The page structure might have changed significantly
- Try re-attaching using drag mode

**Performance issues:**
- Position tracking uses requestAnimationFrame for efficiency
- MutationObserver and ResizeObserver are throttled
- Contact support if you experience lag

## Future Enhancements

Potential improvements:
- [ ] Visual preview of attachment while dragging
- [ ] Highlight attachable elements during drag
- [ ] More granular offset control
- [ ] Attachment to custom CSS selectors
- [ ] Multi-monitor support improvements
- [ ] Touch/mobile support
