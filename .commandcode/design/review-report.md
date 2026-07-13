# Review Report — Prompt Enhancer Popup

**Project:** AI Prompt Enhancer
**Surface:** Extension popup (src/popup/*)
**Date:** 2026-07-12
**Mode:** /design review

---

## Verdict

**32/50 — MIDDLE**

The popup is competent and works. It does not embarrass itself. But it also does not announce itself. A stranger opening it would say "this is a settings panel" but would not remember it ten minutes later. The strongest fix is to give the surface a *voice* — a display type, a real wordmark, and a usage section that reads as a sentence rather than two numbers.

---

## First impression

A small, light, warm panel. The status pill in the top right shows "Active on ChatGPT" with a green dot — that part works. The left side reads as "brand mark + product name + version." The segmented control below is textbook. The Settings cards are textbook.

What I'd change in the first two seconds: I'd drop the `v1` and the rounded square. The wordmark is enough. I'd also lift the section titles to a display size so the eye knows the section is a section, not just a list.

## The flow I walked

Open popup. See header + tabs. Click "Enhance" (default). See three rewrite cards, context window input, usage stats. Click "Structured" — save bar appears at the bottom. Click "Discard" — save bar disappears, "Direct" stays selected. Click "Sites". See header "Sites / Control where the enhancer appears." See current-site card with ChatGPT, the placement select, and the saved-sites list (showing ChatGPT · On · Before Send · Remove). Click the placement select, change to "before-send" — wait — the test passes. Click "API key". See "Gemini API key / Not connected" chip, then the API key form, then "Show" toggle. Fill the key, click Show — input becomes text, button becomes "Hide". Confirm.

The flow works. The breaking points are: nothing in the flow tells me the product's *story*. It's a form, not a tool.

## Design Lenses

### First impression — 6/10

Looks like a SaaS settings panel. The accent is right (green), the palette is right (warm), but the surface never announces what it is or what it does. The first thing a user sees is the chrome (header, tabs) rather than the product's main thing (rewrite style).

### Hierarchy — 6/10

Headings read as bigger body, not as headings. The section title (`REWRITE STYLE`, `USAGE`, `SAVED SITE SETTINGS`) is 11.5px bold uppercase — that's a small label, not a heading. The panel-header `<h2>` is 16px / 600 weight / -0.018em tracking — also reads as body. There's no display size anywhere on the surface.

The eye should land in this order: 1) the active tab, 2) the section title, 3) the primary control. Currently it lands on the header brand mark first, then the status pill, then the tabs. The section the user is *in* comes third.

### Color voice — 7/10

The green is well-chosen (domain color, used sparingly, AA contrast on muted). The warm off-white is a deliberate break from the SaaS white-and-gray default. Hairline borders (`rgba(20, 20, 30, 0.08)`) are the right call. The status chip with the soft green pill background is genuinely nice.

What it lacks: there is no "this is the only place where color means something" moment. The green shows up in the status pill, the save bar dot, the active tab indicator (faintly), and the Connected state. That's already a few too many. The rule of thumb is 60/30/10 — green is probably at 8%, which is fine, but it should be 10% in one place, not 3% in four places.

### Type voice — 5/10

Geist is a good face. The choice is intentional. The execution is not. There is no display size. The mono font only shows up in the secret field. The hierarchy uses weight (500/600) more than size, which is a flat hierarchy. Section titles are uppercase labels, not headings.

### Interaction feel — 8/10

This is the strongest lens. The save bar appears on change, the discard reverts, the toggle works, the API key reveal works, the placement select persists. Focus rings are present. Reduced-motion is honored. The one weakness: the save bar appears without focus management — keyboard users don't get moved to it automatically.

---

## Heuristics

| # | Lens | Score |
|---|---|---|
| 1 | First impression | 6/10 |
| 2 | Hierarchy | 6/10 |
| 3 | Color voice | 7/10 |
| 4 | Type voice | 5/10 |
| 5 | Interaction feel | 8/10 |
| | **Total** | **32/50** |

---

## Top recommendations (ordered by impact)

1. **Give the surface a heading voice** (`typeset`) — Define a display type role (24px, 600 weight, tight tracking) and use it on the Sites panel header and the API panel header. Currently every heading is 16px; the largest thing on the surface is a 22px stat number. The hierarchy is upside-down.
2. **Refuse the stat monument** (`refine`) — The Usage block displays two 22px bold numbers ("128" and "47") with no sentence of context. Either fold them into a single line ("128 enhancements · 47 with your own key") or give each a one-line caption ("across your last 12 chats", "vs. the free tier"). Right now it's the most visually loud thing on the panel, and it's the least meaningful.
3. **Strip the brand row** (`refine`) — Drop the rounded square next to the wordmark. Drop the `v1` badge. The wordmark "Prompt Enhancer" is enough. The status pill on the right earns its slot.
4. **Move focus to the save bar** when it appears (`interaction`) — Five lines of JS. Big a11y win.
5. **System font, not Google Fonts** (`typeset`) — The popup opens dozens of times per day. System fonts load instantly; Geist is a small visual improvement that costs a network round trip. For an extension popup, this is the wrong trade.

---

## What I refuse to call out

- The accent color (green) — it is the right color
- The palette (warm off-white) — it is the right palette
- The save bar — it is the right pattern for a commit area
- The radio card pattern — it is the right pattern for a small choice
- The segmented control — it is the right pattern for three tabs in 400px

These are all good. The work is in the type and the small copy decisions.

## Recommended next mode

`/design typeset` first (gives the surface a voice), then `/design refine` (kills the stat monument + brand row in one pass). Re-run review after.
